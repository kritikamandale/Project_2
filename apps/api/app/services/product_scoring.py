"""
Transparent product Match Score + safety flags + honest multi-store links.

This is Skinest's USP made explicit: a deterministic, fully-explainable scorer
(no black box — that's the selling point). Every point is documented and
attributable, and no brand can pay to rank higher.

NOTE ON THE APPENDICES: the spec referenced Appendix A (actives → concern +
mechanism), Appendix B (comedogenic list) and Appendix C (store URL patterns)
but those tables were not included in the brief. The dicts below are
evidence-based reconstructions from standard dermatology sources — edit them
to match your canonical appendix values; nothing else in the scorer needs to
change.
"""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Appendix A — actives → (concern, plain-English mechanism)
# Keys are normalised, lowercase active names. Used for the Match Score reason
# and the "hero active" selection.
# ---------------------------------------------------------------------------
ACTIVE_INFO: dict[str, dict[str, str]] = {
    "salicylic acid":  {"concern": "acne",           "mechanism": "an oil-soluble BHA that clears sebum from inside the pore"},
    "benzoyl peroxide":{"concern": "acne",           "mechanism": "kills acne-causing bacteria on contact"},
    "niacinamide":     {"concern": "oiliness",       "mechanism": "regulates oil and strengthens the skin barrier"},
    "zinc":            {"concern": "oiliness",       "mechanism": "calms inflammation and controls sebum"},
    "azelaic acid":    {"concern": "acne",           "mechanism": "clears breakouts and fades post-acne marks without irritation"},
    "retinol":         {"concern": "wrinkles",       "mechanism": "speeds cell turnover to smooth texture and unclog pores"},
    "retinoid":        {"concern": "wrinkles",       "mechanism": "speeds cell turnover to smooth texture and unclog pores"},
    "bakuchiol":       {"concern": "wrinkles",       "mechanism": "a gentle, pregnancy-safe retinol alternative that firms skin"},
    "vitamin c":       {"concern": "pigmentation",   "mechanism": "an antioxidant that brightens and fades dark spots"},
    "ascorbic acid":   {"concern": "pigmentation",   "mechanism": "an antioxidant that brightens and fades dark spots"},
    "alpha arbutin":   {"concern": "pigmentation",   "mechanism": "blocks excess melanin to even out tone"},
    "kojic acid":      {"concern": "pigmentation",   "mechanism": "inhibits melanin production to lighten dark patches"},
    "tranexamic acid": {"concern": "pigmentation",   "mechanism": "targets stubborn melasma and post-inflammatory marks"},
    "glycolic acid":   {"concern": "texture",        "mechanism": "an AHA that resurfaces dull, uneven skin"},
    "lactic acid":     {"concern": "texture",        "mechanism": "a mild AHA that exfoliates while hydrating"},
    "hyaluronic acid": {"concern": "dryness",        "mechanism": "draws water into the skin for lasting hydration"},
    "glycerin":        {"concern": "dryness",        "mechanism": "a humectant that keeps skin hydrated"},
    "ceramide":        {"concern": "dryness",        "mechanism": "rebuilds the moisture barrier to stop water loss"},
    "ceramides":       {"concern": "dryness",        "mechanism": "rebuild the moisture barrier to stop water loss"},
    "squalane":        {"concern": "dryness",        "mechanism": "a lightweight emollient that softens without clogging"},
    "centella asiatica":{"concern": "redness",       "mechanism": "soothes irritation and supports barrier repair"},
    "cica":            {"concern": "redness",        "mechanism": "soothes irritation and supports barrier repair"},
    "tea tree":        {"concern": "acne",           "mechanism": "a natural antibacterial that calms breakouts"},
    "zinc oxide":      {"concern": "sun protection", "mechanism": "a mineral filter that physically blocks UV"},
    "titanium dioxide":{"concern": "sun protection", "mechanism": "a mineral filter that physically blocks UV"},
}

# Map a user "condition" label (scan condition_name / questionnaire) onto the
# concern vocabulary above, so a product active can be tied to the user's issue.
CONDITION_TO_CONCERN: dict[str, str] = {
    "acne": "acne", "pores": "oiliness", "enlarged_pores": "oiliness",
    "oiliness": "oiliness", "blackheads": "acne",
    "pigmentation": "pigmentation", "dark_spots": "pigmentation",
    "uneven_tone": "pigmentation", "melasma": "pigmentation", "dark_circles": "pigmentation",
    "wrinkles": "wrinkles", "fine_lines": "wrinkles", "aging": "wrinkles",
    "dryness": "dryness", "dehydration": "dryness",
    "redness": "redness", "sensitivity": "redness", "rosacea": "redness",
    "texture": "texture",
}

