import re

PAO_PATTERNS = [
    (r"(\d+)\s*months\b", "en"),
    (r"(\d+)\s*mois\b", "fr"),
    (r"(\d+)\s*meses\b", "es"),
    (r"(\d+)\s*M\b", "short"),
]

CATEGORY_KEYWORDS = {
    "skincare": [
        # moisturizers & treatments
        "moisturizer", "moisturising", "moisturizing", "hydrating", "hydration",
        "serum", "essence", "ampoule", "booster",
        "retinol", "retinoid", "retin-a", "tretinoin", "bakuchiol",
        "vitamin c", "niacinamide", "hyaluronic acid", "glycolic acid",
        "salicylic acid", "lactic acid", "azelaic acid", "peptide",
        # sun care
        "spf", "sunscreen", "sunblock", "sun protection", "uva", "uvb",
        "broad spectrum", "mineral sunscreen",
        # cleansing
        "cleanser", "face wash", "micellar", "cleansing oil", "cleansing balm",
        "exfoliant", "exfoliator", "scrub",
        # toning & misting
        "toner", "toning", "mist", "facial mist", "setting spray",
        # eye & lip treatments (non-makeup)
        "eye cream", "eye gel", "dark circles", "under eye", "lip balm",
        "lip treatment", "lip mask",
        # masks & peels
        "face mask", "sheet mask", "clay mask", "sleeping mask",
        "peel", "peeling",
        # skin concerns
        "anti-aging", "anti-ageing", "brightening", "firming", "lifting",
        "pore", "blackhead", "acne", "blemish", "spot treatment",
        "redness", "soothing", "calming", "sensitive skin",
        # body skincare
        "body lotion", "body cream", "body oil", "body butter",
        "hand cream", "hand lotion", "foot cream",
        # ingredients that signal skincare
        "ceramide", "collagen", "elastin", "squalane", "rosehip",
        "aloe vera", "centella", "snail", "propolis",
    ],

    "haircare": [
        # wash & condition
        "shampoo", "conditioner", "co-wash", "cleansing conditioner",
        "hair wash", "scalp wash",
        # treatments
        "hair mask", "hair treatment", "deep conditioner", "hair serum",
        "hair oil", "argan oil", "keratin", "protein treatment",
        "bond repair", "olaplex",
        # styling
        "hair spray", "hairspray", "mousse", "hair gel", "pomade",
        "hair wax", "hair paste", "hair cream", "leave-in",
        "heat protectant", "heat protection", "blow dry",
        # scalp
        "scalp", "scalp serum", "scalp scrub", "dandruff", "anti-dandruff",
        "dry scalp", "scalp treatment",
        # concerns
        "frizz", "anti-frizz", "smoothing", "straightening",
        "curl", "curly hair", "wave", "defining",
        "volumizing", "volume", "thickening",
        "hair loss", "thinning hair", "hair growth",
        # color
        "color treated", "colour treated", "color protection",
        "blonde", "brunette", "silver hair",
        # ingredients that signal haircare
        "biotin", "panthenol", "dimethicone", "silicone",
    ],

    "makeup": [
        # face
        "foundation", "concealer", "contour", "contouring",
        "highlighter", "bronzer", "blush", "primer", "bb cream",
        "cc cream", "tinted moisturizer", "powder", "setting powder",
        "pressed powder", "loose powder",
        # eyes
        "mascara", "eyeliner", "eye liner", "eyeshadow", "eye shadow",
        "eyebrow", "eye brow", "brow gel", "brow pencil",
        "false lashes", "lash",
        # lips
        "lipstick", "lip gloss", "lip liner", "lip stain",
        "lip plumper", "lip color", "lip colour",
        # finish / coverage descriptors that signal makeup
        "full coverage", "buildable coverage", "long-wearing", "long lasting",
        "transfer-proof", "waterproof makeup", "matte finish",
        "dewy finish", "satin finish", "luminous",
        # removal
        "makeup remover", "micellar water", "cleansing wipe",
    ],
}


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


def classify_category(raw_text: str | None) -> tuple[str | None, str | None]:
    if not raw_text:
        return None, None

    lower = raw_text.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                return category, "keyword_match"
    return None, None


def extract_all(raw_text: str | None) -> dict:
    pao = extract_pao(raw_text)
    category, category_method = classify_category(raw_text)

    return {
        "pao_months": pao["pao_months"],
        "expiry_date": None,
        "category": category,
        "category_method": category_method,
        "extraction_method": pao["extraction_method"],
    }
