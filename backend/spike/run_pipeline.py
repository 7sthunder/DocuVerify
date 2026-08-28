import json
import sys
import tempfile
from pathlib import Path

from app.pipeline import analyze_file

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main(path: Path, out: Path | None = None, ocr: bool = True) -> dict:
    with tempfile.TemporaryDirectory(prefix="dv_", dir=ROOT) as td:
        report = analyze_file(path, Path(td), run_ocr=ocr)
    if out:
        out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print("wrote:", out)
    return report


if __name__ == "__main__":
    p = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "sample_data" / "genuine_cert.pdf"
    r = main(p)
    a = r["assessment"]
    print(f"risk={a['risk_level']} suspicion={a['suspicion_score']} findings={len(r['findings'])}")
    for c in a["categories"]:
        print(f"  {c['category']:12s} {c['label']:12s} avail={c['available']} score={c['score']:.3f} n={c['findings_count']}")
    for f in r["findings"]:
        loc = f"@{f['region']['x']:.0f},{f['region']['y']:.0f}" if f["region"] else ""
        print(f"  [{f['severity']:6s}] {f['category']:10s} {f['explanation'][:60]} {loc}")