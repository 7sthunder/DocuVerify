import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spike"))

from app.pipeline import analyze_file

from forge_w2 import forge_w2_variants


def main():
    print(f"{'variant':18s} {'risk':7s} {'score':>7s} {'n_find':>6s}  categories(score)")
    for name, path, _ in forge_w2_variants():
        with tempfile.TemporaryDirectory(prefix="dv_", dir=ROOT) as td:
            r = analyze_file(path, Path(td), run_ocr=True)
        a = r["assessment"]
        cats = " ".join(f"{c['category'][:10]}={c['score']:.2f}" for c in a["categories"] if c["available"])
        print(f"{name:18s} {a['risk_level']:7s} {a['suspicion_score']:7.1f} {len(r['findings']):6d}  {cats}")


if __name__ == "__main__":
    main()