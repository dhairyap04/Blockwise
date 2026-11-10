"""Interpret queries into a validated, typed filter; never execute generated code."""
import json
import math
import os
import re
import requests

NUMERIC = {"height", "height_m", "assessed_value"}
TEXT = {"zoning", "address", "stage", "assessment_class"}
ALIASES = {"height_ft": "height", "value": "assessed_value", "property_value": "assessed_value"}
NUMBER = r"(\d[\d,]*(?:\.\d+)?)\s*(million|billion|thousand|[kmb]\b)?"


def normalize_zone(value):
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def validate_filter(filt, nested=False):
    if not isinstance(filt, dict):
        raise ValueError("Filters must be a JSON object.")
    if "conditions" in filt:
        conditions = filt["conditions"]
        if nested or filt.get("logic") not in ("and", "or") or not isinstance(conditions, list) or not 1 <= len(conditions) <= 8:
            raise ValueError("Use up to eight conditions joined by AND or OR.")
        return {"logic": filt["logic"], "conditions": [validate_filter(c, True) for c in conditions]}
    attribute = filt.get("attribute")
    if not isinstance(attribute, str) or not isinstance(filt.get("operator"), str):
        raise ValueError("A filter requires a text attribute and operator.")
    attr = ALIASES.get(attribute, attribute)
    op, value = filt.get("operator"), filt.get("value")
    if attr not in NUMERIC | TEXT:
        raise ValueError("Unsupported filter attribute.")
    if attr in NUMERIC:
        if op not in ("=", ">", "<", ">=", "<=") or isinstance(value, bool):
            raise ValueError("Use =, >, <, >= or <= with a number.")
        try:
            value = float(str(value).replace(",", ""))
        except (TypeError, ValueError) as exc:
            raise ValueError("A numeric filter requires a number.") from exc
        if not math.isfinite(value) or value < 0:
            raise ValueError("Use a finite, non-negative number.")
    else:
        if not isinstance(value, str) or not value.strip() or len(value) > 200:
            raise ValueError("A text filter requires a value of 1–200 characters.")
        value = value.strip()
        if op not in ("=", "contains", "category"):
            raise ValueError("Text filters support = or contains.")
        if op == "category" and (attr != "zoning" or value not in ("commercial", "industrial", "residential", "mixed")):
            raise ValueError("Unsupported zoning category.")
    return {"attribute": attr, "operator": op, "value": value}


def call_hf_api(query, api_key):
    """Hugging Face's current OpenAI-compatible Inference Providers router."""
    system = '''Translate the user's building query into JSON, with no commentary.
Return {"attribute":...,"operator":...,"value":...} or {"logic":"and"|"or","conditions":[filters]}.
Numeric attributes: height (FEET), height_m (METRES), assessed_value (CAD parcel assessment).
Numeric operators: = > < >= <=. Convert currency abbreviations to numbers.
Text attributes: zoning, address, stage, assessment_class. Text operators: = or contains.
For commercial/industrial/residential/mixed buildings use zoning, operator category, value commercial/industrial/residential/mixed.
Preserve explicit zoning codes. RC-G and R-CG are aliases. Never infer an attribute for an unrelated question.
For unsupported questions return {"error":"Unsupported query"}.
Examples: over 100 feet => {"attribute":"height","operator":">","value":100}
under $500,000 => {"attribute":"assessed_value","operator":"<","value":500000}
over 30 metres => {"attribute":"height_m","operator":">","value":30}'''
    try:
        response = requests.post(
            "https://router.huggingface.co/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": os.getenv("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct"),
                  "messages": [{"role": "system", "content": system}, {"role": "user", "content": query}],
                  "temperature": 0, "max_tokens": 400, "response_format": {"type": "json_object"}},
            timeout=(5, 30))
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
        return validate_filter(json.loads(content))
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
        # Do not leak tokens, provider payloads, or account details in client errors.
        raise RuntimeError("The LLM provider is unavailable or returned an invalid filter.") from exc


