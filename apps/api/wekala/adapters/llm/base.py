"""LLM gateway interface — Rule 5 swap point.

Concrete adapters (Ollama now, LiteLLM/vLLM/Bedrock later) implement this
Protocol so callers (scanner, chat-to-build wizard, etc.) never depend on
a specific provider.

Only `complete_json` is exposed for now — every Wekala caller needs strict
JSON output. Streaming + tool-calling get added when a feature actually
needs them; no premature abstraction (Rule 6).
"""

from __future__ import annotations

from typing import Any, Protocol


class LLMGatewayError(Exception):
    """Raised when the underlying LLM call fails or returns malformed JSON.

    Callers should catch this and fail-closed (record-but-continue), never
    let it bubble up and abort the whole vetting run.
    """


class LLMGateway(Protocol):
    """Local-first LLM access. All implementations must keep inference local
    or behind a workspace-trusted endpoint — never call an external API
    without explicit, classification-gated opt-in.

    Complexity: one network round-trip per `complete_json` — O(1) over the
    prompt; callers handle batching if they need it.
    """

    async def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        """Issue a single chat completion forced to JSON output.

        Returns the parsed JSON object. Raises `LLMGatewayError` on timeout,
        HTTP failure, or unparseable response — never returns partial data.
        """
        ...
