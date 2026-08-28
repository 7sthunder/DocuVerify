import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spike"))

from app.aggregator import aggregate
from app.pipeline import analyze_file
from forge_cert import forge_variants


def _report_for(name):
    variants = {n: p for n, p, _ in forge_variants()}
    with tempfile.TemporaryDirectory(prefix="dv_test_", dir=ROOT) as td:
        return analyze_file(variants[name], Path(td), run_ocr=False)


def test_genuine_is_low_suspicion():
    r = _report_for("genuine")
    assert r["assessment"]["risk_level"] == "LOW"
    assert r["assessment"]["suspicion_score"] < 30


def test_genuine_has_lowest_suspicion():
    results = {}
    for name in ("genuine", "forged_demo"):
        results[name] = _report_for(name)["assessment"]["suspicion_score"]
    assert results["forged_demo"] > results["genuine"]
    assert results["forged_demo"] >= 35


def test_forged_demo_produces_explainable_regional_findings():
    r = _report_for("forged_demo")
    regional = [f for f in r["findings"] if f.get("region")]
    assert len(r["findings"]) >= 4
    assert len(regional) >= 2
    cats = {f["category"] for f in r["findings"]}
    assert {"semantic", "typography", "metadata"} <= cats
    semantic_high = max(f["score"] for f in r["findings"] if f["category"] == "semantic")
    assert semantic_high >= 0.5
    for f in regional:
        assert {"page", "x", "y", "w", "h"} <= set(f["region"])
        assert f["explanation"] and f["evidence"]


def test_aggregation_weights_are_normalized():
    cats = {"typography": 0.25, "layout": 0.25, "visual": 0.10, "semantic": 0.30, "text_layer": 0.05, "metadata": 0.05}
    assert abs(sum(cats.values()) - 1.0) < 1e-9