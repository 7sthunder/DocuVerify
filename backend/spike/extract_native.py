import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
CANVAS_W = 1240


def extract_page(page):
    k = CANVAS_W / page.rect.width
    textboxes = []
    data = page.get_text("dict")
    for block in data["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                x0, y0, x1, y1 = span["bbox"]
                textboxes.append(
                    {
                        "text": span["text"],
                        "x": round(x0 * k, 2),
                        "y": round(y0 * k, 2),
                        "w": round((x1 - x0) * k, 2),
                        "h": round((y1 - y0) * k, 2),
                        "confidence": None,
                        "source": "native",
                        "font": span["font"],
                        "size": round(span["size"] * k, 2),
                        "flags": span["flags"],
                        "color": span["color"],
                    }
                )
    return textboxes


def main(path):
    doc = pymupdf.open(str(path))
    pages = []
    for i, page in enumerate(doc):
        pages.append({"page": i, "canvas_w": CANVAS_W, "textboxes": extract_page(page)})
    doc.close()

    out = ROOT / "sample_data" / "extract_native.json"
    out.write_text(json.dumps(pages, indent=2, ensure_ascii=False), encoding="utf-8")

    n = sum(len(p["textboxes"]) for p in pages)
    print(f"pages={len(pages)} textboxes={n}")
    fonts = {}
    for p in pages:
        for tb in p["textboxes"]:
            fonts[tb["font"]] = fonts.get(tb["font"], 0) + 1
    print("fonts:", fonts)
    print("wrote:", out)


if __name__ == "__main__":
    pdf = sys.argv[1] if len(sys.argv) > 1 else ROOT / "sample_data" / "genuine_cert.pdf"
    main(pdf)