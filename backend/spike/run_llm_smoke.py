import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.pipeline import analyze_file

path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "sample_data" / "forged_demo.pdf"
with tempfile.TemporaryDirectory() as td:
    r = analyze_file(path, Path(td), run_ocr=False)

a = r["assessment"]
print(f"risk={a['risk_level']} suspicion={a['suspicion_score']} findings={len(r['findings'])}")
llm = r["llm"]
print(f"llm.enabled={llm['enabled']} error={llm['error']} llm_findings={llm['finding_count']}")
if llm.get("summary"):
    print("llm.summary:", llm["summary"])
for f in r["findings"]:
    if f["module"] == "semantic_llm":
        print(f"  [llm-{f['severity']}] region={f['region'] is not None} score={f['score']} :: {f['explanation'][:100]}")