"""
Climate enrichment service — fetches real-time weather data from Open-Meteo
(free, no API key) for Indian cities and classifies the climate zone.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 50 Indian cities with (latitude, longitude, state)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CityInfo:
    name: str
    state: str
    lat: float
    lon: float
    is_coastal: bool = False


INDIAN_CITIES: dict[str, CityInfo] = {
    "mumbai":         CityInfo("Mumbai",         "Maharashtra",       19.0760,  72.8777, True),
    "delhi":          CityInfo("Delhi",           "Delhi",             28.6139,  77.2090),
    "bangalore":      CityInfo("Bangalore",       "Karnataka",         12.9716,  77.5946),
    "bengaluru":      CityInfo("Bangalore",       "Karnataka",         12.9716,  77.5946),
    "chennai":        CityInfo("Chennai",         "Tamil Nadu",        13.0827,  80.2707, True),
    "kolkata":        CityInfo("Kolkata",         "West Bengal",       22.5726,  88.3639, True),
    "hyderabad":      CityInfo("Hyderabad",       "Telangana",         17.3850,  78.4867),
    "pune":           CityInfo("Pune",            "Maharashtra",       18.5204,  73.8567),
    "ahmedabad":      CityInfo("Ahmedabad",       "Gujarat",           23.0225,  72.5714),
    "jaipur":         CityInfo("Jaipur",          "Rajasthan",         26.9124,  75.7873),
    "surat":          CityInfo("Surat",           "Gujarat",           21.1702,  72.8311, True),
    "lucknow":        CityInfo("Lucknow",         "Uttar Pradesh",     26.8467,  80.9462),
    "kanpur":         CityInfo("Kanpur",          "Uttar Pradesh",     26.4499,  80.3319),
    "nagpur":         CityInfo("Nagpur",          "Maharashtra",       21.1458,  79.0882),
    "indore":         CityInfo("Indore",          "Madhya Pradesh",    22.7196,  75.8577),
    "thane":          CityInfo("Thane",           "Maharashtra",       19.2183,  72.9781, True),
    "bhopal":         CityInfo("Bhopal",          "Madhya Pradesh",    23.2599,  77.4126),
    "visakhapatnam":  CityInfo("Visakhapatnam",   "Andhra Pradesh",    17.6868,  83.2185, True),
    "vizag":          CityInfo("Visakhapatnam",   "Andhra Pradesh",    17.6868,  83.2185, True),
    "patna":          CityInfo("Patna",           "Bihar",             25.5941,  85.1376),
    "vadodara":       CityInfo("Vadodara",        "Gujarat",           22.3072,  73.1812),
    "ghaziabad":      CityInfo("Ghaziabad",       "Uttar Pradesh",     28.6692,  77.4538),
    "ludhiana":       CityInfo("Ludhiana",        "Punjab",            30.9010,  75.8573),
    "agra":           CityInfo("Agra",            "Uttar Pradesh",     27.1767,  78.0081),
    "nashik":         CityInfo("Nashik",          "Maharashtra",       20.0112,  73.7910),
    "faridabad":      CityInfo("Faridabad",       "Haryana",           28.4089,  77.3178),
    "meerut":         CityInfo("Meerut",          "Uttar Pradesh",     28.9845,  77.7064),
    "rajkot":         CityInfo("Rajkot",          "Gujarat",           22.3039,  70.8022),
    "varanasi":       CityInfo("Varanasi",        "Uttar Pradesh",     25.3176,  82.9739),
    "srinagar":       CityInfo("Srinagar",        "Jammu & Kashmir",   34.0836,  74.7973),
    "aurangabad":     CityInfo("Aurangabad",      "Maharashtra",       19.8762,  75.3433),
    "dhanbad":        CityInfo("Dhanbad",         "Jharkhand",         23.7957,  86.4304),
    "amritsar":       CityInfo("Amritsar",        "Punjab",            31.6340,  74.8723),
    "navi mumbai":    CityInfo("Navi Mumbai",     "Maharashtra",       19.0330,  73.0297, True),
    "allahabad":      CityInfo("Prayagraj",       "Uttar Pradesh",     25.4358,  81.8463),
    "prayagraj":      CityInfo("Prayagraj",       "Uttar Pradesh",     25.4358,  81.8463),
    "howrah":         CityInfo("Howrah",          "West Bengal",       22.5958,  88.2636),
    "ranchi":         CityInfo("Ranchi",          "Jharkhand",         23.3441,  85.3096),
    "gwalior":        CityInfo("Gwalior",         "Madhya Pradesh",    26.2183,  78.1828),
    "jabalpur":       CityInfo("Jabalpur",        "Madhya Pradesh",    23.1815,  79.9864),
    "coimbatore":     CityInfo("Coimbatore",      "Tamil Nadu",        11.0168,  76.9558),
    "vijayawada":     CityInfo("Vijayawada",      "Andhra Pradesh",    16.5062,  80.6480),
    "jodhpur":        CityInfo("Jodhpur",         "Rajasthan",         26.2389,  73.0243),
    "madurai":        CityInfo("Madurai",         "Tamil Nadu",         9.9252,  78.1198),
    "raipur":         CityInfo("Raipur",          "Chhattisgarh",      21.2514,  81.6296),
    "kota":           CityInfo("Kota",            "Rajasthan",         25.2138,  75.8648),
    "chandigarh":     CityInfo("Chandigarh",      "Chandigarh",        30.7333,  76.7794),
    "guwahati":       CityInfo("Guwahati",        "Assam",             26.1445,  91.7362),
    "solapur":        CityInfo("Solapur",         "Maharashtra",       17.6805,  75.9064),
    "hubli":          CityInfo("Hubli-Dharwad",   "Karnataka",         15.3647,  75.1240),
    "mysore":         CityInfo("Mysore",          "Karnataka",         12.2958,  76.6394),
    "kochi":          CityInfo("Kochi",           "Kerala",             9.9312,  76.2673, True),
    "trivandrum":     CityInfo("Thiruvananthapuram", "Kerala",          8.5241,  76.9366, True),
    "thiruvananthapuram": CityInfo("Thiruvananthapuram", "Kerala",      8.5241,  76.9366, True),
}

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude={lat}&longitude={lon}"
    "&current=temperature_2m,relative_humidity_2m,uv_index"
    "&timezone=auto"
)


def _classify_climate_zone(
    temp_c: float,
    humidity_pct: float,
    is_coastal: bool,
) -> str:
    """Rule-based climate zone classification for Indian geography."""
    if is_coastal and humidity_pct >= 60:
        return "coastal"
    if temp_c >= 25 and humidity_pct >= 70:
        return "tropical"
    if humidity_pct < 30:
        return "arid"
    if humidity_pct < 50:
        return "semi_arid"
    return "temperate"


def lookup_city(city_input: str) -> Optional[CityInfo]:
    """Case-insensitive lookup; strips extra whitespace."""
    key = city_input.strip().lower()
    return INDIAN_CITIES.get(key)


def list_cities() -> list[str]:
    """Return sorted unique city display names for autocomplete."""
    seen: set[str] = set()
    result: list[str] = []
    for info in INDIAN_CITIES.values():
        if info.name not in seen:
            seen.add(info.name)
            result.append(info.name)
    return sorted(result)


async def fetch_climate_data(city: str) -> Optional[dict]:
    """
    Fetch current temperature, humidity, and UV index from Open-Meteo.
    Returns None if city is unknown or the API call fails.
    """
    info = lookup_city(city)
    if info is None:
        logger.warning("Unknown city for climate enrichment: %s", city)
        return None

    url = OPEN_METEO_URL.format(lat=info.lat, lon=info.lon)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as exc:
        logger.error("Open-Meteo request failed for %s: %s", city, exc)
        return None

    current = data.get("current", {})
    temp = current.get("temperature_2m")
    humidity = current.get("relative_humidity_2m")
    uv = current.get("uv_index")

    if temp is None or humidity is None:
        logger.warning("Incomplete climate data from Open-Meteo for %s", city)
        return None

    zone = _classify_climate_zone(
        temp_c=float(temp),
        humidity_pct=float(humidity),
        is_coastal=info.is_coastal,
    )

    return {
        "city": info.name,
        "state": info.state,
        "avg_temperature_c": round(float(temp), 1),
        "avg_humidity_pct": round(float(humidity), 1),
        "uv_index": round(float(uv), 1) if uv is not None else 0.0,
        "climate_zone": zone,
    }
