# mneme dev workflow. `make help` lists every target.
#
# Usage examples:
#   make install        # editable install plus dev extras
#   make test           # pytest (no GPU, no Ollama)
#   make lint           # ruff
#   make typecheck      # mypy
#   make coverage       # pytest with coverage report
#   make demo           # mneme demo (mock LLM, no Ollama needed)
#   make frontend       # frontend build (next.js)
#   make clean          # remove caches and generated artefacts

PY ?= python
PIP ?= $(PY) -m pip
PYTEST ?= $(PY) -m pytest
RUFF ?= $(PY) -m ruff
MYPY ?= $(PY) -m mypy

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Editable install with dev + embeddings extras.
	$(PIP) install -e ".[dev,embeddings]"

.PHONY: test
test: ## Run the pytest suite (offline; no GPU, no Ollama).
	$(PYTEST) tests/ -q

.PHONY: lint
lint: ## Run ruff in check mode.
	$(RUFF) check src/ tests/ examples/

.PHONY: lint-fix
lint-fix: ## Run ruff with autofix on src + tests + examples.
	$(RUFF) check --fix src/ tests/ examples/

.PHONY: typecheck
typecheck: ## Run mypy against the library.
	$(MYPY) src/mneme

.PHONY: coverage
coverage: ## Run pytest with branch coverage.
	$(PYTEST) tests/ --cov=mneme --cov-report=term-missing --cov-report=xml

.PHONY: demo
demo: ## Run the end-to-end demo (uses MockBackend; no Ollama required).
	$(PY) -m mneme demo

.PHONY: doctor
doctor: ## Diagnose local Ollama / AnkiConnect / optional-dep setup.
	$(PY) -m mneme doctor

.PHONY: frontend
frontend: ## Build the Next.js frontend.
	cd frontend && npm ci && npm run build

.PHONY: frontend-dev
frontend-dev: ## Run the Next.js frontend in dev mode.
	cd frontend && npm run dev

.PHONY: dev
dev: ## Start the FastAPI backend + Next.js frontend together.
	bash scripts/dev.sh

.PHONY: clean
clean: ## Remove caches and build artefacts.
	rm -rf build/ dist/ *.egg-info src/*.egg-info
	rm -rf .pytest_cache .mypy_cache .ruff_cache .coverage coverage.xml htmlcov
	rm -rf .ipynb_checkpoints
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf frontend/.next frontend/out
