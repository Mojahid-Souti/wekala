"""Orchestrates the MCP/Tool lifecycle: register, discover, grant, invoke.

Every state-changing method:
  - validates inputs at the boundary (URL via SSRF guard; agent ownership)
  - writes an audit_log entry
  - returns the ORM model

Invocation hot path:
  - validates the agent has the tool whitelisted (per-agent ACL)
  - validates input against the tool's JSON Schema (jsonschema)
  - calls the MCP server via the HTTPMCPClient adapter
  - records a tool_invocation row with hashes + previews + latency + outcome
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from collections.abc import Callable
from typing import Any
from urllib.parse import urlsplit

from fastapi import HTTPException, status
from jsonschema import Draft202012Validator, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from wekala.adapters.mcp.base import MCPClient
from wekala.adapters.mcp.http_client import HTTPMCPClient, MCPError
from wekala.core.constants import Action, Outcome, ResourceType
from wekala.core.security.ssrf_guard import validate_external_url
from wekala.db.models import MCPServer, Tool, ToolInvocation
from wekala.db.repositories.audit import AuditRepository
from wekala.db.repositories.mcp_server import MCPServerRepository, ToolRepository

PREVIEW_MAX_CHARS = 200


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _preview(s: str) -> str:
    return s[:PREVIEW_MAX_CHARS]


class ToolService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        # Callable rather than type[MCPClient] — Protocol classes can't be
        # instantiated, so mypy treats type[Protocol] as having no constructor.
        # A Callable[[str], MCPClient] expresses "give me a URL, I'll give
        # you a client" which is what we actually want.
        mcp_client_factory: Callable[[str], MCPClient] = HTTPMCPClient,
        builtin_hostnames: frozenset[str] | None = None,
    ) -> None:
        self._db = db
        self._mcp_servers = MCPServerRepository(db)
        self._tools = ToolRepository(db)
        self._audit = AuditRepository(db)
        self._client_factory = mcp_client_factory
        # Hostnames that bypass SSRF check (Docker-network built-in sidecars).
        # Built-ins are flagged at registration time; runtime invocation re-validates.
        self._builtin_hostnames = builtin_hostnames or frozenset()

    # ---------- MCP server lifecycle ----------

    async def register_mcp_server(
        self,
        *,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID,
        name: str,
        description: str,
        url: str,
    ) -> MCPServer:
        """Validates URL via SSRF guard, then stores the server. Admin role required at API layer.

        `is_builtin` is auto-detected: if the URL's hostname is in the configured
        `mcp_builtin_hostnames` allowlist (Docker-network sidecars), the row is
        flagged builtin and the SSRF check permits its private IP.
        """
        if await self._mcp_servers.name_exists(workspace_id, name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An MCP server named '{name}' already exists in this workspace.",
            )

        try:
            validated_url = await validate_external_url(
                url, allow_hostnames=self._builtin_hostnames
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

        is_builtin = urlsplit(validated_url).hostname in self._builtin_hostnames

        async with self._db.begin_nested():
            srv = await self._mcp_servers.create(
                workspace_id=workspace_id,
                name=name,
                description=description,
                url=validated_url,
                registered_by=actor_id,
                is_builtin=is_builtin,
            )
            await self._audit.record(
                action=Action.MCP_SERVER_REGISTER,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.MCP_SERVER,
                resource_id=srv.id,
            )
        return srv

    async def delete_mcp_server(
        self, *, server_id: uuid.UUID, workspace_id: uuid.UUID, actor_id: uuid.UUID
    ) -> None:
        srv = await self._mcp_servers.get(server_id)
        if not srv or srv.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="MCP server not found"
            )

        async with self._db.begin_nested():
            await self._audit.record(
                action=Action.MCP_SERVER_DELETE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.MCP_SERVER,
                resource_id=server_id,
            )
            await self._mcp_servers.delete(srv)

    async def discover_tools(
        self, *, server_id: uuid.UUID, workspace_id: uuid.UUID, actor_id: uuid.UUID
    ) -> list[Tool]:
        """Call the MCP server's tools/list, upsert each tool, deactivate any that disappeared."""
        srv = await self._mcp_servers.get(server_id)
        if not srv or srv.workspace_id != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="MCP server not found"
            )

        # Re-validate URL at discovery time (DNS rebinding mitigation; built-ins bypass)
        try:
            await validate_external_url(
                srv.url,
                allow_hostnames=self._builtin_hostnames if srv.is_builtin else None,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"MCP server URL is no longer safe to call: {e}",
            ) from e

        client = self._client_factory(srv.url)
        try:
            defs = await client.list_tools()
        except MCPError as e:
            await self._audit.record(
                action=Action.MCP_SERVER_DISCOVER,
                outcome=Outcome.FAILURE,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.MCP_SERVER,
                resource_id=server_id,
                metadata={"error": str(e)},
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"MCP discovery failed: {e}",
            ) from e

        async with self._db.begin_nested():
            present: set[str] = set()
            for d in defs:
                await self._tools.upsert_for_server(
                    mcp_server_id=server_id,
                    workspace_id=workspace_id,
                    name=d.name,
                    description=d.description,
                    input_schema=d.input_schema,
                )
                present.add(d.name)
            await self._tools.deactivate_missing(server_id, present)
            await self._audit.record(
                action=Action.MCP_SERVER_DISCOVER,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.MCP_SERVER,
                resource_id=server_id,
                metadata={"tool_count": len(defs)},
            )

        return await self._tools.list_for_server(server_id)

    # ---------- Per-agent whitelist ----------

    async def grant_tool(
        self,
        *,
        agent_id: uuid.UUID,
        tool_id: uuid.UUID,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> None:
        tool = await self._tools.get(tool_id)
        if not tool or tool.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")

        if await self._tools.is_granted(agent_id, tool_id):
            return  # idempotent

        async with self._db.begin_nested():
            await self._tools.grant_to_agent(
                agent_id=agent_id,
                tool_id=tool_id,
                workspace_id=workspace_id,
                granted_by=actor_id,
            )
            await self._audit.record(
                action=Action.TOOL_GRANT,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.TOOL,
                resource_id=tool_id,
                metadata={"agent_id": str(agent_id)},
            )

    async def revoke_tool(
        self,
        *,
        agent_id: uuid.UUID,
        tool_id: uuid.UUID,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID,
    ) -> None:
        async with self._db.begin_nested():
            removed = await self._tools.revoke_from_agent(agent_id, tool_id)
            if not removed:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Tool not granted to this agent"
                )
            await self._audit.record(
                action=Action.TOOL_REVOKE,
                outcome=Outcome.SUCCESS,
                actor_user_id=actor_id,
                actor_workspace_id=workspace_id,
                resource_type=ResourceType.TOOL,
                resource_id=tool_id,
                metadata={"agent_id": str(agent_id)},
            )

    # ---------- Invocation ----------

    async def invoke_tool(
        self,
        *,
        agent_id: uuid.UUID,
        tool_id: uuid.UUID,
        workspace_id: uuid.UUID,
        actor_id: uuid.UUID,
        arguments: dict[str, Any],
    ) -> ToolInvocation:
        """Validate whitelist + schema, call MCP, record invocation.
        O(1) writes + 1 network call."""
        tool = await self._tools.get(tool_id)
        if not tool or tool.workspace_id != workspace_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
        if tool.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tool is disabled")

        if not await self._tools.is_granted(agent_id, tool_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This tool is not granted to this agent",
            )

        # Validate arguments against the cached JSON Schema.
        try:
            if tool.input_schema:
                Draft202012Validator(tool.input_schema).validate(arguments)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tool input validation failed: {e.message}",
            ) from e

        srv = await self._mcp_servers.get(tool.mcp_server_id)
        if not srv:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Tool's MCP server no longer exists",
            )

        # Re-resolve URL on every invocation to mitigate DNS rebinding.
        try:
            await validate_external_url(
                srv.url,
                allow_hostnames=self._builtin_hostnames if srv.is_builtin else None,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"MCP URL no longer safe to call: {e}",
            ) from e

        input_str = json.dumps(arguments, sort_keys=True, default=str)
        input_hash = _sha256(input_str)
        input_preview = _preview(input_str)

        start = time.perf_counter()
        client = self._client_factory(srv.url)
        outcome = Outcome.SUCCESS
        err_msg: str | None = None
        output_content = ""
        try:
            result = await client.call_tool(tool.name, arguments)
            output_content = result.content
            if result.is_error:
                outcome = Outcome.FAILURE
                err_msg = output_content[:500]
        except MCPError as e:
            outcome = Outcome.FAILURE
            err_msg = str(e)
        latency_ms = int((time.perf_counter() - start) * 1000)

        invocation = ToolInvocation(
            workspace_id=workspace_id,
            agent_id=agent_id,
            tool_id=tool_id,
            caller_user_id=actor_id,
            input_hash=input_hash,
            input_preview=input_preview,
            output_hash=_sha256(output_content) if output_content else None,
            output_preview=_preview(output_content),
            latency_ms=latency_ms,
            outcome=outcome.value,
            error=err_msg,
        )
        self._db.add(invocation)
        await self._db.flush()

        await self._audit.record(
            action=Action.TOOL_INVOKE,
            outcome=outcome,
            actor_user_id=actor_id,
            actor_workspace_id=workspace_id,
            resource_type=ResourceType.TOOL,
            resource_id=tool_id,
            metadata={"agent_id": str(agent_id), "latency_ms": latency_ms},
        )

        if outcome == Outcome.FAILURE and err_msg:
            # Surface to caller but keep the audit row.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Tool invocation failed: {err_msg}",
            )

        return invocation
