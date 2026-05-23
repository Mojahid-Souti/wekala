# Wekala Python SDK

Minimal client for the Wekala public API. Requires Python 3.11+.

## Install

```bash
pip install wekala
# or, from a source checkout:
pip install -e packages/sdk-py
```

## Quickstart

```python
from wekala import WekalaClient

client = WekalaClient(
    api_key="wk_...",
    base_url="https://api.wekala.example",  # or http://localhost:8001 for dev
)

result = client.invoke_agent(
    agent_id="b9f4...-...",
    query="Summarise the support transcript for ticket 4271.",
)

print(result.answer)
print(result.latency_ms, "ms")
```

## Streaming

```python
import asyncio
from wekala import WekalaClient

async def main():
    client = WekalaClient(api_key="wk_...")
    async for event in client.stream_agent("b9f4...", "Hello"):
        print(event)

asyncio.run(main())
```

## Webhook signature verification

The Wekala server signs every webhook delivery with HMAC-SHA256 over the
raw request body. Header: `X-Wekala-Signature: sha256=<hex>`.

```python
from wekala import verify_webhook_signature

YOUR_SECRET = "whsec_..."  # given once at subscription creation

# In your webhook receiver:
body = await request.body()
sig  = request.headers.get("X-Wekala-Signature", "")
if not verify_webhook_signature(YOUR_SECRET, body, sig):
    return 401
# Now you can json.loads(body) and process the event.
```

## Errors

* `WekalaError(status_code=...)` — base exception
* `RateLimitError(retry_after_seconds=...)` — HTTP 429; respect the value
* `ValueError` — local SDK validation (bad API key shape)

## Rate limits

Default per-key limits (configurable server-side):

* 60 requests / minute
* 10,000 requests / day

The server returns `Retry-After` and `X-RateLimit-*` headers; both are
surfaced on `RateLimitError`.