# ---------------------------------------------------------------------------
# Appendix B — comedogenic ingredients (pore-clogging). Flagged for oily /
# combination / acne-prone users only; harmless (even beneficial) on dry skin.
# ---------------------------------------------------------------------------
COMEDOGENIC: set[str] = {
    "coconut oil", "cocoa butter", "isopropyl myristate", "isopropyl palmitate",
    "wheat germ oil", "algae extract", "lanolin", "laureth-4", "myristyl myristate",
    "soybean oil", "flax seed oil", "flaxseed oil", "palm oil", "sodium chloride",
    "olive oil", "sesame oil", "almond oil", "cocoa seed butter",
}

FRAGRANCE_TERMS: set[str] = {"fragrance", "parfum", "perfume", "essential oil"}

# ---------------------------------------------------------------------------
# Appendix C — marketplace search deep-link patterns ({q} = URL-encoded name).
# These are legitimate search fallbacks used only when no verified direct URL
# exists — the link always resolves to a real results page. Verify the current
# search paths before shipping if a marketplace changes its URL scheme.
# ---------------------------------------------------------------------------
STORE_SEARCH: dict[str, str] = {
    "Amazon":   "https://www.amazon.in/s?k={q}",
    "Flipkart": "https://www.flipkart.com/search?q={q}",
    "Nykaa":    "https://www.nykaa.com/search/result/?q={q}",
    "Purplle":  "https://www.purplle.com/search?q={q}",
    "Tira":     "https://www.tirabeauty.com/search?q={q}",
}

# Known brand → official-store search, added when brand_display matches.
BRAND_SITE_SEARCH: dict[str, str] = {
    "re'equil": "https://www.reequil.com/search?q={q}",
    "reequil":  "https://www.reequil.com/search?q={q}",
    "cerave":   "https://www.cerave.com/search?q={q}",
    "bioderma": "https://www.bioderma.in/our-products?search={q}",
    "minimalist": "https://beminimalist.co/search?q={q}",
    "dermaco":  "https://thedermaco.com/search?q={q}",
    "the derma co": "https://thedermaco.com/search?q={q}",
}

# Skin types for which comedogenic ingredients are a problem.
_COMEDOGENIC_RISK_SKIN = {"oily", "combination"}

# Flag messages (human-facing).
_FLAG_MESSAGES = {
    "comedogenic":      "Contains a pore-clogging ingredient — may worsen breakouts on oily/acne-prone skin.",
    "contains_allergen":"Contains an ingredient you listed as an allergen.",
    "pregnancy_unsafe": "Not recommended during pregnancy — check with your doctor.",
    "fragrance":        "Contains fragrance — a common irritant for sensitive skin.",
}


# ---------------------------------------------------------------------------
# Context + result dataclasses
# ---------------------------------------------------------------------------

@dataclass
class UserContext:
    """The user signals the scorer reasons over. All optional — a partial
    context still produces a (lower-confidence) score; an empty context yields
    no score (plain catalogue browse)."""
    skin_type: Optional[str] = None
    conditions: list[str] = field(default_factory=list)   # active conditions e.g. ["acne","pigmentation"]
    climate_zone: Optional[str] = None
    city: Optional[str] = None
    fitzpatrick: Optional[str] = None
    allergens: list[str] = field(default_factory=list)    # lowercased allergen substrings
    is_pregnant: bool = False

    def is_empty(self) -> bool:
        return not any([self.skin_type, self.conditions, self.climate_zone, self.fitzpatrick])


@dataclass
class ScoreResult:
    match_score: Optional[int]
    match_reason: Optional[str]
    flags: list[dict]           # [{"code":..., "message":...}]


# ---------------------------------------------------------------------------
# Discount helper
# ---------------------------------------------------------------------------

