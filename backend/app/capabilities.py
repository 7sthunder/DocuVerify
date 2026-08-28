"""Capability registry for the verification engine.

A capability is an independently executable verification unit. Universal
capabilities run for every document; domain capabilities are selected by the
document classification. Each capability is executed in isolation: a failure
produces a warning record, never a crashed pipeline.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Protocol

from .analyzers import ANALYZERS
from .analyzers.base import Analyzer
from .document import Document
from .schemas import Finding


@dataclass
class Capability:
    name: str
    label: str
    scope: str  # "universal" or "domain"
    cost: str  # "cheap" | "moderate" | "expensive"
    runner: object
    domain_types: set[str] = field(default_factory=set)

    def selected_for(self, doc: Document, type_id: str, text_hint: bool = False) -> bool:
        if self.scope == "universal":
            return True
        if type_id in self.domain_types:
            return True
        return text_hint and bool(self.domain_types)


@dataclass
class CapabilityRun:
    name: str
    label: str
    scope: str
    status: str  # "ok" | "error" | "skipped"
    duration_ms: int
    finding_count: int
    error: str | None = None

    def to_report(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "scope": self.scope,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "finding_count": self.finding_count,
            "error": self.error,
        }


class Registry:
    def __init__(self) -> None:
        self._capabilities: dict[str, Capability] = {}

    def register(
        self,
        name: str,
        label: str,
        runner: object,
        scope: str = "universal",
        cost: str = "cheap",
        domain_types: set[str] | None = None,
    ) -> Capability:
        cap = Capability(
            name=name,
            label=label,
            scope=scope,
            cost=cost,
            runner=runner,
            domain_types=domain_types or set(),
        )
        self._capabilities[name] = cap
        return cap

    def get(self, name: str) -> Capability | None:
        return self._capabilities.get(name)

    def list(self) -> list[Capability]:
        return list(self._capabilities.values())

    def select(self, doc: Document, type_id: str, text_hint: bool = False) -> list[Capability]:
        return [c for c in self._capabilities.values() if c.selected_for(doc, type_id, text_hint)]

    def run(self, capabilities: list[Capability], doc: Document) -> tuple[list[Finding], list[CapabilityRun]]:
        findings: list[Finding] = []
        runs: list[CapabilityRun] = []
        for cap in capabilities:
            start = time.perf_counter()
            try:
                produced = cap.runner.analyze(doc)
                status = "ok"
                error = None
            except Exception as exc:
                produced = []
                status = "error"
                error = f"{type(exc).__name__}: {exc}"
            duration_ms = int((time.perf_counter() - start) * 1000)
            findings.extend(produced)
            runs.append(
                CapabilityRun(
                    name=cap.name,
                    label=cap.label,
                    scope=cap.scope,
                    status=status,
                    duration_ms=duration_ms,
                    finding_count=len(produced),
                    error=error,
                )
            )
        return _dedupe(findings), runs


def _analyzer_adapter(analyzer: Analyzer):
    class _Adapter:
        name = analyzer.name
        category = analyzer.category

        def analyze(self, doc: Document) -> list[Finding]:
            return analyzer.analyze(doc)

    return _Adapter()


def _dedupe(findings: list[Finding]) -> list[Finding]:
    """Collapse findings reported identically by more than one capability
    (e.g. the semantic analyzer running both universally and as a domain
    verifier) so duplicate signals cannot double-count in the aggregator."""
    seen: set[tuple] = set()
    out: list[Finding] = []
    for f in findings:
        rk = None
        if f.region is not None:
            rk = (
                f.region.page,
                round(f.region.x, 1),
                round(f.region.y, 1),
                round(f.region.w, 1),
                round(f.region.h, 1),
            )
        key = (f.module, f.category, f.severity, f.score, tuple(f.evidence), rk)
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


class _EmbeddedImagesAdapter:
    name = "visual_analyzer"
    category = "visual"

    def analyze(self, doc: Document) -> list[Finding]:
        from .analyzers.visual import analyze_embedded_images

        return analyze_embedded_images(doc)


def default_registry() -> Registry:
    reg = Registry()
    from .verifiers import CertificateVerifier, InvoiceVerifier, MedicalVerifier, UniversalVerifier

    for analyzer in ANALYZERS:
        cost = "expensive" if analyzer.category == "visual" else ("moderate" if analyzer.category == "layout" else "cheap")
        reg.register(
            name=analyzer.category,
            label=analyzer.name,
            runner=_analyzer_adapter(analyzer),
            scope="universal",
            cost=cost,
        )
    reg.register(
        name="visual_embedded",
        label="embedded_image_analyzer",
        runner=_EmbeddedImagesAdapter(),
        scope="universal",
        cost="moderate",
    )
    reg.register(
        name="certificate_verifier",
        label="certificate_verifier",
        runner=CertificateVerifier(),
        scope="domain",
        cost="cheap",
        domain_types={"certificate", "transcript"},
    )
    reg.register(
        name="invoice_verifier",
        label="invoice_verifier",
        runner=InvoiceVerifier(),
        scope="domain",
        cost="cheap",
        domain_types={"invoice", "receipt"},
    )
    reg.register(
        name="medical_verifier",
        label="medical_verifier",
        runner=MedicalVerifier(),
        scope="domain",
        cost="cheap",
        domain_types={"medical"},
    )
    reg.register(
        name="universal_verifier",
        label="universal_verifier",
        runner=UniversalVerifier(),
        scope="universal",
        cost="cheap",
    )
    return reg
