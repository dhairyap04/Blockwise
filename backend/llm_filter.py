"""
Use Hugging Face Inference API to parse natural language into a structured filter
(attribute, operator, value) and apply it to the building list.
"""
import json
import re
import requests
from typing import Dict, Any, List, Optional

# Attributes we support for filtering (must match building keys)
ALLOWED_ATTRIBUTES = {"height", "height_m", "height_ft", "zoning", "assessed_value", "address", "stage"}
# Map user-friendly names to building keys
ATTRIBUTE_ALIASES = {"height_ft": "height", "value": "assessed_value", "property_value": "assessed_value"}


def call_hf_api(prompt: str, api_key: str, model: str = "HuggingFaceH4/zephyr-7b-beta") -> str:
    """Call Hugging Face Inference API (chat/completion). Returns raw response text."""
    url = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    # Use a simple completion-style payload; many HF models support this
    payload = {"inputs": prompt, "parameters": {"max_new_tokens": 150, "return_full_text": False}}
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=30)
        r.raise_for_status()
        out = r.json()
        if isinstance(out, list) and len(out) > 0 and "generated_text" in out[0]:
            return out[0]["generated_text"].strip()
        if isinstance(out, dict) and "generated_text" in out:
            return out["generated_text"].strip()
        return ""
    except Exception as e:
        raise RuntimeError(f"LLM API error: {e}") from e


def extract_filter_from_query(user_input: str, api_key: Optional[str]) -> Dict[str, Any]:
    """
    Parse natural language query into { "attribute", "operator", "value" }.
    If api_key is set, call Hugging Face; otherwise use rule-based fallback.
    """
    prompt = f'''Extract a single filter from this query. Return ONLY valid JSON with keys: "attribute", "operator", "value".
Allowed attributes: height (in feet), height_m, zoning, assessed_value (number in dollars), address, stage.
Operators: =, >, <, >=, <= for numbers; = for text.
Examples:
- "buildings over 100 feet" -> {{"attribute":"height","operator":">","value":"100"}}
- "show commercial buildings" -> {{"attribute":"zoning","operator":"=","value":"CC"}}
- "buildings in RC-G zoning" -> {{"attribute":"zoning","operator":"=","value":"RC-G"}}
- "buildings less than $500,000" -> {{"attribute":"assessed_value","operator":"<","value":"500000"}}
Query: "{user_input}"
JSON:'''

    if api_key:
        try:
            text = call_hf_api(prompt, api_key)
            # Try to find JSON in response
            text = text.strip()
            match = re.search(r"\{[^{}]*\"attribute\"[^{}]*\}", text)
            if match:
                parsed = json.loads(match.group())
                return {
                    "attribute": str(parsed.get("attribute", "height")).strip(),
                    "operator": str(parsed.get("operator", ">")).strip(),
                    "value": str(parsed.get("value", "")).strip(),
                }
        except Exception as e:
            print("LLM parse failed, using fallback:", e)

    # Rule-based fallback
    user_lower = user_input.lower().strip()
    if "over" in user_lower or "above" in user_lower or "greater" in user_lower or ">" in user_input:
        nums = re.findall(r"\d+(?:\.\d+)?", user_input)
        val = nums[0] if nums else "50"
        return {"attribute": "height", "operator": ">", "value": val}
    if "under" in user_lower or "below" in user_lower or "less" in user_lower or "<" in user_input:
        if "$" in user_input or "value" in user_lower or "500" in user_input:
            nums = re.findall(r"\d+(?:,\d+)?", user_input.replace(",", ""))
            val = nums[0] if nums else "500000"
            return {"attribute": "assessed_value", "operator": "<", "value": val}
        nums = re.findall(r"\d+(?:\.\d+)?", user_input)
        val = nums[0] if nums else "50"
        return {"attribute": "height", "operator": "<", "value": val}
    if "rc-g" in user_lower or "rc-g zoning" in user_lower:
        return {"attribute": "zoning", "operator": "=", "value": "RC-G"}
    if "commercial" in user_lower or "cc" in user_lower:
        return {"attribute": "zoning", "operator": "=", "value": "CC"}
    if "industrial" in user_lower:
        return {"attribute": "zoning", "operator": "=", "value": "I"}
    # Default: height > 30
    nums = re.findall(r"\d+(?:\.\d+)?", user_input)
    return {"attribute": "height", "operator": ">", "value": nums[0] if nums else "30"}


def apply_filter(buildings: List[Dict[str, Any]], filt: Dict[str, Any]) -> List[str]:
    """Return list of building ids that match the filter."""
    attr = filt.get("attribute", "height")
    attr = ATTRIBUTE_ALIASES.get(attr, attr)
    if attr not in ALLOWED_ATTRIBUTES and attr not in ("height", "height_m", "zoning", "assessed_value", "address", "stage"):
        attr = "height"
    op = filt.get("operator", ">")
    val_str = str(filt.get("value", "0")).strip()
    ids = []
    for b in buildings:
        raw = b.get(attr)
        try:
            if op == "=":
                if str(raw) == val_str:
                    ids.append(b["id"])
            elif op in (">", ">=", "<", "<="):
                num_val = float(val_str.replace(",", ""))
                if raw is None:
                    continue
                b_num = float(raw) if isinstance(raw, (int, float)) else float(str(raw).replace(",", ""))
                if op == ">" and b_num > num_val:
                    ids.append(b["id"])
                elif op == ">=" and b_num >= num_val:
                    ids.append(b["id"])
                elif op == "<" and b_num < num_val:
                    ids.append(b["id"])
                elif op == "<=" and b_num <= num_val:
                    ids.append(b["id"])
        except (TypeError, ValueError):
            if op == "=" and (val_str.lower() in str(raw).lower() if raw else False):
                ids.append(b["id"])
    return ids
