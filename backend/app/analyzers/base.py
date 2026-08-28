from typing import Protocol

from ..document import Document
from ..schemas import Finding


class Analyzer(Protocol):
    name: str
    category: str

    def analyze(self, doc: Document) -> list[Finding]: ...


_seed = 0


def _next_id(prefix: str) -> str:
    global _seed
    _seed += 1
    return f"{prefix}-{_seed:03d}"