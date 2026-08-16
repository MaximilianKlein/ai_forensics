import os
import glob
import json
import fnmatch
import logging
from typing import List, Dict, Any, Optional
from llama_cpp import Llama

logger = logging.getLogger(__name__)

try:
    from server.delta_calibrator import get_model_profile
except ImportError:
    from delta_calibrator import get_model_profile

class ModelInfo:
    def __init__(self, name: str, path: str, size_gb: float, is_ollama: bool = True):
        self.name = name
        self.path = path
        self.size_gb = size_gb
        self.is_ollama = is_ollama
        profile = get_model_profile(name)
        self.recommended_delta = profile.get("recommended_delta", 3.0)
        self.prompt_suffix = profile.get("prompt_suffix", "\n")
        self.disable_thinking = profile.get("disable_thinking", True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "size_gb": self.size_gb,
            "is_ollama": self.is_ollama,
            "recommended_delta": self.recommended_delta,
            "prompt_suffix": self.prompt_suffix,
            "disable_thinking": self.disable_thinking
        }

import threading

class ModelManager:
    def __init__(self):
        self.current_model: Optional[Llama] = None
        self.current_model_name: Optional[str] = None
        self.current_model_path: Optional[str] = None
        self.is_loading: bool = False
        self.loading_model_name: Optional[str] = None
        self.load_error: Optional[str] = None
        self._load_lock = threading.Lock()

    def get_status(self) -> Dict[str, Any]:
        if self.is_loading:
            return {
                "status": "loading",
                "is_ready": False,
                "current_model": self.current_model_name,
                "loading_model": self.loading_model_name,
                "error": None
            }
        elif self.current_model is not None:
            return {
                "status": "ready",
                "is_ready": True,
                "current_model": self.current_model_name,
                "loading_model": None,
                "error": None
            }
        elif self.load_error:
            return {
                "status": "error",
                "is_ready": False,
                "current_model": None,
                "loading_model": None,
                "error": self.load_error
            }
        else:
            return {
                "status": "idle",
                "is_ready": False,
                "current_model": None,
                "loading_model": None,
                "error": None
            }

    def scan_directory_models(self) -> List[ModelInfo]:
        """
        Scans standalone .gguf model files in configured or standard model directories
        (e.g., /models, ./models, or MODELS_DIR env var).
        """
        candidate_dirs = [
            os.environ.get("MODELS_DIR", ""),
            "/models",
            "./models",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
        ]
        models_dict: Dict[str, ModelInfo] = {}

        for c_dir in candidate_dirs:
            if not c_dir or not os.path.exists(c_dir) or not os.path.isdir(c_dir):
                continue

            for ext in ("*.gguf", "*.bin"):
                for model_file in glob.glob(os.path.join(c_dir, ext)):
                    if not os.path.isfile(model_file):
                        continue
                    
                    basename = os.path.basename(model_file)
                    size_gb = round(os.path.getsize(model_file) / (1024**3), 2)
                    
                    if basename not in models_dict:
                        models_dict[basename] = ModelInfo(
                            basename,
                            os.path.abspath(model_file),
                            size_gb,
                            is_ollama=False
                        )

        return list(models_dict.values())

    def scan_ollama_models(self) -> List[ModelInfo]:
        """
        Discovers models managed by Ollama by reading the manifest directory.
        Deduplicates by model name and blob path.
        """
        manifest_dir = os.path.expanduser("~/.ollama/models/manifests")
        blobs_dir = os.path.expanduser("~/.ollama/models/blobs")
        models_dict: Dict[str, ModelInfo] = {}

        if not os.path.exists(manifest_dir):
            return []

        for root, _, files in os.walk(manifest_dir):
            for file in files:
                manifest_path = os.path.join(root, file)
                try:
                    with open(manifest_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    rel_name = os.path.relpath(manifest_path, manifest_dir)
                    clean_name = (
                        rel_name.replace("registry.ollama.ai/library/", "")
                        .replace("registry.ollama.ai/", "")
                        .replace("/", ":")
                    )

                    for layer in data.get("layers", []):
                        if layer.get("mediaType") == "application/vnd.ollama.image.model":
                            digest = layer.get("digest", "").replace("sha256:", "sha256-")
                            blob_path = os.path.join(blobs_dir, digest)
                            if os.path.exists(blob_path) and clean_name not in models_dict:
                                size_gb = round(os.path.getsize(blob_path) / (1024**3), 2)
                                models_dict[clean_name] = ModelInfo(clean_name, blob_path, size_gb, is_ollama=True)
                except Exception as e:
                    logger.debug(f"Skipping {manifest_path}: {e}")

        result = list(models_dict.values())
        result.sort(key=lambda m: (m.size_gb, m.name))
        return result

    def list_available_models(self) -> List[Dict[str, Any]]:
        dir_models = self.scan_directory_models()
        ollama_models = self.scan_ollama_models()

        seen_paths = set()
        seen_names = set()
        combined: List[ModelInfo] = []

        for m in dir_models + ollama_models:
            if m.path not in seen_paths and m.name not in seen_names:
                seen_paths.add(m.path)
                seen_names.add(m.name)
                combined.append(m)

        # Environment variable filter: ALLOWED_MODELS
        allowed_env = os.environ.get("ALLOWED_MODELS", "").strip()
        if allowed_env:
            allowed_patterns = [p.strip().lower() for p in allowed_env.split(",") if p.strip()]
            filtered = []
            for m in combined:
                m_name_lower = m.name.lower()
                m_path_base_lower = os.path.basename(m.path).lower()
                for pat in allowed_patterns:
                    if (
                        pat == m_name_lower
                        or pat == m_path_base_lower
                        or pat in m_name_lower
                        or pat in m_path_base_lower
                        or fnmatch.fnmatch(m_name_lower, pat)
                        or fnmatch.fnmatch(m_path_base_lower, pat)
                    ):
                        filtered.append(m)
                        break
            combined = filtered

        combined.sort(key=lambda m: (m.size_gb, m.name))
        return [m.to_dict() for m in combined]

    def load_model(self, model_name_or_path: str, n_ctx: Optional[int] = None, n_gpu_layers: Optional[int] = None) -> Llama:
        """
        Loads a GGUF model into memory with thread safety and readiness state tracking.
        """
        target_path = model_name_or_path
        all_models = self.scan_directory_models() + self.scan_ollama_models()

        if not os.path.isfile(model_name_or_path):
            for m in all_models:
                if (
                    m.name == model_name_or_path
                    or m.name.startswith(model_name_or_path)
                    or os.path.basename(m.path) == model_name_or_path
                    or os.path.splitext(os.path.basename(m.path))[0] == model_name_or_path
                ):
                    target_path = m.path
                    break

        if not os.path.isfile(target_path):
            raise FileNotFoundError(f"Model file not found for '{model_name_or_path}' at '{target_path}'")

        if self.current_model is not None and self.current_model_path == target_path:
            return self.current_model

        with self._load_lock:
            if self.current_model is not None and self.current_model_path == target_path:
                return self.current_model

            self.is_loading = True
            self.loading_model_name = model_name_or_path
            self.load_error = None

            try:
                if self.current_model is not None:
                    del self.current_model
                    self.current_model = None

                effective_n_ctx = n_ctx if n_ctx is not None else int(os.environ.get("LLAMA_N_CTX", 2048))
                effective_n_gpu_layers = n_gpu_layers if n_gpu_layers is not None else int(os.environ.get("LLAMA_N_GPU_LAYERS", -1))
                effective_n_threads = int(os.environ.get("LLAMA_N_THREADS", max(1, os.cpu_count() or 1)))

                logger.info(f"Loading model from {target_path} (n_ctx={effective_n_ctx}, n_threads={effective_n_threads}, n_gpu_layers={effective_n_gpu_layers})...")
                
                self.current_model = Llama(
                    model_path=target_path,
                    n_ctx=effective_n_ctx,
                    n_threads=effective_n_threads,
                    n_gpu_layers=effective_n_gpu_layers,
                    verbose=False
                )
                self.current_model_path = target_path
                self.current_model_name = model_name_or_path

                # Execute a lightweight warmup forward pass to fault memory pages and compile inference graph
                try:
                    logger.info(f"Executing warmup inference pass for '{model_name_or_path}'...")
                    _ = self.current_model("Hello", max_tokens=2, temperature=0.0, echo=False)
                    logger.info(f"Warmup forward pass complete for '{model_name_or_path}'.")
                except Exception as we:
                    logger.warning(f"Non-fatal warmup generation warning for '{model_name_or_path}': {we}")

                self.is_loading = False
                self.loading_model_name = None
                return self.current_model
            except Exception as e:
                self.is_loading = False
                self.loading_model_name = None
                self.load_error = str(e)
                err_msg = str(e)
                if "dimension_sections" in err_msg or "hyperparameters" in err_msg or "architecture" in err_msg:
                    raise ValueError(
                        f"Model '{model_name_or_path}' has an experimental or vision architecture unsupported by current llama.cpp. "
                        f"Please select a standard text model (e.g. qwen2.5:0.5b, llama3.2, mistral)."
                    ) from e
                raise e

    def get_loaded_model(self) -> Optional[Llama]:
        return self.current_model

    def decode_token(self, token_id: int) -> str:
        if not self.current_model:
            return ""
        try:
            return self.current_model.detokenize([token_id]).decode('utf-8', errors='replace')
        except Exception:
            return ""

    def decode_tokens(self, token_ids: List[int]) -> str:
        if not self.current_model:
            return ""
        try:
            return self.current_model.detokenize(token_ids).decode('utf-8', errors='replace')
        except Exception:
            return ""

    def tokenize(self, text: str) -> List[int]:
        if not self.current_model:
            raise RuntimeError("No model is loaded")
        return self.current_model.tokenize(text.encode('utf-8'))
