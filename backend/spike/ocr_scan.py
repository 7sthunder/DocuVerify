import json
import sys
import time
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
CANVAS_W = 1240


def main(img_path):
    t0 = time.time()
    engine = RapidOCR()
    print(f"engine load: {time.time() - t0:.2f}s")

    t0 = time.time()
    result, elapse = engine(str(img_path))
    print(f"ocr run: {time.time() - t0:.2f}s")

    textboxes = []
    for item in result or []:
        box, text, score = item
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        textboxes.append(
            {
                "text": text,
                "x": round(min(xs), 2),
                "y": round(min(ys), 2),
                "w": round(max(xs) - min(xs), 2),
                "h": round(max(ys) - min(ys), 2),
                "confidence": round(float(score), 3),
                "source": "ocr",
                "font": None,
                "size": None,
                "flags": None,
                "color": None,
            }
        )

    out = ROOT / "sample_data" / "extract_ocr.json"
    out.write_text(
        json.dumps(
            {"page": 0, "canvas_w": CANVAS_W, "textboxes": textboxes},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(f"boxes={len(textboxes)}")
    for tb in textboxes:
        print(f"  {tb['confidence']:.2f}  {tb['text']!r}  @ ({tb['x']},{tb['y']} {tb['w']}x{tb['h']})")
    print("wrote:", out)


if __name__ == "__main__":
    img = sys.argv[1] if len(sys.argv) > 1 else ROOT / "sample_data" / "genuine_cert.png"
    main(img)