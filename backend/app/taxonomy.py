"""Document type taxonomy.

Document types are data-driven profiles, not hardcoded branches. Adding a new
type means adding an entry here (keywords, domain verifier, family) — the
classification, capability-selection and reporting layers pick it up
automatically. An UNKNOWN type is a first-class outcome: universal analysis
still runs for unrecognized documents.
"""
from dataclasses import dataclass, field


UNKNOWN = "unknown"

FAMILY_FINANCIAL = "financial"
FAMILY_COMMERCIAL = "commercial"
FAMILY_EDUCATION = "education"
FAMILY_BUSINESS = "business"
FAMILY_LEGAL = "legal"
FAMILY_IDENTITY = "identity"
FAMILY_HEALTHCARE = "healthcare"
FAMILY_LOGISTICS = "logistics"
FAMILY_PROPERTY = "property"
FAMILY_TRANSPORT = "transport"


@dataclass
class DocumentType:
    id: str
    label: str
    family: str
    keywords: list[tuple[str, float]] = field(default_factory=list)
    domain_verifiers: list[str] = field(default_factory=list)


CERT_FAMILY = {"certificate", "transcript", "tax_document"}

DOC_TYPES: dict[str, DocumentType] = {
    t.id: t
    for t in [
        DocumentType(
            "invoice",
            "Invoice",
            FAMILY_FINANCIAL,
            [
                ("tax invoice", 4.0), ("invoice", 1.5), ("invoice no", 3.0),
                ("invoice number", 3.0), ("bill to", 2.5), ("gst", 1.5),
                ("hsn", 1.5), ("sac code", 1.5), ("due date", 1.0),
                ("amount due", 2.0), ("sub total", 2.0), ("subtotal", 2.0),
                ("purchase order", 1.0), ("payment terms", 1.5),
            ],
            ["invoice_verifier"],
        ),
        DocumentType(
            "receipt",
            "Receipt",
            FAMILY_FINANCIAL,
            [
                ("receipt", 3.5), ("payment received", 3.0), ("cash memo", 3.0),
                ("paid amount", 2.0), ("thank you for your purchase", 2.0),
            ],
        ),
        DocumentType(
            "tax_document",
            "Tax Document",
            FAMILY_FINANCIAL,
            [
                ("form w-2", 6.0), ("wage and tax statement", 6.0), ("w-2", 3.0),
                ("form 16", 5.0), ("tax year", 1.5), ("employer id", 2.0),
                ("ein", 1.5), ("withholding", 2.0), ("social security wage", 3.0),
            ],
            ["certificate_verifier"],
        ),
        DocumentType(
            "certificate",
            "Certificate",
            FAMILY_EDUCATION,
            [
                ("certificate", 4.0), ("to certify", 4.0), ("certify", 2.5),
                ("awarded", 2.0), ("degree", 2.5), ("bachelor", 2.0),
                ("master of", 2.0), ("diploma", 2.5), ("graduate", 1.5),
                ("cgpa", 2.5), ("gpa", 1.5), ("semester", 1.0),
                ("registrar", 2.5), ("dean", 1.5), ("university", 1.0),
                ("institution", 1.0),
            ],
            ["certificate_verifier"],
        ),
        DocumentType(
            "transcript",
            "Transcript / Mark Sheet",
            FAMILY_EDUCATION,
            [
                ("transcript", 5.0), ("marksheet", 5.0), ("marks sheet", 5.0),
                ("statement of marks", 5.0), ("mark sheet", 5.0),
                ("course code", 3.0), ("grade", 1.5), ("credits", 2.0),
                ("cgpa", 2.0), ("examination", 1.0), ("result", 1.0),
            ],
            ["certificate_verifier"],
        ),
        DocumentType(
            "offer_letter",
            "Offer Letter",
            FAMILY_BUSINESS,
            [
                ("offer of employment", 6.0), ("offer letter", 5.0),
                ("we are pleased to offer", 4.0), ("ctc", 2.0),
                ("joining", 1.5), ("notice period", 2.0),
                ("compensation", 1.0),
            ],
        ),
        DocumentType(
            "ticket",
            "Ticket",
            FAMILY_TRANSPORT,
            [
                ("ticket", 4.0), ("ticket no", 4.0), ("boarding", 2.0),
                ("fare", 2.5), ("journey", 2.5), ("seat", 1.5), ("pnr", 3.0),
                ("passenger", 2.0), ("class:", 1.0),
            ],
        ),
        DocumentType(
            "bank_statement",
            "Bank Statement",
            FAMILY_FINANCIAL,
            [
                ("statement of account", 5.0), ("account statement", 5.0),
                ("bank statement", 5.0), ("ifsc", 3.0), ("closing balance", 3.0),
                ("opening balance", 3.0), ("available balance", 2.0),
                ("debits", 1.0), ("credits", 0.5),
            ],
        ),
        DocumentType(
            "medical",
            "Medical Document",
            FAMILY_HEALTHCARE,
            [
                ("prescription", 5.0), ("diagnosis", 3.0), ("discharge summary", 5.0),
                ("lab report", 4.0), ("patient", 2.0), ("dosage", 3.0),
                ("physician", 2.5), ("hospital", 1.5), ("referral", 1.5),
                ("medical certificate", 4.0),
            ],
            ["medical_verifier"],
        ),
        DocumentType(
            "contract",
            "Contract / Agreement",
            FAMILY_LEGAL,
            [
                ("agreement", 3.0), ("hereinafter", 3.0), ("whereas", 2.5),
                ("party of the first part", 4.0), ("terms and conditions", 2.0),
                ("witnesseth", 4.0), ("shall be governed", 2.0),
                ("power of attorney", 4.0), ("non-disclosure", 3.0),
            ],
        ),
        DocumentType(
            "identity",
            "Identity Document",
            FAMILY_IDENTITY,
            [
                ("passport", 6.0), ("date of birth", 1.5), ("place of birth", 2.5),
                ("given name", 3.0), ("surname", 2.0), ("driving licence", 5.0),
                ("driver license", 5.0), ("identity card", 4.0),
                ("residence permit", 4.0), ("visa", 1.5),
            ],
        ),
        DocumentType(
            "resume",
            "Resume / CV",
            FAMILY_BUSINESS,
            [
                ("curriculum vitae", 6.0), ("resume", 4.0),
                ("work experience", 2.5), ("skills", 1.5), ("objective", 1.0),
                ("references available", 2.0), ("education", 1.0),
            ],
        ),
    ]
}

VERIFIER_ALIASES = {"certificate_verifier", "invoice_verifier", "medical_verifier", "universal_verifier"}


def get_type(type_id: str) -> DocumentType:
    return DOC_TYPES.get(
        type_id,
        DocumentType(UNKNOWN, "Unknown", "unclassified"),
    )
