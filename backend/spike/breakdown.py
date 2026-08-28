import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "F:/DocuVerify/backend")
sys.path.insert(0, "F:/DocuVerify/backend/spike")

from app.aggregator import category_score
from app.config import WEIGHTS
from app.pipeline import analyze_file


def breakdown(path: Path, run_ocr: bool = True) -> None:
    with tempfile.TemporaryDirectory() as td:
        r = analyze_file(path, Path(td), run_ocr=run_ocr)

    a = r["assessment"]
    total_w = sum(WEIGHTS[c] for c in WEIGHTS)
    print(f"\n=== {path.name}  risk={a['risk_level']}  suspicion={a['suspicion_score']:.1f}  findings={len(r['findings'])}  ocr={run_ocr}")

    by_cat = {}
    for f in r["findings"]:
        bucket = "semantic_llm" if f.get("module") == "semantic_llm" else f.get("category")
        by_cat.setdefault(bucket, []).append(f)

    print(f"{'category':<14}{'label':<12}{'weight':>7}{'contrib':>9}{'score':>7}  n")
    for c in a["categories"]:
        if not c["available"]:
            print(f"{c['category']:<14}{c['label']:<12}{WEIGHTS.get(c['category'], 0):>7.2f}{'-':>9}{'-':>7}  -")
            continue
        contrib = WEIGHTS[c["category"]] / total_w * c["score"]
        print(
            f"{c['category']:<14}{c['label']:<12}{WEIGHTS[c['category']]:>7.2f}"
            f"{contrib * 100:>8.1f}%{c['score']:>7.2f}  {c['findings_count']}"
        )

    for f in r["findings"]:
        reg = f["region"] or None
        loc = f"p{reg['page']+1} x{reg['x']:.0f} y{reg['y']:.0f}" if reg else "noregion "
        print(
            f"  [{f['severity']:6s}] cat={f['category']:10s} mod={f['module']:22s} "
            f"score={f['score']:.2f} conf={f['confidence']:.2f} {loc}"
        )
        for e in f["evidence"][:1]:
            print(f"      {e}")


if __name__ == "__main__":
    runs = sys.argv[1:]
    for name in runs:
        p = Path(name)
        if not p.is_absolute():
            p = Path("sample_data") / p
        breakdown(p)