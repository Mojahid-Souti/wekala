FROM python:3.13-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

COPY pyproject.toml .
RUN uv sync --no-dev --no-install-project

ENV PATH="/app/.venv/bin:$PATH"

# Best-effort: bake the Presidio spaCy model so PII flagging works out of the box.
# NON-FATAL — behind a TLS-intercepting corporate proxy the GitHub model download
# fails (CERTIFICATE_VERIFY_FAILED), so we must not make the build depend on it.
# When the model is absent the app degrades gracefully (PII flag no-ops; the
# runtime checks `is_package` before loading, so it never tries to download/hang).
# Placed before the app COPY so the layer caches across code changes.
RUN python -m spacy download en_core_web_lg \
    || echo "spaCy model not baked (offline/proxy) — PII flagging will no-op until provisioned"

COPY . .
RUN uv sync --no-dev

EXPOSE 8001

CMD ["uvicorn", "wekala.main:app", "--host", "0.0.0.0", "--port", "8001"]
