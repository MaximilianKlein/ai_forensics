import os
import sys
import json
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure server package directory is in sys.path
server_dir = str(Path(__file__).parent.resolve())
if server_dir not in sys.path:
    sys.path.insert(0, server_dir)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from llama_cpp import LogitsProcessorList

try:
    from server.watermark import (
        WatermarkConfig,
        WatermarkLogitsProcessor,
        detect_watermark,
        get_green_list,
        compute_hash_seed
    )
    from server.model_manager import ModelManager
    from server.ai_heuristics import analyze_text, get_preset_samples
    from server.detect_gpt import run_detect_gpt, get_detect_gpt_presets
    from server.delta_calibrator import (
        calibrate_model_delta,
        get_all_calibrated_deltas,
        get_model_profile,
        update_model_profile,
        format_prompt_for_model
    )
    from server.utf8_watermark import (
        embed_invisible_watermark,
        verify_invisible_watermark,
        get_utf8_presets,
        UTF8EmbedRequest,
        UTF8VerifyRequest
    )
except ImportError:
    from watermark import (
        WatermarkConfig,
        WatermarkLogitsProcessor,
        detect_watermark,
        get_green_list,
        compute_hash_seed
    )
    from model_manager import ModelManager
    from ai_heuristics import analyze_text, get_preset_samples
    from detect_gpt import run_detect_gpt, get_detect_gpt_presets
    from delta_calibrator import (
        calibrate_model_delta,
        get_all_calibrated_deltas,
        get_model_profile,
        update_model_profile,
        format_prompt_for_model
    )
    from utf8_watermark import (
        embed_invisible_watermark,
        verify_invisible_watermark,
        get_utf8_presets,
        UTF8EmbedRequest,
        UTF8VerifyRequest
    )


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("watermark_server")

