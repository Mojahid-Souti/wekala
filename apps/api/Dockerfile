FROM python:3.13-slim

WORKDIR /app

# Install uv
RUN pip install --no-cache-dir uv

COPY pyproject.toml .
RUN uv sync --no-dev --no-install-project

COPY . .
RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8001

CMD ["uvicorn", "wekala.main:app", "--host", "0.0.0.0", "--port", "8001"]
