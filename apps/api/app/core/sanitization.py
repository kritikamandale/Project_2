"""
Input sanitization utilities.
Uses nh3 (Ammonia/Rust-based) to strip all HTML tags from user-supplied text.
Applied at middleware level and as explicit helpers in service layer.
"""

from typing import Any

try:
    import nh3
    _NH3_AVAILABLE = True
except ImportError:
    _NH3_AVAILABLE = False


def sanitize_text(value: str) -> str:
    """Strip all HTML tags and attributes from a string."""
    if not value:
        return value
    if _NH3_AVAILABLE:
        # allow_tags={} strips everything; clean() returns safe plain text
        return nh3.clean(value, tags=set())
    # Fallback: naive tag stripper (no deps)
    import re
    return re.sub(r"<[^>]+>", "", value)


def sanitize_dict(data: dict[str, Any], depth: int = 0) -> dict[str, Any]:
    """Recursively sanitize all string values in a dict (max depth 5)."""
    if depth > 5:
        return data
    result: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, str):
            result[key] = sanitize_text(value)
        elif isinstance(value, dict):
            result[key] = sanitize_dict(value, depth + 1)
        elif isinstance(value, list):
            result[key] = [
                sanitize_text(item) if isinstance(item, str)
                else sanitize_dict(item, depth + 1) if isinstance(item, dict)
                else item
                for item in value
            ]
        else:
            result[key] = value
    return result
