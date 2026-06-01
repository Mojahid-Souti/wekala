# =============================================================================
# WEKALA PLATFORM — Makefile
# All commands run from the repo root inside WSL2.
# =============================================================================

.DEFAULT_GOAL := help
SHELL         := /bin/bash
COMPOSE       := docker compose
PROJECT_NAME  := wekala

# Load .env so secrets are available in recipe shells (e.g. make health)
-include .env
export

# Colour helpers
BOLD  := \033[1m
RESET := \033[0m
GREEN := \033[32m
CYAN  := \033[36m

##@ Help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\n$(BOLD)Usage:$(RESET)  make $(CYAN)<target>$(RESET)\n"} \
	  /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 } \
	  /^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Setup

.PHONY: setup
setup: ## First-time setup: copy .env.example → .env and generate secrets
	@if [ ! -f .env ]; then \
	  cp .env.example .env; \
	  echo "  $(GREEN)✓$(RESET) Created .env from .env.example"; \
	  echo "  $(CYAN)→$(RESET) Run 'make keygen' to fill in generated secrets, then 'make up'"; \
	else \
	  echo "  .env already exists — skipping copy"; \
	fi

.PHONY: keygen
keygen: ## Generate random secrets and Supabase JWT keys into .env
	@command -v node >/dev/null 2>&1 || { echo "node (24+) required — install via mise"; exit 1; }
	@node scripts/keygen.js

.PHONY: install-hooks
install-hooks: ## Install pre-commit hooks
	@command -v pre-commit >/dev/null 2>&1 || pip install pre-commit
	pre-commit install --hook-type commit-msg --hook-type pre-commit
	@echo "  $(GREEN)✓$(RESET) pre-commit hooks installed"

##@ Stack lifecycle

.PHONY: pull-images
pull-images: ## Pull all service images sequentially (avoids CDN EOF on parallel pulls)
	@$(COMPOSE) config --services | while read svc; do \
	  echo "  $(CYAN)→$(RESET) $$svc"; \
	  $(COMPOSE) pull $$svc; \
	done
	@echo "  $(GREEN)✓$(RESET) All images pulled — run 'make up'"

.PHONY: build-n8n-nodes
build-n8n-nodes: ## Build the n8n-nodes-wekala custom node package
	@command -v npm >/dev/null 2>&1 || { echo "npm required (Node 24 via mise)"; exit 1; }
	@cd packages/n8n-nodes-wekala && npm install --no-audit --no-fund --silent && npm run build
	@echo "  $(GREEN)✓$(RESET) n8n-nodes-wekala built — restart n8n with 'make restart-svc SVC=n8n'"

.PHONY: up
up: build-n8n-nodes ## Start the full stack (detached)
	$(COMPOSE) up -d
	@echo ""
	@echo "  $(GREEN)Stack is up. Services:$(RESET)"
	@echo "    Wekala Web       → http://localhost:3002"
	@echo "    Wekala API       → http://localhost:8001 (via Kong: http://localhost:8000/api/v1)"
	@echo "    Supabase Studio  → http://localhost:54323"
	@echo "    Supabase API     → http://localhost:8000"
	@echo "    Dify             → http://localhost:3000"
	@echo "    Langfuse         → http://localhost:3001"
	@echo "    Ollama           → http://localhost:11434"
	@echo "    Meilisearch      → http://localhost:7700"
	@echo "    n8n              → http://localhost:5678"
	@echo "    MailHog          → http://localhost:8025"

.PHONY: down
down: ## Stop the stack (volumes preserved)
	$(COMPOSE) down

.PHONY: restart
restart: ## Restart the full stack
	$(COMPOSE) restart

.PHONY: restart-svc
restart-svc: ## Restart a single service: make restart-svc SVC=ollama
	$(COMPOSE) restart $(SVC)

.PHONY: logs
logs: ## Tail logs for all services (Ctrl-C to exit)
	$(COMPOSE) logs -f

.PHONY: logs-svc
logs-svc: ## Tail logs for one service: make logs-svc SVC=dify-api
	$(COMPOSE) logs -f $(SVC)

.PHONY: clean
clean: ## Stop stack and DELETE all volumes (DESTRUCTIVE — ask first)
	@echo "$(BOLD)WARNING: This will delete ALL persistent data volumes.$(RESET)"
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1
	$(COMPOSE) down -v
	@echo "  $(GREEN)✓$(RESET) Volumes removed"

##@ Models

.PHONY: pull-models
pull-models: ## Pull default Ollama models (LLM + embeddings + reranker)
	@echo "  Pulling LLM: $${OLLAMA_DEFAULT_LLM:-qwen2.5:7b-instruct}"
	docker exec wekala-ollama ollama pull $${OLLAMA_DEFAULT_LLM:-qwen2.5:7b-instruct}
	@echo "  Pulling embeddings: $${OLLAMA_EMBEDDING_MODEL:-bge-m3}"
	docker exec wekala-ollama ollama pull $${OLLAMA_EMBEDDING_MODEL:-bge-m3}
	@echo "  Pulling reranker: $${OLLAMA_RERANKER_MODEL:-bge-reranker-v2-m3}"
	docker exec wekala-ollama ollama pull $${OLLAMA_RERANKER_MODEL:-bge-reranker-v2-m3}
	@echo "  $(GREEN)✓$(RESET) Models ready"

##@ Health

.PHONY: health
health: ## Check health of all services
	@echo ""
	@echo "$(BOLD)Service health checks:$(RESET)"
	@$(MAKE) -s _check SVC="Supabase DB"       URL="http://localhost:8000/rest/v1/"            KEY_HDR="apikey: $${SUPABASE_ANON_KEY}"
	@$(MAKE) -s _check SVC="Supabase Studio"   URL="http://localhost:54323/"
	@$(MAKE) -s _check SVC="Dify Web"          URL="http://localhost:3000"
	@$(MAKE) -s _check SVC="Langfuse"          URL="http://localhost:3001/api/public/health"
	@$(MAKE) -s _check SVC="Ollama"            URL="http://localhost:11434/"
	@$(MAKE) -s _check SVC="Meilisearch"       URL="http://localhost:7700/health"
	@$(MAKE) -s _check SVC="n8n"               URL="http://localhost:5678/healthz"
	@$(MAKE) -s _check SVC="MailHog"           URL="http://localhost:8025"
	@$(MAKE) -s _check SVC="Wekala API"        URL="http://localhost:8001/healthz"
	@$(MAKE) -s _check SVC="Wekala Web"        URL="http://localhost:3002/"
	@$(MAKE) -s _check SVC="OPA"               URL="http://localhost:8181/health"
	@printf "  %-20s " "OPA policies"; \
	  if curl -s --connect-timeout 5 --max-time 10 http://localhost:8181/v1/policies 2>/dev/null | grep -q '"id"'; then \
	    printf "$(GREEN)✓$(RESET) loaded\n"; \
	  else \
	    printf "✗ %-18s none loaded — run: docker compose restart opa\n" ""; \
	  fi
	@echo ""

.PHONY: _check
_check:
	@if [ -n "$(KEY_HDR)" ]; then \
	  STATUS=$$(curl -s --connect-timeout 5 --max-time 10 -o /dev/null -w "%{http_code}" -H "$(KEY_HDR)" "$(URL)" 2>/dev/null); \
	else \
	  STATUS=$$(curl -s --connect-timeout 5 --max-time 10 -o /dev/null -w "%{http_code}" "$(URL)" 2>/dev/null); \
	fi; \
	if [ "$$STATUS" -ge 200 ] && [ "$$STATUS" -lt 400 ]; then \
	  printf "  $(GREEN)✓$(RESET) %-20s HTTP $$STATUS\n" "$(SVC)"; \
	else \
	  printf "  ✗ %-20s HTTP $$STATUS (expected 2xx/3xx)\n" "$(SVC)"; \
	fi

##@ Database

.PHONY: migrate
migrate: ## Run Alembic migrations (requires running supabase-db)
	@command -v uv >/dev/null 2>&1 || { echo "uv required — see mise config"; exit 1; }
	@cd apps/api && uv run alembic upgrade head
	@echo "  $(GREEN)✓$(RESET) Migrations applied"

.PHONY: migrate-down
migrate-down: ## Roll back last Alembic migration
	@cd apps/api && uv run alembic downgrade -1

.PHONY: seed
seed: ## Seed the database with dev data
	@echo "  No seed data for Phase 1 — workspaces are created via the API"

##@ Code quality

.PHONY: lint
lint: lint-py lint-ts ## Run all linters

.PHONY: lint-py
lint-py: ## Lint and format Python with Ruff
	@if [ -d apps/api ]; then \
	  ruff check apps/api && ruff format --check apps/api; \
	else \
	  echo "  No Python app yet (Phase 1)"; \
	fi

.PHONY: lint-ts
lint-ts: ## Lint and format TypeScript with Biome
	@if [ -d apps/web ]; then \
	  pnpm --filter web biome check .; \
	else \
	  echo "  No TS app yet (Phase 1)"; \
	fi

.PHONY: format
format: ## Auto-fix formatting (Python + TypeScript)
	@if [ -d apps/api ]; then ruff format apps/api; fi
	@if [ -d apps/web ]; then pnpm --filter web biome format --write .; fi

##@ Testing

.PHONY: test
test: test-phase-0 test-phase-1 test-phase-2 test-phase-3 test-phase-4 test-phase-5 test-phase-6 test-phase-7 test-phase-8 test-py test-ts ## Run all tests

.PHONY: test-phase-0
test-phase-0: ## Run Phase 0 automated integration tests (requires running stack)
	@bash scripts/test-phase-0.sh

.PHONY: test-phase-1
test-phase-1: ## Run Phase 1 integration tests (requires running stack + migrations)
	@bash scripts/test-phase-1.sh

.PHONY: test-phase-2
test-phase-2: ## Verify Phase 2 required files are present and unit tests pass
	@echo "$(BOLD)Phase 2 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/adapters/agent_runtime/base.py" \
	  "apps/api/wekala/adapters/agent_runtime/dify.py" \
	  "apps/api/wekala/core/utils/yaml_validator.py" \
	  "apps/api/wekala/db/repositories/agent.py" \
	  "apps/api/wekala/db/repositories/agent_version.py" \
	  "apps/api/wekala/db/repositories/agent_import.py" \
	  "apps/api/wekala/services/agent_service.py" \
	  "apps/api/wekala/api/v1/agents.py" \
	  "apps/api/alembic/versions/0005_agents.py" \
	  "apps/api/alembic/versions/0006_agent_versions.py" \
	  "apps/api/alembic/versions/0007_agent_imports.py" \
	  "apps/api/wekala/templates/customer_support.yaml" \
	  "apps/api/tests/test_agents.py" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/agents/page.tsx" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/agents/new/page.tsx" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/agents/[agentId]/page.tsx" \
	  "apps/web/components/agent/agent-card.tsx" \
	  "apps/web/components/agent/agent-status-badge.tsx" \
	  "apps/web/components/agent/version-list.tsx" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 2 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 2 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_agents.py -v

.PHONY: test-phase-3
test-phase-3: ## Verify Phase 3 required files are present and unit tests pass
	@echo "$(BOLD)Phase 3 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/db/repositories/hire.py" \
	  "apps/api/wekala/db/repositories/review.py" \
	  "apps/api/wekala/db/repositories/category.py" \
	  "apps/api/wekala/db/repositories/bazaar.py" \
	  "apps/api/wekala/adapters/search/base.py" \
	  "apps/api/wekala/adapters/search/meilisearch.py" \
	  "apps/api/wekala/services/bazaar_service.py" \
	  "apps/api/wekala/api/v1/bazaar.py" \
	  "apps/api/alembic/versions/0008_hires.py" \
	  "apps/api/alembic/versions/0009_reviews.py" \
	  "apps/api/alembic/versions/0010_categories.py" \
	  "apps/api/tests/test_bazaar.py" \
	  "apps/web/app/(app)/bazaar/page.tsx" \
	  "apps/web/app/(app)/bazaar/[agentId]/page.tsx" \
	  "apps/web/app/(app)/bazaar/hired/page.tsx" \
	  "apps/web/components/bazaar/bazaar-agent-card.tsx" \
	  "apps/web/components/bazaar/hire-button.tsx" \
	  "apps/web/components/bazaar/rating-stars.tsx" \
	  "apps/web/components/bazaar/review-form.tsx" \
	  "apps/web/components/bazaar/search-bar.tsx" \
	  "apps/web/components/bazaar/category-filter.tsx" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 3 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 3 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_bazaar.py -v

.PHONY: test-phase-4
test-phase-4: ## Verify Phase 4 required files are present and unit tests pass
	@echo "$(BOLD)Phase 4 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/adapters/document_processor/base.py" \
	  "apps/api/wekala/adapters/document_processor/pypdf_adapter.py" \
	  "apps/api/wekala/adapters/embedding/base.py" \
	  "apps/api/wekala/adapters/embedding/ollama.py" \
	  "apps/api/wekala/adapters/virus_scanner/base.py" \
	  "apps/api/wekala/adapters/virus_scanner/clamav.py" \
	  "apps/api/wekala/adapters/storage/base.py" \
	  "apps/api/wekala/adapters/storage/supabase.py" \
	  "apps/api/wekala/db/repositories/knowledge_base.py" \
	  "apps/api/wekala/services/kb_service.py" \
	  "apps/api/wekala/api/v1/knowledge_base.py" \
	  "apps/api/alembic/versions/0011_knowledge_bases.py" \
	  "apps/api/alembic/versions/0012_kb_chunks.py" \
	  "apps/api/tests/test_kb.py" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/knowledge-base/page.tsx" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/knowledge-base/[kbId]/upload/page.tsx" \
	  "apps/web/components/kb/document-card.tsx" \
	  "apps/web/components/kb/upload-form.tsx" \
	  "apps/web/components/kb/search-results.tsx" \
	  "docs/phases/MANUAL_TEST_PHASE_4.md" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 4 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 4 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_kb.py -v

.PHONY: test-phase-5
test-phase-5: ## Verify Phase 5 required files are present and unit tests pass
	@echo "$(BOLD)Phase 5 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/core/security/ssrf_guard.py" \
	  "apps/api/wekala/adapters/mcp/base.py" \
	  "apps/api/wekala/adapters/mcp/http_client.py" \
	  "apps/api/wekala/db/repositories/mcp_server.py" \
	  "apps/api/wekala/services/tool_service.py" \
	  "apps/api/wekala/api/v1/tools.py" \
	  "apps/api/alembic/versions/0015_tools_and_mcp.py" \
	  "apps/api/tests/test_ssrf_guard.py" \
	  "packages/mcp-servers/time/main.py" \
	  "packages/mcp-servers/time/Dockerfile" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/tools/page.tsx" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/tools/mcp-servers/page.tsx" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/agents/[agentId]/tools/page.tsx" \
	  "docs/phases/MANUAL_TEST_PHASE_5.md" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 5 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 5 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_ssrf_guard.py -v

.PHONY: test-phase-6
test-phase-6: ## Verify Phase 6 required files are present and unit tests pass
	@echo "$(BOLD)Phase 6 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/adapters/scanner/base.py" \
	  "apps/api/wekala/adapters/scanner/pii.py" \
	  "apps/api/wekala/adapters/scanner/prompt_injection.py" \
	  "apps/api/wekala/adapters/scanner/recognizers/oman.py" \
	  "apps/api/wekala/core/policies/classification_policy.py" \
	  "apps/api/wekala/db/repositories/vetting.py" \
	  "apps/api/wekala/services/vetting_service.py" \
	  "apps/api/wekala/api/v1/vetting.py" \
	  "apps/api/alembic/versions/0016_vetting.py" \
	  "apps/api/tests/test_pii_scanner.py" \
	  "apps/api/tests/test_injection_scanner.py" \
	  "infra/policies/classification.yaml" \
	  "apps/web/components/vetting/vetting-status-badge.tsx" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/agents/[agentId]/vetting/page.tsx" \
	  "docs/phases/MANUAL_TEST_PHASE_6.md" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 6 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 6 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_pii_scanner.py tests/test_injection_scanner.py -v

.PHONY: test-phase-7
test-phase-7: ## Verify Phase 7 required files are present and unit tests pass
	@echo "$(BOLD)Phase 7 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/adapters/auth/api_key.py" \
	  "apps/api/wekala/services/rate_limit_service.py" \
	  "apps/api/wekala/services/public_invocation_service.py" \
	  "apps/api/wekala/services/webhook_service.py" \
	  "apps/api/wekala/api/v1/public.py" \
	  "apps/api/wekala/api/v1/webhooks.py" \
	  "apps/api/alembic/versions/0017_public_api.py" \
	  "apps/api/tests/test_webhook_sign.py" \
	  "packages/sdk-py/wekala/__init__.py" \
	  "packages/sdk-py/pyproject.toml" \
	  "packages/sdk-py/README.md" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/settings/developer/page.tsx" \
	  "docs/phases/MANUAL_TEST_PHASE_7.md" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 7 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 7 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_webhook_sign.py -v

.PHONY: sdk-py
sdk-py: ## Install the local Python SDK in editable mode
	@cd packages/sdk-py && uv pip install -e .
	@echo "  $(GREEN)✓$(RESET) wekala (Python SDK) installed editable"

.PHONY: test-phase-8
test-phase-8: ## Verify Phase 8 required files are present and unit tests pass
	@echo "$(BOLD)Phase 8 file validation:$(RESET)"
	@missing=0; \
	files=( \
	  "apps/api/wekala/services/analytics_service.py" \
	  "apps/api/wekala/services/anomaly_service.py" \
	  "apps/api/wekala/core/policies/analytics_policies.py" \
	  "apps/api/wekala/api/v1/analytics.py" \
	  "apps/api/alembic/versions/0018_analytics.py" \
	  "apps/api/tests/test_anomaly.py" \
	  "infra/policies/hours_saved.yaml" \
	  "infra/policies/anomalies.yaml" \
	  "apps/web/app/(app)/workspaces/[workspaceId]/command-center/page.tsx" \
	  "docs/phases/MANUAL_TEST_PHASE_8.md" \
	); \
	for f in "$${files[@]}"; do \
	  if [ ! -f "$$f" ]; then echo "  MISSING: $$f"; missing=$$((missing+1)); \
	  else echo "  $(GREEN)✓$(RESET) $$f"; fi; \
	done; \
	[ "$$missing" -eq 0 ] && echo "$(GREEN)All Phase 8 files present.$(RESET)" || { echo "$(BOLD)$$missing file(s) missing.$(RESET)"; exit 1; }
	@echo ""
	@echo "$(BOLD)Phase 8 unit tests:$(RESET)"
	@cd apps/api && uv run pytest tests/test_anomaly.py -v

.PHONY: mv-refresh
mv-refresh: ## Manually refresh the analytics materialized view
	@docker exec wekala-supabase-db psql -U postgres -d postgres -c "REFRESH MATERIALIZED VIEW mv_workspace_daily;"
	@echo "  $(GREEN)✓$(RESET) mv_workspace_daily refreshed"

.PHONY: test-py
test-py: ## Run Python unit tests with pytest
	@cd apps/api && uv run pytest tests/ -v

.PHONY: test-ts
test-ts: ## Run TypeScript tests with Vitest
	@pnpm --filter wekala-web run test

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests with Playwright (Phase 3+)
	@echo "No e2e tests yet (Phase 3)."

##@ Security

.PHONY: secret-scan
secret-scan: ## Run gitleaks secret scan on working tree
	gitleaks detect --source . --verbose
