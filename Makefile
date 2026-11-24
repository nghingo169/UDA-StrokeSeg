# UDA-StrokeSeg monorepo helpers - see notes/repo_structure.md

.PHONY: dev build test lint migrate gen-types fetch-weights pacs-sim

dev:
	pnpm --filter @uda-strokeseg/web dev

build:
	pnpm --filter @uda-strokeseg/web build

lint:
	pnpm --filter @uda-strokeseg/web typecheck

# TODO: alembic -c apps/server/... upgrade head
migrate:
	@echo "TODO: run Alembic migrations for apps/server"

# Regenerate packages/common-types from FastAPI OpenAPI
gen-types:
	@echo "TODO: export OpenAPI from apps/server then openapi-typescript -> packages/common-types/src"

fetch-weights:
	python apps/ai_pipeline/scripts/fetch_weights.py

pacs-sim:
	python ops/pacs-simulator/send_study_cstore.py

test:
	@echo "TODO: pytest tests/clinical_golden tests/integration && pnpm exec playwright test tests/e2e"
