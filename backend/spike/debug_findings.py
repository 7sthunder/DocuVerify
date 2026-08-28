import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "F:/DocuVerify/backend")
sys.path.insert(0, "F:/DocuVerify/backend/spike")

from app.pipeline import analyze_file

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("sample_data/genuine_cert.pdf")
with tempfile.TemporaryDirectory() as td:
    r = analyze_file(path, Path(td), run_ocr=False)

for f in r["findings"]:
    reg = f["region"] or "-"
    print(f"[{f['severity']:6s}] cat={f['category']:9s} mod={f['module']:18s} score={f['score']:.2f} region={reg}")
    for e in f["evidence"][:1]:
        print(f"          {e}")