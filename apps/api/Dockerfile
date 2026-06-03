FROM python:3.13-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

COPY pyproject.toml .
RUN uv sync --no-dev --no-install-project

COPY . .
RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:$PATH"

# Bake the Presidio spaCy model into the image so PII flagging never triggers a
# runtime model download (which hangs behind the enterprise proxy). Both the API
# and the KB worker depend on this — it must be present, not fetched at runtime.
RUN python -m spacy download en_core_web_lg

EXPOSE 8001

CMD ["uvicorn", "wekala.main:app", "--host", "0.0.0.0", "--port", "8001"]
