#!/usr/bin/env bash
# XO Inventory — Mac/Linux launcher
# Usage:  ./start.sh          production  →  http://localhost:7755
#         ./start.sh --dev    hot-reload dev mode

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$SCRIPT_DIR/backend"
FRONTEND="$SCRIPT_DIR/frontend"

die() { echo "❌  $1"; exit 1; }
check() { command -v "$1" &>/dev/null || die "'$1' not found. $2"; }

check node  "Install: brew install node  or  https://nodejs.org"
check python3 "Install: brew install python3"

echo "📦  Checking Python dependencies…"
python3 -m pip install -q fastapi uvicorn httpx websockets python-dotenv \
  --break-system-packages 2>/dev/null \
  || python3 -m pip install -q fastapi uvicorn httpx websockets python-dotenv

if [[ "$1" == "--dev" ]]; then
  echo ""; echo "🚀  DEV mode"
  echo "   Backend  → http://localhost:7755"
  echo "   Frontend → http://localhost:5173"; echo ""
  cd "$BACKEND" && python3 -m uvicorn api.main:app --port 7755 --reload &
  BACKEND_PID=$!
  trap "kill $BACKEND_PID 2>/dev/null" EXIT
  cd "$FRONTEND" && npm run dev
else
  echo "📦  Building frontend…"
  cd "$FRONTEND" && npm install --silent && npm run build
  echo ""; echo "🚀  XO Inventory running"
  echo "   Open → http://localhost:7755"
  echo "   Stop → Ctrl+C"; echo ""
  cd "$BACKEND" && python3 -m uvicorn api.main:app --host 0.0.0.0 --port 7755
fi
