"""HTTP MCP client using JSON-RPC 2.0 over POST.

Spec: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
- POST to server URL with JSON body { jsonrpc, id, method, params }
- methods used here: `tools/list`, `tools/call`
- 30s default timeout (overrideable per call)

Errors raise MCPError; callers map to ToolInvocation rows with outcome=failure/timeout.
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx

from .base import MCPClient, MCPInvocationResult, MCPToolDef

DEFAULT_TIMEOUT_S = 30.0


class MCPError(Exception):
    """Raised on MCP protocol failures (transport, JSON-RPC error, malformed response)."""


class HTTPMCPClient(MCPClient):
    """JSON-RPC 2.0 over HTTP MCP client. Stateless — safe to instantiate per request."""

    def __init__(self, url: str, *, timeout_s: float = DEFAULT_TIMEOUT_S) -> None:
        self._url = url
        self._timeout_s = timeout_s

    async def list_tools(self) -> list[MCPToolDef]:
        result = await self._rpc("tools/list", {})
        raw_tools = result.get("tools", [])
        out: list[MCPToolDef] = []
        for t in raw_tools:
            if not isinstance(t, dict) or "name" not in t:
                continue
            out.append(
                MCPToolDef(
                    name=str(t["name"]),
                    description=str(t.get("description", "")),
                    input_schema=t.get("inputSchema") or {},
                )
            )
        return out

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> MCPInvocationResult:
        result = await self._rpc("tools/call", {"name": name, "arguments": arguments})
        # MCP spec: result.content is a list of content blocks; collect text from each.
        content_parts: list[str] = []
        for block in result.get("content", []) or []:
            if isinstance(block, dict) and block.get("type") == "text":
                content_parts.append(str(block.get("text", "")))
        return MCPInvocationResult(
            content="\n".join(content_parts),
            is_error=bool(result.get("isError", False)),
            raw=result,
        )

    async def _rpc(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        body = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
            "params": params,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout_s) as client:
                r = await client.post(self._url, json=body)
        except TimeoutError as e:
            raise MCPError(f"MCP server {self._url!r} timed out after {self._timeout_s}s") from e
        except httpx.HTTPError as e:
            raise MCPError(f"MCP transport error: {e}") from e

        if r.status_code >= 400:
            # Don't leak response body into user-facing errors — body is often HTML.
            # Full body still recorded in audit log via the caller.
            raise MCPError(f"MCP server returned HTTP {r.status_code}")

        try:
            data = r.json()
        except ValueError as e:
            raise MCPError(f"MCP response not JSON: {r.text[:200]}") from e

        if "error" in data:
            err = data["error"]
            raise MCPError(f"MCP RPC error: {err.get('message', err)}")

        if "result" not in data:
            raise MCPError(f"MCP response missing 'result': {data}")

        result = data["result"]
        if not isinstance(result, dict):
            raise MCPError(f"MCP result is not an object: {result!r}")
        return result
