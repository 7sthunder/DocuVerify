import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

CANVAS_W = 1240
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PAGES = 10
MAX_IMAGE_PIXELS = 25000000

OCR_MIN_CONF = 0.55
RELIABLE_OCR_MEAN = 0.7

WEIGHTS = {
    "typography": 0.22,
    "layout": 0.22,
    "visual": 0.08,
    "semantic": 0.20,
    "semantic_llm": 0.10,
    "text_layer": 0.08,
    "metadata": 0.10,
}
METADATA_SCORE_CAP = 0.4
LLM_SCORE_CAP = 0.5

LLM_ENABLED = os.getenv("LLM_ENABLED", "false").lower() in ("1", "true", "yes")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "minimax/minimax-m3:free")

LOW_THRESHOLD = 0.30
HIGH_THRESHOLD = 0.65

CATEGORY_LABELS = [
    ("normal", 0.15),
    ("minor", 0.35),
    ("suspicious", 0.6),
    ("anomaly", 1.01),
]

ORIGINAL_FILENAME = "original"
TEXTBOX_FONT_NAMES = ["Helvetica", "Times", "Courier", "Symbol", "ZapfDingbats"]