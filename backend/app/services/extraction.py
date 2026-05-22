import re

PAO_PATTERNS = [
    (r"(\d+)\s*months\b", "en"),
    (r"(\d+)\s*mois\b", "fr"),
    (r"(\d+)\s*meses\b", "es"),
    (r"(\d+)\s*M\b", "short"),
]


def extract_pao(raw_text: str | None) -> dict:
    if not raw_text:
        return {"pao_months": None, "extraction_method": "not_found"}

    for pattern, _ in PAO_PATTERNS:
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            months = int(match.group(1))
            if 0 < months <= 120:
                return {"pao_months": months, "extraction_method": "regex_match"}

    return {"pao_months": None, "extraction_method": "not_found"}


def extract_all(raw_text: str | None) -> dict:
    pao = extract_pao(raw_text)

    return {
        "pao_months": pao["pao_months"],
        "expiry_date": None,
        "category": None,
        "category_method": None,
        "extraction_method": pao["extraction_method"],
    }
