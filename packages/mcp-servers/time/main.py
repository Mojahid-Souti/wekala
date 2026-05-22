"""
wekala-mcp-time — minimal built-in MCP server.

Exposes a single tool: `get_current_time`. Demonstrates the JSON-RPC 2.0
HTTP transport that Wekala uses for MCP discovery + invocation. Use it as
the template for new built-in tools.

Endpoints:
  POST /mcp     — JSON-RPC entry point
  GET  /health  — liveness probe
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, Request

app = FastAPI(title="wekala-mcp-time", docs_url=None, redoc_url=None)

TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_current_time",
        "description": (
            "Return the current date and time in ISO 8601 format. "
            "Optional `timezone` argument accepts an IANA timezone name "
            "(default: UTC)."
        ),
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "timezone": {
                    "type": "string",
                    "description": "IANA timezone (e.g. Asia/Muscat, UTC). Default: UTC.",
                    "default": "UTC",
                }
            },
        },
    }
]


def _rpc_result(req_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _rpc_error(req_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _text_block(text: str, *, is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": text}],
        "isError": is_error,
    }


def _call_get_current_time(arguments: dict[str, Any]) -> dict[str, Any]:
    tz_name = arguments.get("timezone", "UTC")
    if not isinstance(tz_name, str):
        return _text_block(
            f"timezone must be a string (got {type(tz_name).__name__})", is_error=True
        )
    try:
        tz = ZoneInfo(tz_name) if tz_name != "UTC" else timezone.utc
    except ZoneInfoNotFoundError:
        return _text_block(f"Unknown timezone: {tz_name!r}", is_error=True)
    now = datetime.now(tz)
    return _text_block(now.isoformat())


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/mcp")
async def mcp(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except ValueError:
        return _rpc_error(None, -32700, "Parse error")

    if not isinstance(body, dict):
        return _rpc_error(None, -32600, "Invalid Request")

    req_id = body.get("id")
    method = body.get("method")

    if method == "tools/list":
        return _rpc_result(req_id, {"tools": TOOLS})

    if method == "tools/call":
        params = body.get("params") or {}
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if not isinstance(arguments, dict):
            return _rpc_error(req_id, -32602, "arguments must be an object")
        if name == "get_current_time":
            return _rpc_result(req_id, _call_get_current_time(arguments))
        return _rpc_error(req_id, -32601, f"Unknown tool: {name!r}")

    return _rpc_error(req_id, -32601, f"Method not found: {method!r}")
