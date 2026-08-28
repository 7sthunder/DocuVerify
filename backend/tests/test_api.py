import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _upload(client, filename: str) -> dict:
    path = ROOT / "sample_data" / filename
    with open(path, "rb") as f:
        resp = client.post(
            "/api/documents",
            files={"file": (filename, f, {"pdf": "application/pdf"}.get(path.suffix, "application/octet-stream"))},
        )
    assert resp.status_code == 200, resp.text
    return resp.json()


def _wait(client, job_id: str) -> dict:
    for _ in range(240):
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("complete", "failed"):
            return job
        import time

        time.sleep(0.25)
    raise TimeoutError("job did not finish")


def test_upload_rejects_invalid_file(client):
    resp = client.post(
        "/api/documents", files={"file": ("fake.pdf", b"not a pdf", "application/pdf")}
    )
    assert resp.status_code == 400


def test_upload_genuine_low(client):
    job = _wait(client, _upload(client, "genuine_cert.pdf")["job_id"])
    assert job["status"] == "complete"
    assert job["error"] is None
    a = job["report"]["assessment"]
    assert a["risk_level"] == "LOW"
    assert a["suspicion_score"] < 30


def test_upload_forged_demo_medium(client):
    job = _wait(client, _upload(client, "forged_demo.pdf")["job_id"])
    assert job["status"] == "complete"
    a = job["report"]["assessment"]
    assert a["suspicion_score"] >= 30
    findings = job["report"]["findings"]
    regional = [f for f in findings if f.get("region")]
    assert len(findings) >= 4
    assert len(regional) >= 2


def test_upload_serves_page_image(client):
    job_id = _upload(client, "forged_demo.pdf")["job_id"]
    _wait(client, job_id)
    resp = client.get(f"/api/jobs/{job_id}/pages/page_0.png")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert len(resp.content) > 0

    bad = client.get(f"/api/jobs/{job_id}/pages/..%2F..%2Fsecrets.png")
    assert bad.status_code in (400, 404)


def test_compare_detects_template_shift(client):
    with open(ROOT / "sample_data" / "forged_shift.pdf", "rb") as d, open(
        ROOT / "sample_data" / "genuine_cert.pdf", "rb"
    ) as t:
        resp = client.post(
            "/api/compare",
            files={
                "document": ("forged_shift.pdf", d, "application/pdf"),
                "template": ("genuine_cert.pdf", t, "application/pdf"),
            },
        )
    assert resp.status_code == 200, resp.text
    job = _wait(client, resp.json()["job_id"])
    assert job["status"] == "complete"
    report = job["report"]
    assert report["reference"]["enabled"] is True
    ref = [f for f in report["findings"] if f["category"] == "reference"]
    assert len(ref) >= 1
    assert any(f.get("region") for f in ref)


def test_compare_accepts_image_template(client):
    import io

    import pymupdf
    from PIL import Image

    pdf = pymupdf.open(ROOT / "sample_data" / "genuine_cert.pdf")
    pix = pdf[0].get_pixmap(matrix=pymupdf.Matrix(0.5, 0.5), colorspace=pymupdf.csRGB, alpha=False)
    buf = io.BytesIO(pix.tobytes("png"))

    with open(ROOT / "sample_data" / "forged_shift.pdf", "rb") as d:
        resp = client.post(
            "/api/compare",
            files={
                "document": ("forged_shift.pdf", d, "application/pdf"),
                "template": ("template.png", buf.getvalue(), "image/png"),
            },
        )
    assert resp.status_code == 200, resp.text
    job = _wait(client, resp.json()["job_id"])
    assert job["status"] == "complete", job.get("error")
    assert job["report"]["reference"]["enabled"] is True