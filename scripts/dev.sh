#!/usr/bin/env bash
# Dev convenience: start the FastAPI backend and the Next.js frontend
# in parallel. Both stop together on Ctrl-C.
#
# Prereqs:
#   * Ollama running with a model pulled (qwen2.5:7b-instruct or similar)
#   * Backend deps installed: pip install -e .
#   * Frontend deps installed: cd frontend && npm install

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

echo ">> starting mneme backend on :8000"
(
  cd "$ROOT"
  uvicorn mneme.server.app:app --reload --port 8000 --log-level info
) &
BACKEND_PID=$!

echo ">> starting mneme frontend on :3000"
(
  cd "$ROOT/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "==============================================================="
echo "  mneme dev environment"
echo "  - backend:  http://localhost:8000  (docs: /docs)"
echo "  - frontend: http://localhost:3000"
echo "  Ctrl-C to stop both."
echo "==============================================================="
echo ""

wait $BACKEND_PID $FRONTEND_PID