def _rule_filter(query):
    q = query.lower().strip()
    parts = re.split(r"\s+(and|or)\s+", q)
    if len(parts) > 1:
        logic = set(parts[1::2])
        if len(logic) != 1:
            raise ValueError("Use only AND or only OR in one query.")
        return validate_filter({"logic": next(iter(logic)), "conditions": [_rule_filter(p) for p in parts[::2]]})
    comparison = re.search(r">=|<=|>|<|=|at least|at most|no less than|no more than|greater than|less than|more than|higher than|taller than|over\b|above\b|under\b|below\b|equal to|exactly", q)
    if comparison:
        phrase = comparison.group()
        op = {"at least": ">=", "no less than": ">=", "at most": "<=", "no more than": "<=",
              "equal to": "=", "exactly": "="}.get(phrase)
        if not op:
            op = phrase if phrase in (">=", "<=", ">", "<", "=") else "<" if phrase in ("less than", "under", "below") else ">"
        match = re.search(NUMBER, q[comparison.end():].lstrip(" $"))
        if match:
            value = float(match[1].replace(",", "")) * {None: 1, "k": 1e3, "thousand": 1e3, "m": 1e6, "million": 1e6, "b": 1e9, "billion": 1e9}[match[2]]
            currency = bool(re.search(r"\$|\b(?:cad|dollars?|value|worth|assessment|assessed)\b", q))
            metric = bool(re.search(r"\b(?:metres?|meters?|height_m)\b|\d\s*m\b", q))
            # A standalone m after a height is metres; for money it is millions.
            if metric and not currency and match[2] == "m":
                value /= 1e6
            attr = "assessed_value" if currency else "height_m" if metric else "height"
            # A zoning condition plus a numeric condition requires an explicit conjunction.
            if re.search(r"\b(?:r-?c-?g|mu-?\d|commercial|industrial)\b", q):
                raise ValueError("Join zoning and numeric conditions with AND or OR.")
            return validate_filter({"attribute": attr, "operator": op, "value": value})
    if "zoning" in q or "land use" in q:
        codes = re.findall(r"\b[a-z][a-z0-9]*(?:[-/][a-z0-9]+)*\b", q)
        codes = [code for code in codes if "-" in code or any(c.isdigit() for c in code)]
        if len(codes) == 1:
            return validate_filter({"attribute": "zoning", "operator": "=", "value": codes[0].upper()})
    zone = re.search(r"\b(?:r-?c-?g|r-?c\d|rc-\d|c-c?or\d|cc(?:-[a-z]+)?|mu-?\d|m-[a-z]\d?|i(?:-[a-z])?)\b", q)
    if zone:
        return validate_filter({"attribute": "zoning", "operator": "=", "value": zone.group().upper()})
    for category in ("commercial", "industrial", "residential", "mixed"):
        if re.search(rf"\b{category}\b", q):
            return {"attribute": "zoning", "operator": "category", "value": category}
    text = re.search(r"\b(address|stage)\s*(?:contains|is|=)\s*[\"']?(.+?)[\"']?$", q)
    if text:
        return validate_filter({"attribute": text[1], "operator": "contains" if text[1] == "address" else "=", "value": text[2]})
    raise ValueError("I couldn't interpret that query. Try ‘over 100 feet’, ‘under $500,000’, or ‘RC-G zoning’.")


def parse_query(query, api_key=None):
    if not isinstance(query, str) or not query.strip() or len(query) > 1000:
        raise ValueError("Enter a query of 1–1,000 characters.")
    if api_key:
        try:
            return call_hf_api(query, api_key), "llm", None
        except RuntimeError:
            return _rule_filter(query), "rules", "LLM unavailable; interpreted with the supported query rules."
    return _rule_filter(query), "rules", "No LLM key configured; interpreted with the supported query rules."


def extract_filter_from_query(user_input, api_key=None):
    return parse_query(user_input, api_key)[0]


def _matches(building, filt):
    if "conditions" in filt:
        results = (_matches(building, c) for c in filt["conditions"])
        return all(results) if filt["logic"] == "and" else any(results)
    attr, op, value = (filt[k] for k in ("attribute", "operator", "value"))
    raw = building.get(attr)
    if raw is None:
        return False
    if attr in NUMERIC:
        try:
            raw = float(raw)
        except (TypeError, ValueError):
            return False
        if not math.isfinite(raw):
            return False
        return {"=": lambda: raw == value, ">": lambda: raw > value, "<": lambda: raw < value,
                ">=": lambda: raw >= value, "<=": lambda: raw <= value}[op]()
    if attr == "zoning":
        zones = building.get("zoning_codes") or [z.strip() for z in str(raw).split(",")]
        if op == "category":
            prefixes = {"commercial": ("C",), "industrial": ("I",), "residential": ("R", "M"), "mixed": ("MU",)}
            return any(normalize_zone(z).startswith(prefixes[value]) and not (value == "residential" and normalize_zone(z).startswith("MU")) for z in zones)
        if op == "=":
            return normalize_zone(value) in [normalize_zone(z) for z in zones]
    return str(raw).casefold() == value.casefold() if op == "=" else value.casefold() in str(raw).casefold()


def apply_filter(buildings, filt):
    filt = validate_filter(filt)
    return [b["id"] for b in buildings if _matches(b, filt)]
