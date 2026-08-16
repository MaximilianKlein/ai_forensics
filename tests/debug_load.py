import sys
from llama_cpp import Llama

path = "/Users/maximilian.klein/.ollama/models/blobs/sha256-dec52a44569a2a25341c4e4d3fee25846eed4f6f0b936278e3a3c900bb99d37c"
print(f"Testing load of {path}")
try:
    with open(path, "rb") as f:
        magic = f.read(4)
        print("Magic header bytes:", magic)
except Exception as e:
    print("Could not read header:", e)

try:
    llm = Llama(model_path=path, verbose=True, n_gpu_layers=0)
    print("Success loading model! Vocab size:", llm.n_vocab())
except Exception as e:
    print("Error loading:", e)
