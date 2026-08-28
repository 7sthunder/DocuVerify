import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
key = os.environ["LLM_API_KEY"]
h = {"Authorization": f"Bearer {key}", "X-Title": "DocuVerify"}

models = ["google/gemma-4-31b-it:free", "minimax/minimax-m3:free", "nvidia/nemotron-3-super-120b-a12b:free", "z-ai/glm-5.2:free"]
for m in models:
    try:
        r = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=h,
            json={"model": m, "messages": [{"role": "user", "content": "Reply with exactly: OK"}], "max_tokens": 10},
            timeout=40,
        )
        snippet = "OK" if r.status_code == 200 else r.text[:110].replace("\n", " ")
        print(f"{m:45s} -> {r.status_code} {snippet}")
    except Exception as e:
        print(f"{m:45s} -> ERR {e}")