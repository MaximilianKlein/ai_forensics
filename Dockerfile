# ---------------------------------------------------------------------------
# Stage 1: Build React + Vite SPA Frontend
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Install pnpm v9 matching lockfileVersion 9.0 (avoids corepack version mismatch)
RUN npm install -g pnpm@9.15.4

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 2: Python Backend Runtime with llama-cpp-python & Qwen Model
# ---------------------------------------------------------------------------
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=10000 \
    HOST=0.0.0.0 \
    MODELS_DIR=/models \
    DEFAULT_MODEL=qwen2.5:0.5b \
    LLAMA_N_CTX=1024 \
    LLAMA_N_THREADS=1 \
    LLAMA_N_GPU_LAYERS=0

# Install system dependencies (build tools for llama-cpp and curl for model download)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download ultra-compact Qwen2.5-0.5B-Instruct in Q4_K_M GGUF format (~398 MB)
# Ideal memory footprint for Render free & starter tier allocations
RUN mkdir -p /models && \
    curl -L -o /models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
    "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"

# Copy application backend source code
COPY server/ ./server/

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

# Start unified FastAPI server serving both API and React SPA
CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT}"]