def compute_discount_pct(price_inr: Optional[float], mrp_inr: Optional[float]) -> Optional[int]:
    """Whole-number discount % from MRP, or None when it can't be computed / is non-positive."""
    if not price_inr or not mrp_inr or mrp_inr <= 0 or price_inr >= mrp_inr:
        return None
    return round((mrp_inr - price_inr) / mrp_inr * 100)


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _actives_for(product) -> list[str]:
    """key_actives if present, else derive from key_ingredients (strip %/qualifiers)."""
    actives = [a.lower().strip() for a in (getattr(product, "key_actives", None) or []) if a]
    if actives:
        return actives
    derived: list[str] = []
    for ing in (getattr(product, "key_ingredients", None) or []):
        base = ing.lower().strip()
        # strip a trailing percentage e.g. "salicylic acid 2%" -> "salicylic acid"
        for token in ("%",):
            if token in base:
                base = base.split(token)[0].rstrip(" 0123456789.")
        derived.append(base.strip())
    return [d for d in derived if d]


def _contains_any(haystack_terms: list[str], needles: set[str]) -> Optional[str]:
    for term in haystack_terms:
        for n in needles:
            if n in term:
                return n
    return None


def _climate_phrase(climate_zone: Optional[str], city: Optional[str]) -> str:
    zone_word = {
        "tropical": "humid", "coastal": "humid coastal", "arid": "dry",
        "semi_arid": "dry", "temperate": "temperate",
    }.get((climate_zone or "").lower(), "")
    if city and zone_word:
        return f"{zone_word} {city} climate"
    if city:
        return f"{city} climate"
    if zone_word:
        return f"{zone_word} climate"
    return ""


# ---------------------------------------------------------------------------
# Match reason
# ---------------------------------------------------------------------------

def build_match_reason(product, ctx: UserContext) -> Optional[str]:
    """One plain sentence: skin type + climate + concern + hero active + mechanism."""
    skin = (ctx.skin_type or "").strip()
    targets = [t.lower() for t in (getattr(product, "targets_conditions", None) or [])]
    actives = _actives_for(product)

    # concern = first user condition this product actually targets. Only name a
    # concern the user genuinely has — never invent one from the product, which
    # would mislead (e.g. "active uneven tone" for someone who asked about acne).
    matched_condition = next((c for c in ctx.conditions if c.lower() in targets), None)
    concern_label = matched_condition.replace("_", " ") if matched_condition else ""

    # hero active = the product active whose mapped concern matches the user's,
    # else the first known active, else the first active.
    wanted_concern = CONDITION_TO_CONCERN.get((matched_condition or "").lower())
    hero = None
    for a in actives:
        info = ACTIVE_INFO.get(a)
        if info and (wanted_concern is None or info["concern"] == wanted_concern):
            hero = a
            break
    if hero is None:
        hero = next((a for a in actives if a in ACTIVE_INFO), actives[0] if actives else None)

    mechanism = ACTIVE_INFO.get(hero, {}).get("mechanism") if hero else None

    # Assemble — degrade gracefully with whatever context exists.
    lead_parts = []
    if skin:
        lead_parts.append(f"{skin.title()} skin")
    climate = _climate_phrase(ctx.climate_zone, ctx.city)
    if climate:
        lead_parts.append(climate)
    if concern_label:
        lead_parts.append(f"active {concern_label}")
    lead = " + ".join(lead_parts)

    if hero and mechanism:
        tail = f"{hero}: {mechanism}"
        return f"{lead} → {tail}" if lead else f"Contains {tail}"
    if lead:
        return f"{lead} → a good match for your profile"
    return None


# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------

def compute_flags(product, ctx: UserContext) -> list[dict]:
    flags: list[dict] = []
    ingredients = [i.lower().strip() for i in (getattr(product, "key_ingredients", None) or [])]
    actives = _actives_for(product)
    searchable = ingredients + actives

    # comedogenic — only relevant for oily/combination/acne-prone users
    skin = (ctx.skin_type or "").lower()
    acne_prone = "acne" in [c.lower() for c in ctx.conditions]
    if skin in _COMEDOGENIC_RISK_SKIN or acne_prone:
        if _contains_any(searchable, COMEDOGENIC):
            flags.append({"code": "comedogenic", "message": _FLAG_MESSAGES["comedogenic"]})

    # allergen — always flagged
    if ctx.allergens:
        for a in ctx.allergens:
            if a and any(a in term for term in searchable):
                flags.append({"code": "contains_allergen", "message": _FLAG_MESSAGES["contains_allergen"]})
                break

    # pregnancy — only when the user flagged pregnancy
    if ctx.is_pregnant and getattr(product, "pregnancy_safe", None) is False:
        flags.append({"code": "pregnancy_unsafe", "message": _FLAG_MESSAGES["pregnancy_unsafe"]})

    # fragrance — informational, always shown
    if _contains_any(searchable, FRAGRANCE_TERMS):
        flags.append({"code": "fragrance", "message": _FLAG_MESSAGES["fragrance"]})

    return flags


