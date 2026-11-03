#!/usr/bin/env bash
set -euo pipefail

MC_HOME="${MC_HOME:-$HOME/mission-control}"
APF_HOME="${APF_HOME:-$HOME/APF}"
SC_HOME="${SC_HOME:-$HOME/shadowcast-}"
SECRET_FILE="${SECRET_FILE:-$MC_HOME/.service-secret}"

if [ -z "${INTERNAL_SERVICE_SECRET:-}" ]; then
  if [ -f "$SECRET_FILE" ]; then
    INTERNAL_SERVICE_SECRET="$(tr -d '[:space:]' < "$SECRET_FILE")"
  else
    INTERNAL_SERVICE_SECRET="$(openssl rand -hex 32)"
    printf '%s\n' "$INTERNAL_SERVICE_SECRET" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    echo "Generated shared secret -> $SECRET_FILE"
  fi
fi
export INTERNAL_SERVICE_SECRET

echo "Starting Unloved Productions ecosystem..."

docker start apf-mysql 2>/dev/null || echo "MySQL container not running (start manually if APF needs it)"

if ! pgrep -x ollama >/dev/null; then
  echo "Starting Ollama..."
  ollama serve >/dev/null 2>&1 &
  sleep 2
fi

echo "Starting APF..."
(
  cd "$APF_HOME"
  export INTERNAL_SERVICE_SECRET
  pnpm run dev
) &
APF_PID=$!

echo "Starting ShadowCast..."
(
  cd "$SC_HOME/backend"
  source venv/bin/activate
  export INTERNAL_SERVICE_SECRET
  python3 app.py
) &
SC_PID=$!

echo "Starting Mission Control backend..."
(
  cd "$MC_HOME/backend"
  source venv/bin/activate
  export INTERNAL_SERVICE_SECRET
  uvicorn main:app --host 0.0.0.0 --port 8100
) &
MC_PID=$!

echo "Starting Mission Control frontend..."
(
  cd "$MC_HOME/frontend"
  pnpm run dev
) &
FE_PID=$!

sleep 5
echo ""
echo "Ecosystem is running:"
echo "  Mission Control: http://localhost:3100"
echo "  ShadowCast:      http://localhost:8000"
echo "  APF:             http://localhost:3000"
echo "  Ollama:          http://localhost:11434"
echo ""
echo "Shared secret exported as INTERNAL_SERVICE_SECRET"
echo "Press Ctrl+C to stop all services"

cleanup() {
  kill "$APF_PID" "$SC_PID" "$MC_PID" "$FE_PID" 2>/dev/null || true
  echo "Stopped."
}
trap cleanup EXIT
wait
