# AI Forensics

[![Author](https://img.shields.io/badge/Author-Maximilian%20Klein-blue?logo=google-chrome)](https://maximilianklein.github.io/)
[![Built with Antigravity](https://img.shields.io/badge/Built%20with-Antigravity-7C3AED?logo=google)](https://deepmind.google)
[![License: EUPL v1.2](https://img.shields.io/badge/License-EUPL%20v1.2-blue)](LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-MaximilianKlein%2Fai__forensics-181717?logo=github)](https://github.com/MaximilianKlein/ai_forensics.git)
[![Render Deployment](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render)](https://render.com)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)

An advanced, interactive LLM watermarking, steganography, probability curvature (DetectGPT), and AI stylistic forensic detection toolkit created by [Maximilian Klein](https://maximilianklein.github.io/).

1. **🔮 Statistical Token Watermarking** (Kirchenbauer et al. green/red logit biasing, generation studio, detector, side-by-side compare, tamper lab, and Brown corpus baseline benchmark).
2. **🥷 Invisible UTF-8 & Block-Based Parity** (Zero-width 4-symbol steganographic encoding, metadata payload transmission, lightweight pure-parity mode, and cryptographic block-level parity verification for exact tamper localization).
3. **⚡ DetectGPT: Perturbation Log-Probability Curvature** (Mitchell et al. zero-shot detection exploiting the local negative curvature of model probability landscapes).
4. **🔍 Signs of AI Forensic Radar & De-AI-ifier Linter** (6-axis passive stylistic and structural analyzer based on Wikipedia:Signs of AI writing with interactive sentence cadence breakdown and contextual analysis modes).
5. **📚 Comprehensive Interactive Theory & Explainer** (Comparative matrix, mathematical formulations, and step-by-step interactive breakdowns).

---

## 🤖 AI Disclosure

> **Transparency Note**: Almost the entirety of this codebase—including the FastAPI backend, React/Vite frontend interface, mathematical watermarking algorithms, DetectGPT evaluator, Wikipedia heuristic linters, Docker/Render configurations, and unit test suites—was autonomously generated and pair-programmed using **[Antigravity](https://deepmind.google)** (Google DeepMind's advanced agentic AI coding assistant) guided by Maximilian Klein. See [AI-DISCLOSURE.md](AI-DISCLOSURE.md) for full provenance details.

---

## ☁️ Render Deployment Guide

This repository is pre-configured for **1-click / Native Docker deployment on Render**.

### Option A: Deploy via GitHub Repository

1. Push this repository to your GitHub repo:
   ```bash
   git remote add origin https://github.com/MaximilianKlein/ai_forensics.git
   git branch -M main
   git push -u origin main
   ```

2. In the [Render Dashboard](https://dashboard.render.com/):
   - Click **New +** $\to$ **Web Service**.
   - Connect your GitHub repository: `MaximilianKlein/ai_forensics`.
   - Select **Docker** as the runtime.
   - Choose the **Free** or **Starter** tier.
   - Render will automatically use `Dockerfile` and build both the React SPA frontend and FastAPI backend with the pre-baked ultra-compact `Qwen2.5-0.5B-Instruct-Q4_K_M` model (~398 MB).

### Option B: Deploy with Render Blueprint (`render.yaml`)

- In Render Dashboard $\to$ **Blueprints** $\to$ Connect `MaximilianKlein/ai_forensics`.
- Render reads `render.yaml` and deploys the unified service automatically with optimal memory configurations (`LLAMA_N_CTX=1024`, `LLAMA_N_THREADS=1`).

---

## 🚀 Local Development

### 1. Requirements
- Python 3.10+
- Node.js & `pnpm`
- [Ollama](https://ollama.com/) with downloaded models (e.g. `ollama pull qwen2.5:0.5b` or `ollama pull gemma:2b`), OR standalone `.gguf` files in `./models/`.

### 2. Launch
```bash
./run.sh
```
Or run individually:
```bash
# Terminal 1 - Backend
source .venv/bin/activate
uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 - Frontend
cd frontend
pnpm dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Testing
```bash
# Backend unit tests (all 33 tests)
.venv/bin/python -m unittest discover -s tests

# Frontend typechecking and linting
cd frontend && pnpm build && npx oxlint
```

---

## 📜 License
Distributed under the **European Union Public Licence (EUPL-1.2)**. See [`LICENSE`](LICENSE) and [`AI-DISCLOSURE.md`](AI-DISCLOSURE.md) for legal terms and limitations of liability.