# ---------------------------------------------------------------------------
# Match score — additive, documented weights, clamped [0, 100]
# ---------------------------------------------------------------------------

def score_product(product, ctx: UserContext) -> ScoreResult:
    flags = compute_flags(product, ctx)

    if ctx.is_empty():
        # No personalisation context → no score (plain browse), flags still useful.
        return ScoreResult(match_score=None, match_reason=None, flags=flags)

    score = 0

    # + skin-type match: +25
    skin_ok = ctx.skin_type and ctx.skin_type.lower() in [
        s.lower() for s in (getattr(product, "skin_types_suitable", None) or [])
    ]
    if skin_ok:
        score += 25

    # + each user condition the product targets: +15 each, capped +30
    targets = [t.lower() for t in (getattr(product, "targets_conditions", None) or [])]
    condition_hits = sum(1 for c in ctx.conditions if c.lower() in targets)
    score += min(condition_hits * 15, 30)

    # + climate-zone match: +15
    if ctx.climate_zone and ctx.climate_zone.lower() in [
        z.lower() for z in (getattr(product, "climate_zones_suitable", None) or [])
    ]:
        score += 15

    # + Fitzpatrick match: +10
    if ctx.fitzpatrick and ctx.fitzpatrick in (getattr(product, "fitzpatrick_suitable", None) or []):
        score += 10

    # + dermatologist approved: +10
    if getattr(product, "is_dermatologist_approved", False):
        score += 10

    # + rating factor: round(rating_avg * 2), max +10
    rating = float(getattr(product, "rating_avg", 0) or 0)
    score += min(round(rating * 2), 10)

    # penalties
    flag_codes = {f["code"] for f in flags}
    if "comedogenic" in flag_codes:
        score -= 20
    if "contains_allergen" in flag_codes:
        score -= 100
    if "pregnancy_unsafe" in flag_codes:
        score -= 100

    score = max(0, min(100, score))
    reason = build_match_reason(product, ctx)
    return ScoreResult(match_score=score, match_reason=reason, flags=flags)


# ---------------------------------------------------------------------------
# Honest multi-store links
# ---------------------------------------------------------------------------

def _store_name_from_url(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower().replace("www.", "")
    known = {
        "amazon.in": "Amazon", "flipkart.com": "Flipkart", "nykaa.com": "Nykaa",
        "purplle.com": "Purplle", "tirabeauty.com": "Tira", "reequil.com": "Re'equil",
        "cerave.com": "CeraVe", "bioderma.in": "Bioderma", "beminimalist.co": "Minimalist",
        "thedermaco.com": "Dermaco",
    }
    for domain, name in known.items():
        if domain in host:
            return name
    return host.split(".")[0].title() or "Store"


def build_store_links(
    product_name: str,
    product_url: Optional[str] = None,
    existing: Optional[list] = None,
    brand_display: Optional[str] = None,
) -> list[dict]:
    """
    Build honest multi-store buy links. Verified direct URL(s) first, then
    marketplace search deep-links (always resolvable). Never emits "#"; a store
    is omitted only if no link can be built. De-duplicates by store name.
    """
    links: list[dict] = []
    seen_stores: set[str] = set()

    def _add(store: str, url: str):
        if not url or url.strip() in ("", "#"):
            return
        if store in seen_stores:
            return
        seen_stores.add(store)
        links.append({"store": store, "url": url})

    # 1. Verified direct product URL first.
    if product_url and product_url.strip() and product_url.strip() != "#":
        _add(_store_name_from_url(product_url), product_url.strip())

    # 2. Any pre-existing curated store_links.
    for entry in (existing or []):
        if isinstance(entry, dict):
            _add(str(entry.get("store", "")).strip() or "Store", str(entry.get("url", "")).strip())

    # 3. Marketplace search deep-links.
    q = urllib.parse.quote_plus(product_name)
    for store, pattern in STORE_SEARCH.items():
        _add(store, pattern.format(q=q))

    # 4. Official brand store when known.
    if brand_display:
        pattern = BRAND_SITE_SEARCH.get(brand_display.lower().strip())
        if pattern:
            _add(brand_display, pattern.format(q=q))

    return links
