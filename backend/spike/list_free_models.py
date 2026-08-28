import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
key = os.environ["LLM_API_KEY"]
r = httpx.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {key}"}, timeout=30)
data = r.json()["data"]
free = [m for m in data if m.get("id", "").endswith(":free")]
free.sort(key=lambda m: m["id"])
for m in free[:40]:
    print(m["id"], "|", m.get("name", "")[:40])