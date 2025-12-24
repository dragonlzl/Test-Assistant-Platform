#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON="${PYTHON:-python3}"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "Python 3 not found. Please install Python 3 and retry."
  exit 1
fi

if [ ! -d ".venv" ]; then
  "$PYTHON" -m venv .venv
fi

VENV_PY=".venv/bin/python"
if [ ! -x "$VENV_PY" ]; then
  echo "Virtualenv missing at .venv/bin/python."
  exit 1
fi

"$VENV_PY" -m pip install -r requirements.txt

: "${APP_DB_FILE:=app.db}"
: "${API_HOST:=0.0.0.0}"
: "${API_PORT:=8080}"
: "${RELOAD:=1}"

export APP_DB_FILE
if [ -n "${ADMIN_USER:-}" ]; then export ADMIN_USER; fi
if [ -n "${ADMIN_PASS:-}" ]; then export ADMIN_PASS; fi
if [ -n "${DEFAULT_USER_PASS:-}" ]; then export DEFAULT_USER_PASS; fi

args=(--host "$API_HOST" --port "$API_PORT")
if [ "$RELOAD" = "1" ]; then
  args+=(--reload)
fi

echo "Starting API on http://${API_HOST}:${API_PORT} (DB: ${APP_DB_FILE})"
exec "$VENV_PY" -m uvicorn backend.main:app "${args[@]}"
