"""Ollama LLM adapter — local-only inference via `POST /api/chat`.

Forces `format: "json"` so the model is constrained to emit valid JSON.
Even with that constraint we still parse defensively (json.loads in a
try/except) because models occasionally wrap output in ``` fences.

Complexity: O(1) network round-trip; payload size is the prompt + response.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from .base import LLMGateway, LLMGatewayError

logger = logging.getLogger(__name__)

# Strip ```json fences models sometimes leak through despite format=json.
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class OllamaLLMAdapter(LLMGateway):
    def __init__(self, base_url: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def complete_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        timeout_s: float = 30.0,
    ) -> dict[str, Any]:
        payload = {
            "model": self._model,
            "format": "json",
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                # Low temperature for deterministic security findings — we
                # don't want creative interpretations of "is this PII".
                "temperature": 0.1,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                resp = await client.post(f"{self._base_url}/api/chat", json=payload)
                resp.raise_for_status()
                body = resp.json()
        except httpx.TimeoutException as e:
            raise LLMGatewayError(f"LLM call timed out after {timeout_s}s") from e
        except httpx.HTTPError as e:
            raise LLMGatewayError(f"LLM HTTP error: {e}") from e

        content = body.get("message", {}).get("content", "")
        if not isinstance(content, str) or not content.strip():
            raise LLMGatewayError("LLM returned empty content")

        cleaned = _FENCE.sub("", content).strip()
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning("LLM returned non-JSON content: %s", cleaned[:200])
            raise LLMGatewayError(f"LLM returned malformed JSON: {e}") from e

        if not isinstance(parsed, dict):
            raise LLMGatewayError(f"LLM returned non-object JSON: {type(parsed).__name__}")
        return parsed
