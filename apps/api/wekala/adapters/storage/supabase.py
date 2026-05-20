"""Supabase Storage adapter via the REST API.

Swap point (Rule 5): replace with S3Adapter or MinIOAdapter without changing callers.
"""

import logging

import httpx

logger = logging.getLogger(__name__)

_BUCKET = "wekala-documents"


class SupabaseStorageAdapter:
    def __init__(self, storage_url: str, service_key: str) -> None:
        self._base = storage_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        }

    async def put(self, path: str, content: bytes, content_type: str) -> str:
        url = f"{self._base}/object/{_BUCKET}/{path}"
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                content=content,
                headers={**self._headers, "Content-Type": content_type},
            )
            if resp.status_code == 409:
                # Object already exists — upsert via PUT
                resp = await client.put(
                    url,
                    content=content,
                    headers={**self._headers, "Content-Type": content_type},
                )
            resp.raise_for_status()
        return path

    async def delete(self, path: str) -> None:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                f"{self._base}/object/{_BUCKET}/{path}",
                headers=self._headers,
            )
            if resp.status_code not in (200, 404):
                resp.raise_for_status()

    async def get_signed_url(self, path: str, expires_in: int = 3600) -> str:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self._base}/object/sign/{_BUCKET}/{path}",
                json={"expiresIn": expires_in},
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()["signedURL"]
