#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== Starting LLM Text Watermarking Studio ==="

# Check virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install fastapi uvicorn numpy pydantic scipy rich llama-cpp-python
else
    source .venv/bin/activate
fi

# Function to kill child processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "1. Starting FastAPI Backend on http://127.0.0.1:8000..."
export PYTHONPATH="$DIR:$DIR/server:$PYTHONPATH"
uvicorn server.main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!


echo "2. Starting Vite Frontend on http://localhost:5173..."
cd frontend
pnpm dev --host &
FRONTEND_PID=$!

wait
