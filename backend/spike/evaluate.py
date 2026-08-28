import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spike"))

from app.pipeline import analyze_file

from forge_cert import forge_variants

MODE = "--no-ocr" in sys.argv


def main():
    print(f"mode: {'no-ocr' if MODE else 'ocr'}")
    print(f"{'variant':16s} {'risk':7s} {'score':>7s} {'n_find':>7s}  categories(score)")
    results = []
    for name, path, _ in forge_variants():
        with tempfile.TemporaryDirectory(prefix="dv_", dir=ROOT) as td:
            r = analyze_file(path, Path(td), run_ocr=not MODE)
        a = r["assessment"]
        cats = " ".join(f"{c['category'][:4]}={c['score']:.2f}" for c in a["categories"] if c["available"])
        print(f"{name:16s} {a['risk_level']:7s} {a['suspicion_score']:7.1f} {len(r['findings']):7d}  {cats}")
        results.append((name, a["risk_level"], a["suspicion_score"]))
    return results


if __name__ == "__main__":
    main()