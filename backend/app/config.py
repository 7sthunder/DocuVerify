CANVAS_W = 1240
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PAGES = 10

OCR_MIN_CONF = 0.55
RELIABLE_OCR_MEAN = 0.7

WEIGHTS = {
    "typography": 0.25,
    "layout": 0.25,
    "visual": 0.10,
    "semantic": 0.30,
    "text_layer": 0.05,
    "metadata": 0.05,
}
METADATA_SCORE_CAP = 0.4

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