"""
Input sanitization utilities.
Uses nh3 (Ammonia/Rust-based) to strip all HTML tags from user-supplied text.
Applied at middleware level and as explicit helpers in service layer.
"""

from typing import Any, Optional

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


# ---------------------------------------------------------------------------
# Prompt-injection heuristic (defense-in-depth for the LLM recommendation flow)
# ---------------------------------------------------------------------------
# sanitize_text() above only strips HTML-like tags; it does nothing against a
# plain-language attempt to override the system prompt (no angle brackets
# needed for that). This is a coarse heuristic, not a guarantee — callers
# should use it to fall back to a conservative path (e.g. force a
# dermatologist review) rather than to block the request outright.
_INJECTION_PHRASES: frozenset[str] = frozenset({
    "ignore previous instructions", "ignore all previous instructions",
    "ignore the above", "disregard previous instructions", "disregard the system prompt",
    "forget everything above", "forget your instructions", "new instructions:",
    "system prompt:", "you are now", "act as", "do not follow",
})


def looks_like_prompt_injection(value: Optional[str]) -> bool:
    """True if free text reads like an attempt to override LLM instructions."""
    if not value:
        return False
    lowered = value.lower()
    return any(phrase in lowered for phrase in _INJECTION_PHRASES)


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
