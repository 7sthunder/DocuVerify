from .layout import LayoutAnalyzer
from .metadata import MetadataAnalyzer
from .semantic import SemanticAnalyzer
from .text_layer import TextLayerAnalyzer
from .typography import TypographyAnalyzer
from .visual import VisualAnalyzer, analyze_embedded_images

ANALYZERS = [
    LayoutAnalyzer(),
    TypographyAnalyzer(),
    VisualAnalyzer(),
    MetadataAnalyzer(),
    SemanticAnalyzer(),
    TextLayerAnalyzer(),
]


def run_analyzers(doc) -> list:
    findings = []
    for analyzer in ANALYZERS:
        findings.extend(analyzer.analyze(doc))
    findings.extend(analyze_embedded_images(doc))
    return findings