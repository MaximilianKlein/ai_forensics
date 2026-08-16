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
    CMAKE_BUILD_PARALLEL_LEVEL=1 \
    MAKEFLAGS="-j1" \
    PORT=10000 \
    HOST=0.0.0.0 \
    MODELS_DIR=/models \
    DEFAULT_MODEL=qwen2.5:0.5b \
    LLAMA_N_CTX=1024 \
    LLAMA_N_THREADS=1 \
    LLAMA_N_GPU_LAYERS=0

# Install runtime dependencies (curl for model download, libgomp1 for OpenMP, build-essential as fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies using pre-compiled wheels (avoids high-RAM source compilation)
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=100 --retries 5 --prefer-binary \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu \
    -r requirements.txt

# Download ultra-compact Qwen2.5-0.5B-Instruct in Q4_K_M GGUF format (~398 MB)
# Ideal memory footprint for Render free & starter tier allocations
RUN mkdir -p /models && \
    curl -L --retry 5 --retry-delay 2 -o /models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
    "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"

# Copy application backend source code
COPY server/ ./server/

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

# Start unified FastAPI server serving both API and React SPA
CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT}"]