app = FastAPI(title="AI Forensics API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_manager = ModelManager()

class GenerateRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = None
    max_tokens: int = 200
    temperature: float = 0.7
    top_p: float = 0.95
    gamma: float = 0.25
    delta: float = 2.0
    hash_key: int = 15485863
    context_width: int = 1
    prompt_suffix: Optional[str] = None
    disable_thinking: Optional[bool] = None

class DetectRequest(BaseModel):
    text: str
    model_name: Optional[str] = None
    gamma: float = 0.25
    hash_key: int = 15485863
    context_width: int = 1
    z_threshold: float = 3.0

class CompareRequest(BaseModel):
    prompt: str
    model_name: Optional[str] = None
    max_tokens: int = 150
    temperature: float = 0.7
    gamma: float = 0.25
    delta: float = 2.5
    hash_key: int = 15485863
    context_width: int = 1
    prompt_suffix: Optional[str] = None
    disable_thinking: Optional[bool] = None

class LoadModelRequest(BaseModel):
    model_name: str
    n_ctx: int = 2048
    n_gpu_layers: int = -1

@app.get("/api/health")
def health():
    current_model = model_manager.current_model_name
    return {
        "status": "ok",
        "loaded_model": current_model,
        "is_model_loaded": current_model is not None
    }

@app.get("/api/health")
def health_endpoint():
    status = model_manager.get_status()
    return {
        "status": "ready" if status["is_ready"] else "loading" if status["status"] == "loading" else "idle",
        "is_ready": status["is_ready"],
        "model_status": status
    }

@app.get("/api/models/status")
def model_status_endpoint():
    return model_manager.get_status()

@app.get("/api/models")
def get_models():
    models = model_manager.list_available_models()
    model_status = model_manager.get_status()
    
    # Check for demo/cloud limited capabilities notice
    demo_warning = None
    if os.environ.get("DEMO_BANNER_MESSAGE"):
        demo_warning = os.environ.get("DEMO_BANNER_MESSAGE")
    elif os.environ.get("RENDER") or os.environ.get("LIMITED_CAPABILITIES_WARNING") == "true" or os.environ.get("ALLOWED_MODELS"):
        demo_warning = "Limited AI model capabilities (0.5B) in cloud demo. Run locally with Ollama or deploy your own instance to explore full models (Gemma, LLaMA 3, DeepSeek)."

    if not models:
        allowed_env = os.environ.get("ALLOWED_MODELS", "").strip()
        if not allowed_env:
            all_configs = get_all_calibrated_deltas()
            fallback_models = []
            for name, cfg in all_configs.items():
                fallback_models.append({
                    "name": cfg.get("model_name", name),
                    "path": "",
                    "size_gb": 4.8 if "12b" in name else 1.2 if "2b" in name else 0.5,
                    "is_ollama": True,
                    "recommended_delta": cfg.get("recommended_delta", 3.0),
                    "prompt_suffix": cfg.get("prompt_suffix", "\n"),
                    "disable_thinking": cfg.get("disable_thinking", True)
                })
            return {
                "models": fallback_models,
                "current_model": model_manager.current_model_name or (fallback_models[0]["name"] if fallback_models else None),
                "demo_warning": demo_warning,
                "model_status": model_status
            }
    return {
        "models": models,
        "current_model": model_manager.current_model_name or (models[0]["name"] if models else None),
        "demo_warning": demo_warning,
        "model_status": model_status
    }

@app.post("/api/models/load")
def load_model_endpoint(req: LoadModelRequest):
    try:
        model_manager.load_model(req.model_name, n_ctx=req.n_ctx, n_gpu_layers=req.n_gpu_layers)
        return {
            "status": "success",
            "model_name": req.model_name
        }
    except Exception as e:
        logger.error(f"Failed to load model {req.model_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def ensure_model_loaded(requested_name: Optional[str] = None):
    if requested_name:
        if model_manager.current_model_name != requested_name:
            model_manager.load_model(requested_name)
    elif model_manager.current_model is None:
        models = model_manager.scan_ollama_models()
        if not models:
            raise RuntimeError("No Ollama models found on this machine.")
        model_manager.load_model(models[0].name)

@app.post("/api/generate")
async def generate_stream(req: GenerateRequest):
    try:
        ensure_model_loaded(req.model_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    llm = model_manager.current_model
    vocab_size = llm.n_vocab()

    wm_config = WatermarkConfig(
        gamma=req.gamma,
        delta=req.delta,
        hash_key=req.hash_key,
        context_width=req.context_width
    )

    processor = WatermarkLogitsProcessor(vocab_size=vocab_size, config=wm_config)
    processors = LogitsProcessorList([processor]) if req.delta > 0.0 else LogitsProcessorList([])

    target_model_name = req.model_name or model_manager.current_model_name
    effective_prompt = format_prompt_for_model(
        req.prompt,
        target_model_name,
        req.prompt_suffix,
        req.disable_thinking
    )

    async def event_generator():
        yield f"data: {json.dumps({'type': 'start', 'config': wm_config.dict(), 'vocab_size': vocab_size, 'effective_prompt': effective_prompt})}\n\n"
        
        prompt_tokens = llm.tokenize(effective_prompt.encode('utf-8'))
        all_tokens = list(prompt_tokens)
        generated_tokens = []
        green_count = 0
        h = max(1, req.context_width)

        try:
            stream = llm(
                effective_prompt,
                max_tokens=req.max_tokens,
                temperature=req.temperature,
                top_p=req.top_p,
                logits_processor=processors,
                stream=True
            )

            for chunk in stream:
                choice = chunk["choices"][0]
                text_piece = choice.get("text", "")
                
                # Check if we have token id info or need to tokenize
                # In llama-cpp-python streaming, text_piece arrives per token
                if text_piece:
                    piece_tokens = llm.tokenize(text_piece.encode('utf-8'), add_bos=False)
                    for tok_id in piece_tokens:
                        # Determine if this token was on the green list
                        ctx = all_tokens[-h:] if len(all_tokens) >= h else all_tokens
                        green_set = get_green_list(vocab_size, ctx, req.gamma, req.hash_key)
                        is_green = tok_id in green_set
                        
                        all_tokens.append(tok_id)
                        generated_tokens.append(tok_id)
                        if is_green:
                            green_count += 1
                            
                        N_eval = len(generated_tokens)
                        green_pct = (green_count / N_eval) * 100 if N_eval > 0 else 0.0
                        
                        # Calculate current z-score
                        std_dev = (N_eval * req.gamma * (1.0 - req.gamma)) ** 0.5
                        z_score = (green_count - (N_eval * req.gamma)) / std_dev if std_dev > 0 else 0.0
                        
                        token_payload = {
                            "type": "token",
                            "token_id": tok_id,
                            "text": model_manager.decode_tokens([tok_id]),
                            "is_green": is_green,
                            "green_count": green_count,
                            "total_generated": N_eval,
                            "green_fraction": round(green_pct / 100.0, 4),
                            "z_score": round(z_score, 2),
                            "finish_reason": choice.get("finish_reason")
                        }
                        yield f"data: {json.dumps(token_payload)}\n\n"
                        await asyncio.sleep(0.005)

            # Final complete stats
            full_text = model_manager.decode_tokens(generated_tokens)
            detection = detect_watermark(
                generated_tokens,
                tokenizer_decode_fn=model_manager.decode_tokens,
                vocab_size=vocab_size,
                config=wm_config
            )

            done_payload = {
                "type": "done",
                "full_text": full_text,
                "stats": detection.dict()
            }
            yield f"data: {json.dumps(done_payload)}\n\n"

        except Exception as e:
            logger.error(f"Generation error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/detect")
def detect_endpoint(req: DetectRequest):
    ensure_model_loaded(req.model_name)
    llm = model_manager.current_model
    vocab_size = llm.n_vocab()

    tokens = llm.tokenize(req.text.encode('utf-8'))
    wm_config = WatermarkConfig(
        gamma=req.gamma,
        hash_key=req.hash_key,
        context_width=req.context_width
    )

    result = detect_watermark(
        tokens=tokens,
        tokenizer_decode_fn=model_manager.decode_tokens,
        vocab_size=vocab_size,
        config=wm_config,
        z_threshold=req.z_threshold
    )

    return result.dict()

@app.post("/api/compare")
async def compare_endpoint(req: CompareRequest):
    """
    Generates two completions for the same prompt: one unwatermarked (delta=0) and one watermarked (delta > 0)
    """
    ensure_model_loaded(req.model_name)
    llm = model_manager.current_model
    vocab_size = llm.n_vocab()

    target_model_name = req.model_name or model_manager.current_model_name
    effective_prompt = format_prompt_for_model(
        req.prompt,
        target_model_name,
        req.prompt_suffix,
        req.disable_thinking
    )

    # 1. Generate unwatermarked
    unwatermarked_output = llm(
        effective_prompt,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
        logits_processor=LogitsProcessorList([])
    )
    unwatermarked_text = unwatermarked_output["choices"][0]["text"]
    unwatermarked_tokens = llm.tokenize(unwatermarked_text.encode('utf-8'), add_bos=False)

    # 2. Generate watermarked
    wm_config = WatermarkConfig(
        gamma=req.gamma,
        delta=req.delta,
        hash_key=req.hash_key,
        context_width=req.context_width
    )
    processor = WatermarkLogitsProcessor(vocab_size=vocab_size, config=wm_config)
    watermarked_output = llm(
        effective_prompt,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
        logits_processor=LogitsProcessorList([processor])
    )
    watermarked_text = watermarked_output["choices"][0]["text"]
    watermarked_tokens = llm.tokenize(watermarked_text.encode('utf-8'), add_bos=False)

    # 3. Detect on both
    unwatermarked_stats = detect_watermark(
        unwatermarked_tokens,
        tokenizer_decode_fn=model_manager.decode_tokens,
        vocab_size=vocab_size,
        config=wm_config
    )
    watermarked_stats = detect_watermark(
        watermarked_tokens,
        tokenizer_decode_fn=model_manager.decode_tokens,
        vocab_size=vocab_size,
        config=wm_config
    )

    return {
        "unwatermarked": {
            "text": unwatermarked_text,
            "stats": unwatermarked_stats.dict()
        },
        "watermarked": {
            "text": watermarked_text,
            "stats": watermarked_stats.dict()
        }
    }

@app.get("/api/benchmark/results")
def get_benchmark_results():
    results_path = os.path.join(os.path.dirname(__file__), "data", "brown_benchmark_results.json")
    if not os.path.exists(results_path):
        # Check root workspace
        results_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "server", "data", "brown_benchmark_results.json")
    
    if not os.path.exists(results_path):
        raise HTTPException(
            status_code=404, 
            detail="Benchmark results not found. Please run the benchmark script first: python scripts/benchmark_brown_corpus.py"
        )
    
    with open(results_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

@app.get("/api/benchmark/document/{doc_id}")
def get_benchmark_document_details(doc_id: str):
    clean_text = None

    # 1. Try loading via NLTK brown corpus on-demand (legally clean academic distribution)
    try:
        import nltk
        try:
            from nltk.corpus import brown
            words = brown.words(doc_id)
            if words:
                clean_text = " ".join(words[:500])
        except Exception:
            nltk.download('brown', quiet=True)
            from nltk.corpus import brown
            words = brown.words(doc_id)
            if words:
                clean_text = " ".join(words[:500])
    except Exception as e:
        logger.debug(f"NLTK brown load: {e}")

    # 2. Check local path if downloaded locally by user
    if not clean_text:
        for candidate in [
            f"brown-corpus/brown/brown/{doc_id}",
            f"brown-corpus/{doc_id}"
        ]:
            if os.path.isfile(candidate):
                try:
                    with open(candidate, 'r', encoding='utf-8', errors='ignore') as f:
                        raw_text = f.read()
                    clean_words = []
                    for line in raw_text.splitlines():
                        line = line.strip()
                        if not line:
                            continue
                        for token in line.split():
                            word = token.rsplit('/', 1)[0] if '/' in token else token
                            if word in ('``', "''"):
                                word = '"'
                            clean_words.append(word)
                    clean_text = " ".join(clean_words[:500])
                    break
                except Exception:
                    pass

    if not clean_text:
        raise HTTPException(
            status_code=404,
            detail=f"Document {doc_id} text not found. Install NLTK with `nltk.download('brown')` to inspect individual raw text transitions."
        )

    # Load benchmark metadata for hash key and model
    results_path = os.path.join(os.path.dirname(__file__), "data", "brown_benchmark_results.json")
    gamma = 0.25
    hash_key = 89173511
    model_name = "gemma4:12b"
    
    if os.path.exists(results_path):
        try:
            with open(results_path, 'r', encoding='utf-8') as f:
                bdata = json.load(f)
                gamma = bdata.get("metadata", {}).get("watermark_config", {}).get("gamma", 0.25)
                hash_key = bdata.get("metadata", {}).get("watermark_config", {}).get("hash_key", 89173511)
                model_name = bdata.get("metadata", {}).get("model_name", "gemma4:12b")
        except Exception:
            pass

    ensure_model_loaded(model_name)
    llm = model_manager.current_model
    vocab_size = llm.n_vocab()

    tokens = llm.tokenize(clean_text.encode('utf-8'), add_bos=False)
    wm_config = WatermarkConfig(gamma=gamma, delta=3.0, hash_key=hash_key, context_width=1)
    
    result = detect_watermark(
        tokens=tokens,
        tokenizer_decode_fn=model_manager.decode_tokens,
        vocab_size=vocab_size,
        config=wm_config,
        z_threshold=3.0
    )

    return {
        "doc_id": doc_id,
        "clean_text": clean_text,
        "result": result.dict()
    }

@app.get("/api/benchmark/llm/results")
def get_llm_benchmark_results():
    results_path = os.path.join(os.path.dirname(__file__), "data", "llm_benchmark_results.json")
    if not os.path.exists(results_path):
        results_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "server", "data", "llm_benchmark_results.json")
    
    if not os.path.exists(results_path):
        raise HTTPException(
            status_code=404,
            detail="LLM benchmark results not found. Please run the benchmark script first: python scripts/benchmark_llm_corpus.py"
        )
    
    with open(results_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

@app.get("/api/benchmark/watermarked/results")
def get_watermarked_benchmark_results():
    results_path = os.path.join(os.path.dirname(__file__), "data", "watermarked_eval_results.json")
    if not os.path.exists(results_path):
        results_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "server", "data", "watermarked_eval_results.json")
    
    if not os.path.exists(results_path):
        raise HTTPException(
            status_code=404,
            detail="Watermarked generation benchmark results not found. Please run: python scripts/benchmark_watermarked.py"
        )
    
    with open(results_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


class AnalyzeAIRequest(BaseModel):
    text: str
    mode: str = "wikipedia"

@app.post("/api/ai-heuristics/analyze")
def analyze_ai_writing(req: AnalyzeAIRequest):
    try:
        result = analyze_text(req.text, mode=req.mode)
        return result.dict()
    except Exception as e:
        logger.error(f"Heuristics analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai-heuristics/samples")
def get_ai_samples():
    samples = get_preset_samples()
    return [s.dict() for s in samples]


class DetectGPTRequest(BaseModel):
    text: str
    num_perturbations: int = 10
    perturbation_pct: float = 0.15
    model_name: Optional[str] = None

@app.post("/api/detect-gpt/analyze")
def analyze_detect_gpt_endpoint(req: DetectGPTRequest):
    try:
        active_model = model_manager.get_loaded_model()
        if req.model_name and (active_model is None or model_manager.current_model_name != req.model_name):
            try:
                model_manager.load_model(req.model_name)
                active_model = model_manager.get_loaded_model()
            except Exception as e:
                logger.warning(f"Could not load requested model {req.model_name}: {e}")

        result = run_detect_gpt(
            text=req.text,
            num_perturbations=req.num_perturbations,
            perturbation_pct=req.perturbation_pct,
            model=active_model
        )
        return result.dict()
    except Exception as e:
        logger.error(f"DetectGPT analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/detect-gpt/presets")
def get_detect_gpt_presets_endpoint():
    presets = get_detect_gpt_presets()
    return [p.dict() for p in presets]


@app.post("/api/utf8-watermark/embed")
def embed_utf8_watermark_endpoint(req: UTF8EmbedRequest):
    try:
        res = embed_invisible_watermark(
            text=req.text,
            payload=req.payload,
            block_word_size=req.block_word_size,
            secret_key=req.secret_key
        )
        return res.dict()
    except Exception as e:
        logger.error(f"UTF8 Watermark embedding error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/utf8-watermark/verify")
def verify_utf8_watermark_endpoint(req: UTF8VerifyRequest):
    try:
        res = verify_invisible_watermark(
            text=req.text,
            secret_key=req.secret_key
        )
        return res.dict()
    except Exception as e:
        logger.error(f"UTF8 Watermark verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/utf8-watermark/presets")
def get_utf8_presets_endpoint():
    presets = get_utf8_presets()
    return [p.dict() for p in presets]


class CalibrateDeltaRequest(BaseModel):
    model_name: Optional[str] = None

@app.post("/api/models/calibrate-delta")
def calibrate_model_delta_endpoint(req: CalibrateDeltaRequest):
    try:
        target_name = req.model_name or model_manager.current_model_name or "gemma4:12b"
        active_model = model_manager.get_loaded_model() if (model_manager.current_model_name == target_name) else None
        res = calibrate_model_delta(target_name, active_model)
        return res
    except Exception as e:
        logger.error(f"Delta calibration error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/calibrated-deltas")
def get_calibrated_deltas_endpoint():
    return get_all_calibrated_deltas()


class ModelConfigRequest(BaseModel):
    model_name: str
    recommended_delta: Optional[float] = None
    prompt_suffix: Optional[str] = None
    disable_thinking: Optional[bool] = None

@app.post("/api/models/config")
def update_model_config_endpoint(req: ModelConfigRequest):
    try:
        res = update_model_profile(
            model_name=req.model_name,
            recommended_delta=req.recommended_delta,
            prompt_suffix=req.prompt_suffix,
            disable_thinking=req.disable_thinking
        )
        return res
    except Exception as e:
        logger.error(f"Error updating model config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models/config/{model_name}")
def get_model_config_endpoint(model_name: str):
    try:
        return get_model_profile(model_name)
    except Exception as e:
        logger.error(f"Error fetching model config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Startup Model Auto-Loading
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    default_model_env = os.environ.get("DEFAULT_MODEL")
    avail = model_manager.list_available_models()
    target_model = default_model_env or (avail[0]["name"] if avail else None)

    if target_model:
        def bg_load():
            try:
                logger.info(f"Startup: Auto-loading default model '{target_model}' in background thread...")
                model_manager.load_model(target_model)
                logger.info(f"Startup: Successfully initialized '{target_model}'.")
            except Exception as e:
                logger.warning(f"Startup: Could not auto-load '{target_model}': {e}")

        t = threading.Thread(target=bg_load, daemon=True, name="StartupModelLoader")
        t.start()


# ---------------------------------------------------------------------------
# Frontend SPA Static Files Mounting (for Production / Docker / Render)
# ---------------------------------------------------------------------------
frontend_dist_candidates = [
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path("/app/frontend/dist"),
    Path("./frontend/dist")
]

dist_dir: Optional[Path] = None
for candidate in frontend_dist_candidates:
    if candidate.exists() and (candidate / "index.html").exists():
        dist_dir = candidate
        break

if dist_dir:
    logger.info(f"Mounting frontend SPA static assets from {dist_dir}")
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API routes to be bypassed
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # If full_path points to an actual file in dist, serve it
        file_path = dist_dir / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        
        # Fallback to index.html for client-side routing
        return FileResponse(dist_dir / "index.html")



