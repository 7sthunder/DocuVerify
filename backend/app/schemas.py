from pydantic import BaseModel, Field
from typing import Literal, Optional


class Region(BaseModel):
    page: int
    x: float
    y: float
    w: float
    h: float


class TextBox(BaseModel):
    text: str
    x: float
    y: float
    w: float
    h: float
    page: int
    confidence: Optional[float] = None
    source: Literal["native", "ocr"] = "native"
    font: Optional[str] = None
    size: Optional[float] = None
    flags: Optional[int] = None
    color: Optional[int] = None


class Finding(BaseModel):
    id: str
    category: str
    module: str
    severity: Literal["low", "medium", "high"]
    score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(default=0.6, ge=0.0, le=1.0)
    region: Optional[Region] = None
    evidence: list[str] = Field(default_factory=list)
    explanation: str
    fields: dict = Field(default_factory=dict)


class CategoryStatus(BaseModel):
    category: str
    label: Literal["normal", "minor", "suspicious", "anomaly", "unavailable"]
    available: bool
    max_severity: Optional[Literal["low", "medium", "high"]] = None
    score: float = 0.0
    findings_count: int = 0


class Assessment(BaseModel):
    suspicion_score: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]
    categories: list[CategoryStatus]
    disclaimer: str = "Forensic indicators are algorithmic signals, not legal proof of forgery."