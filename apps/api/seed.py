"""
Database seed script — populates:
  • 5 admin users
  • 10 dermatologist users
  • 30 products (10 each: Nykaa, Minimalist, Dermaco)
  • EnvironmentProfile data for 10 major Indian cities (pre-seeded as static data)
  • Default platform settings

Usage:
    cd apps/api
    python seed.py                # seeds everything
    python seed.py --reset        # drops + re-seeds (DEV ONLY)
"""

import asyncio
import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# Bootstrap path before app imports
# ---------------------------------------------------------------------------
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from app.core.config import settings
from app.core.security import hash_password
from app.models import (
    Base, User, UserProfile, DermatologistProfile,
    Product, EnvironmentProfile, PlatformSetting,
)

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

ADMIN_USERS = [
    {"email": "admin1@skinest.in", "full_name": "Priya Sharma", "city": "Mumbai", "state": "Maharashtra"},
    {"email": "admin2@skinest.in", "full_name": "Arjun Verma", "city": "Delhi", "state": "Delhi"},
    {"email": "admin3@skinest.in", "full_name": "Kavitha Nair", "city": "Bangalore", "state": "Karnataka"},
    {"email": "admin4@skinest.in", "full_name": "Rohit Gupta", "city": "Pune", "state": "Maharashtra"},
    {"email": "admin5@skinest.in", "full_name": "Sneha Iyer", "city": "Chennai", "state": "Tamil Nadu"},
]

DERMATOLOGIST_USERS = [
    {
        "email": "dr.mehta@skinest.in", "full_name": "Dr. Anita Mehta",
        "city": "Mumbai", "state": "Maharashtra",
        "license": "MH-DERM-10234", "specialization": "Cosmetic Dermatology",
        "hospital": "Lilavati Hospital, Mumbai",
    },
    {
        "email": "dr.kapoor@skinest.in", "full_name": "Dr. Rajesh Kapoor",
        "city": "Delhi", "state": "Delhi",
        "license": "DL-DERM-20891", "specialization": "Medical Dermatology",
        "hospital": "AIIMS, New Delhi",
    },
    {
        "email": "dr.krishnan@skinest.in", "full_name": "Dr. Sita Krishnan",
        "city": "Bangalore", "state": "Karnataka",
        "license": "KA-DERM-30112", "specialization": "Pediatric Dermatology",
        "hospital": "Manipal Hospital, Bangalore",
    },
    {
        "email": "dr.patel@skinest.in", "full_name": "Dr. Vivek Patel",
        "city": "Ahmedabad", "state": "Gujarat",
        "license": "GJ-DERM-40567", "specialization": "Trichology & Dermatology",
        "hospital": "Apollo Hospital, Ahmedabad",
    },
    {
        "email": "dr.reddy@skinest.in", "full_name": "Dr. Padma Reddy",
        "city": "Hyderabad", "state": "Telangana",
        "license": "TS-DERM-50789", "specialization": "Aesthetic Dermatology",
        "hospital": "Care Hospital, Hyderabad",
    },
    {
        "email": "dr.banerjee@skinest.in", "full_name": "Dr. Arko Banerjee",
        "city": "Kolkata", "state": "West Bengal",
        "license": "WB-DERM-60234", "specialization": "Cosmetic Dermatology",
        "hospital": "AMRI Hospital, Kolkata",
    },
    {
        "email": "dr.mishra@skinest.in", "full_name": "Dr. Neha Mishra",
        "city": "Jaipur", "state": "Rajasthan",
        "license": "RJ-DERM-70456", "specialization": "Medical Dermatology",
        "hospital": "SMS Hospital, Jaipur",
    },
    {
        "email": "dr.thomas@skinest.in", "full_name": "Dr. Samuel Thomas",
        "city": "Kochi", "state": "Kerala",
        "license": "KL-DERM-80123", "specialization": "Contact Dermatitis",
        "hospital": "Amrita Hospital, Kochi",
    },
    {
        "email": "dr.joshi@skinest.in", "full_name": "Dr. Pooja Joshi",
        "city": "Pune", "state": "Maharashtra",
        "license": "MH-DERM-90678", "specialization": "Cosmetic Dermatology",
        "hospital": "Ruby Hall Clinic, Pune",
    },
    {
        "email": "dr.subramaniam@skinest.in", "full_name": "Dr. Karthik Subramaniam",
        "city": "Chennai", "state": "Tamil Nadu",
        "license": "TN-DERM-10001", "specialization": "Phototherapy & Dermatology",
        "hospital": "Apollo Hospital, Chennai",
    },
]

# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

NYKAA_PRODUCTS = [
    {
        "brand": "nykaa", "product_name": "Nykaa Naturals Ubtan Face Wash",
        "category": "cleanser", "price_inr": 349.0,
        "key_ingredients": ["turmeric", "sandalwood", "rose water", "chickpea flour"],
        "targets_conditions": ["uneven_tone", "pigmentation", "dryness"],
        "skin_types_suitable": ["dry", "normal", "combination"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.nykaa.com/nykaa-naturals-ubtan-face-wash/p/3443",
        "rating_avg": 4.2, "review_count": 1820,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Skin Secrets Aloe Vera Toner",
        "category": "toner", "price_inr": 249.0,
        "key_ingredients": ["aloe vera", "witch hazel", "niacinamide"],
        "targets_conditions": ["redness", "pores", "uneven_tone"],
        "skin_types_suitable": ["oily", "combination", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV"],
        "climate_zones_suitable": ["tropical", "coastal", "temperate"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.nykaa.com/nykaa-skin-secrets-aloe-vera-toner/p/5432",
        "rating_avg": 4.0, "review_count": 3210,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Skin RX 10% Vitamin C Serum",
        "category": "serum", "price_inr": 699.0,
        "key_ingredients": ["ascorbic acid 10%", "vitamin E", "ferulic acid", "hyaluronic acid"],
        "targets_conditions": ["pigmentation", "dark_spots", "uneven_tone", "wrinkles"],
        "skin_types_suitable": ["dry", "normal", "combination"],
        "fitzpatrick_suitable": ["II", "III", "IV", "V"],
        "climate_zones_suitable": ["temperate", "semi_arid", "tropical"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.nykaa.com/nykaa-skin-rx-vitamin-c-serum/p/6712",
        "rating_avg": 4.4, "review_count": 5670,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Naturals Saffron & Turmeric Moisturiser",
        "category": "moisturiser", "price_inr": 399.0,
        "key_ingredients": ["saffron extract", "turmeric", "shea butter", "glycerin"],
        "targets_conditions": ["dryness", "uneven_tone", "redness"],
        "skin_types_suitable": ["dry", "normal"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": False,
        "product_url": "https://www.nykaa.com/nykaa-naturals-saffron-moisturiser/p/7823",
        "rating_avg": 3.9, "review_count": 2100,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Wanderlust SPF 50+ Sunscreen",
        "category": "sunscreen", "price_inr": 449.0,
        "key_ingredients": ["zinc oxide", "octinoxate", "vitamin E", "green tea extract"],
        "targets_conditions": ["pigmentation", "dark_spots"],
        "skin_types_suitable": ["oily", "combination", "normal", "dry", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.nykaa.com/nykaa-wanderlust-sunscreen-spf50/p/9012",
        "rating_avg": 4.5, "review_count": 8930,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Acne Away Tea Tree Gel",
        "category": "treatment", "price_inr": 279.0,
        "key_ingredients": ["tea tree oil 2%", "salicylic acid 1%", "niacinamide", "centella asiatica"],
        "targets_conditions": ["acne", "pores", "redness"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV"],
        "climate_zones_suitable": ["tropical", "coastal"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.nykaa.com/nykaa-acne-away-tea-tree-gel/p/4521",
        "rating_avg": 4.1, "review_count": 4320,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Naturals Multani Mitti Mask",
        "category": "mask", "price_inr": 199.0,
        "key_ingredients": ["multani mitti", "rose water", "neem", "tulsi"],
        "targets_conditions": ["acne", "pores", "texture"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "semi_arid", "arid"],
        "is_dermatologist_approved": False,
        "product_url": "https://www.nykaa.com/nykaa-naturals-multani-mitti-mask/p/1234",
        "rating_avg": 3.8, "review_count": 6780,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Skin RX Hyaluronic Acid Booster",
        "category": "serum", "price_inr": 599.0,
        "key_ingredients": ["hyaluronic acid 2%", "glycerin", "peptides", "ceramides"],
        "targets_conditions": ["dryness", "wrinkles", "texture"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.nykaa.com/nykaa-skin-rx-hyaluronic-acid-booster/p/8901",
        "rating_avg": 4.3, "review_count": 3450,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa Makeup Remover Micellar Water",
        "category": "cleanser", "price_inr": 299.0,
        "key_ingredients": ["micellar water", "aloe vera", "panthenol"],
        "targets_conditions": ["dryness", "redness"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": False,
        "product_url": "https://www.nykaa.com/nykaa-micellar-water/p/2345",
        "rating_avg": 4.0, "review_count": 1980,
    },
    {
        "brand": "nykaa", "product_name": "Nykaa BBLUNT Anti-Frizz Scalp Serum",
        "category": "treatment", "price_inr": 499.0,
        "key_ingredients": ["argan oil", "biotin", "keratin", "vitamin B5"],
        "targets_conditions": ["texture"],
        "skin_types_suitable": ["dry", "normal", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["coastal", "tropical", "arid"],
        "is_dermatologist_approved": False,
        "product_url": "https://www.nykaa.com/nykaa-bblunt-scalp-serum/p/3456",
        "rating_avg": 3.7, "review_count": 890,
    },
]

MINIMALIST_PRODUCTS = [
    {
        "brand": "minimalist", "product_name": "Alpha Arbutin 2% + HA",
        "category": "serum", "price_inr": 599.0,
        "key_ingredients": ["alpha arbutin 2%", "hyaluronic acid"],
        "targets_conditions": ["dark_spots", "pigmentation", "uneven_tone"],
        "skin_types_suitable": ["oily", "dry", "normal", "combination"],
        "fitzpatrick_suitable": ["II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "semi_arid", "temperate", "coastal"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/alpha-arbutin-2",
        "rating_avg": 4.6, "review_count": 22400,
    },
    {
        "brand": "minimalist", "product_name": "Niacinamide 10% + Zinc 1%",
        "category": "serum", "price_inr": 599.0,
        "key_ingredients": ["niacinamide 10%", "zinc PCA 1%"],
        "targets_conditions": ["acne", "pores", "uneven_tone", "redness"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V"],
        "climate_zones_suitable": ["tropical", "coastal", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/niacinamide-10-zinc-1",
        "rating_avg": 4.7, "review_count": 35800,
    },
    {
        "brand": "minimalist", "product_name": "Salicylic Acid 2% Face Serum",
        "category": "serum", "price_inr": 599.0,
        "key_ingredients": ["salicylic acid 2%", "betaine salicylate", "LHA"],
        "targets_conditions": ["acne", "pores", "texture", "pigmentation"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV"],
        "climate_zones_suitable": ["tropical", "coastal"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/salicylic-acid-2",
        "rating_avg": 4.5, "review_count": 28900,
    },
    {
        "brand": "minimalist", "product_name": "Vitamin C 10% + E + Ferulic",
        "category": "serum", "price_inr": 699.0,
        "key_ingredients": ["ethyl ascorbic acid 10%", "tocopherol", "ferulic acid"],
        "targets_conditions": ["pigmentation", "dark_spots", "uneven_tone", "wrinkles"],
        "skin_types_suitable": ["dry", "normal", "combination"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/vitamin-c-10",
        "rating_avg": 4.4, "review_count": 18700,
    },
    {
        "brand": "minimalist", "product_name": "Hyaluronic Acid 2% + PGA",
        "category": "serum", "price_inr": 549.0,
        "key_ingredients": ["hyaluronic acid 2%", "polyglutamic acid"],
        "targets_conditions": ["dryness", "wrinkles", "texture"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/hyaluronic-acid-2",
        "rating_avg": 4.5, "review_count": 21300,
    },
    {
        "brand": "minimalist", "product_name": "AHA 25% + BHA 5% Peeling Solution",
        "category": "treatment", "price_inr": 699.0,
        "key_ingredients": ["glycolic acid 25%", "salicylic acid 5%", "tartaric acid"],
        "targets_conditions": ["acne", "texture", "pigmentation", "pores"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III"],
        "climate_zones_suitable": ["temperate", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/aha-25-bha-5",
        "rating_avg": 4.3, "review_count": 14200,
    },
    {
        "brand": "minimalist", "product_name": "SPF 60 PA++++ Sunscreen",
        "category": "sunscreen", "price_inr": 399.0,
        "key_ingredients": ["zinc oxide", "tinosorb M", "tinosorb S", "avobenzone"],
        "targets_conditions": ["pigmentation", "dark_spots"],
        "skin_types_suitable": ["oily", "combination", "normal", "dry", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/spf-60",
        "rating_avg": 4.6, "review_count": 41200,
    },
    {
        "brand": "minimalist", "product_name": "Ceramide & Hyaluronic Acid Moisturiser",
        "category": "moisturiser", "price_inr": 499.0,
        "key_ingredients": ["ceramide NP", "ceramide AP", "hyaluronic acid", "niacinamide"],
        "targets_conditions": ["dryness", "redness", "texture"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/ceramide-moisturizer",
        "rating_avg": 4.4, "review_count": 12800,
    },
    {
        "brand": "minimalist", "product_name": "Glycolic Acid 08% Face Toner",
        "category": "toner", "price_inr": 549.0,
        "key_ingredients": ["glycolic acid 8%", "aloe vera", "ginseng extract"],
        "targets_conditions": ["texture", "pores", "uneven_tone", "pigmentation"],
        "skin_types_suitable": ["oily", "combination", "normal"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV"],
        "climate_zones_suitable": ["temperate", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/glycolic-acid-08",
        "rating_avg": 4.3, "review_count": 9800,
    },
    {
        "brand": "minimalist", "product_name": "Retinol 0.3% in Squalane",
        "category": "serum", "price_inr": 699.0,
        "key_ingredients": ["retinol 0.3%", "squalane", "carrot seed oil"],
        "targets_conditions": ["wrinkles", "texture", "acne", "pigmentation"],
        "skin_types_suitable": ["dry", "normal", "combination"],
        "fitzpatrick_suitable": ["II", "III", "IV", "V"],
        "climate_zones_suitable": ["temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://www.beminimalist.co/products/retinol-0-3",
        "rating_avg": 4.5, "review_count": 16400,
    },
]

DERMACO_PRODUCTS = [
    {
        "brand": "dermaco", "product_name": "Dermaco Anti-Acne Facewash",
        "category": "cleanser", "price_inr": 299.0,
        "key_ingredients": ["salicylic acid 1%", "tea tree oil", "niacinamide", "zinc PCA"],
        "targets_conditions": ["acne", "pores", "redness"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV"],
        "climate_zones_suitable": ["tropical", "coastal"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/anti-acne-facewash",
        "rating_avg": 4.2, "review_count": 5600,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco SPF 40 Tinted Sunscreen",
        "category": "sunscreen", "price_inr": 499.0,
        "key_ingredients": ["zinc oxide 10%", "titanium dioxide", "iron oxides"],
        "targets_conditions": ["pigmentation", "dark_spots", "uneven_tone"],
        "skin_types_suitable": ["oily", "combination", "normal"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/spf-40-tinted",
        "rating_avg": 4.4, "review_count": 9200,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Hydrating Gel Moisturiser",
        "category": "moisturiser", "price_inr": 349.0,
        "key_ingredients": ["hyaluronic acid", "aloe vera", "panthenol", "allantoin"],
        "targets_conditions": ["dryness", "redness", "texture"],
        "skin_types_suitable": ["oily", "combination", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/hydrating-gel-moisturiser",
        "rating_avg": 4.3, "review_count": 7800,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Kojic Acid + Arbutin Serum",
        "category": "serum", "price_inr": 749.0,
        "key_ingredients": ["kojic acid 1%", "alpha arbutin 1%", "vitamin C", "licorice root"],
        "targets_conditions": ["dark_spots", "pigmentation", "uneven_tone"],
        "skin_types_suitable": ["dry", "normal", "combination"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "temperate", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/kojic-acid-arbutin-serum",
        "rating_avg": 4.5, "review_count": 4900,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Sensitive Skin Cleanser",
        "category": "cleanser", "price_inr": 349.0,
        "key_ingredients": ["centella asiatica", "ceramides", "glycerin", "allantoin"],
        "targets_conditions": ["redness", "dryness"],
        "skin_types_suitable": ["sensitive", "dry", "normal"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/sensitive-skin-cleanser",
        "rating_avg": 4.3, "review_count": 6100,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Dark Circle Eye Cream",
        "category": "treatment", "price_inr": 549.0,
        "key_ingredients": ["caffeine 3%", "vitamin K", "retinyl palmitate", "peptides"],
        "targets_conditions": ["dark_spots", "wrinkles"],
        "skin_types_suitable": ["dry", "normal", "combination", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/dark-circle-eye-cream",
        "rating_avg": 4.1, "review_count": 3400,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Bakuchiol Anti-Ageing Serum",
        "category": "serum", "price_inr": 899.0,
        "key_ingredients": ["bakuchiol 1%", "peptides", "squalane", "vitamin E"],
        "targets_conditions": ["wrinkles", "texture", "uneven_tone"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/bakuchiol-serum",
        "rating_avg": 4.4, "review_count": 2800,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco 5% Niacinamide Moisturiser",
        "category": "moisturiser", "price_inr": 399.0,
        "key_ingredients": ["niacinamide 5%", "zinc", "ceramides", "squalane"],
        "targets_conditions": ["acne", "pores", "uneven_tone", "redness"],
        "skin_types_suitable": ["oily", "combination", "normal"],
        "fitzpatrick_suitable": ["II", "III", "IV", "V"],
        "climate_zones_suitable": ["tropical", "coastal", "semi_arid"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/niacinamide-moisturiser",
        "rating_avg": 4.3, "review_count": 5200,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Rose Water Toner",
        "category": "toner", "price_inr": 199.0,
        "key_ingredients": ["rose water 90%", "glycerin", "panthenol"],
        "targets_conditions": ["redness", "dryness"],
        "skin_types_suitable": ["sensitive", "dry", "normal"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": False,
        "product_url": "https://dermaco.in/products/rose-water-toner",
        "rating_avg": 3.9, "review_count": 8700,
    },
    {
        "brand": "dermaco", "product_name": "Dermaco Kaolin Clay Purifying Mask",
        "category": "mask", "price_inr": 449.0,
        "key_ingredients": ["kaolin clay", "bentonite clay", "salicylic acid 0.5%", "charcoal"],
        "targets_conditions": ["acne", "pores", "texture"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV"],
        "climate_zones_suitable": ["tropical", "coastal"],
        "is_dermatologist_approved": True,
        "product_url": "https://dermaco.in/products/kaolin-clay-mask",
        "rating_avg": 4.2, "review_count": 3800,
    },
]

# ---------------------------------------------------------------------------
# New derm/pharmacy brands (results-page v2). brand="others" keeps the enum
# intact; brand_display carries the real marketing name. mrp_inr on some rows
# powers the discount filter; pack_size 2/3 powers the combos filter.
# ---------------------------------------------------------------------------
REEQUIL_PRODUCTS = [
    {
        "brand": "others", "brand_display": "Re'equil",
        "product_name": "Re'equil Ultra Matte Dry Touch Sunscreen SPF 50",
        "category": "sunscreen", "price_inr": 545.0, "mrp_inr": 650.0,
        "key_ingredients": ["zinc oxide", "titanium dioxide", "vitamin E"],
        "key_actives": ["zinc oxide", "titanium dioxide"],
        "targets_conditions": ["pigmentation", "dark_spots", "acne"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "arid"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": True,
        "product_url": "https://www.reequil.com/products/ultra-matte-dry-touch-sunscreen-gel-spf-50-pa",
        "rating_avg": 4.5, "review_count": 12400,
    },
    {
        "brand": "others", "brand_display": "Re'equil",
        "product_name": "Re'equil Pilepsta Anti Acne Cream",
        "category": "treatment", "price_inr": 725.0, "mrp_inr": 850.0,
        "key_ingredients": ["azelaic acid", "salicylic acid", "niacinamide"],
        "key_actives": ["azelaic acid", "salicylic acid", "niacinamide"],
        "targets_conditions": ["acne", "pores", "pigmentation"],
        "skin_types_suitable": ["oily", "combination"],
        "fitzpatrick_suitable": ["II", "III", "IV", "V"],
        "climate_zones_suitable": ["tropical", "coastal", "semi_arid"],
        "is_dermatologist_approved": True, "pregnancy_safe": False, "is_new": True,
        "product_url": "https://www.reequil.com/products/pilepsta-anti-acne-cream",
        "rating_avg": 4.3, "review_count": 5400,
    },
    {
        "brand": "others", "brand_display": "Re'equil",
        "product_name": "Re'equil Ceramide & Hyaluronic Acid Moisturiser",
        "category": "moisturiser", "price_inr": 595.0, "mrp_inr": 695.0,
        "key_ingredients": ["ceramides", "hyaluronic acid", "niacinamide"],
        "key_actives": ["ceramide", "hyaluronic acid", "niacinamide"],
        "targets_conditions": ["dryness", "redness", "texture"],
        "skin_types_suitable": ["dry", "normal", "sensitive", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": False,
        "product_url": "https://www.reequil.com/products/ceramide-and-hyaluronic-acid-moisturizer",
        "rating_avg": 4.4, "review_count": 3900,
    },
]

CERAVE_PRODUCTS = [
    {
        "brand": "others", "brand_display": "CeraVe",
        "product_name": "CeraVe Foaming Facial Cleanser",
        "category": "cleanser", "price_inr": 715.0, "mrp_inr": 950.0,
        "key_ingredients": ["ceramides", "niacinamide", "hyaluronic acid"],
        "key_actives": ["ceramide", "niacinamide", "hyaluronic acid"],
        "targets_conditions": ["acne", "pores", "texture"],
        "skin_types_suitable": ["oily", "combination", "normal"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["tropical", "coastal", "temperate"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": True,
        "product_url": "https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser",
        "rating_avg": 4.6, "review_count": 21800,
    },
    {
        "brand": "others", "brand_display": "CeraVe",
        "product_name": "CeraVe Moisturising Cream",
        "category": "moisturiser", "price_inr": 890.0, "mrp_inr": 1100.0,
        "key_ingredients": ["ceramides", "hyaluronic acid", "glycerin"],
        "key_actives": ["ceramide", "hyaluronic acid", "glycerin"],
        "targets_conditions": ["dryness", "redness"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": False,
        "product_url": "https://www.cerave.com/skincare/moisturizers/moisturizing-cream",
        "rating_avg": 4.7, "review_count": 34500,
    },
    {
        "brand": "others", "brand_display": "CeraVe",
        "product_name": "CeraVe Cleanser + Moisturiser Barrier Combo",
        "category": "cleanser", "price_inr": 1450.0, "mrp_inr": 2050.0, "pack_size": 2,
        "key_ingredients": ["ceramides", "niacinamide", "hyaluronic acid"],
        "key_actives": ["ceramide", "niacinamide", "hyaluronic acid"],
        "targets_conditions": ["dryness", "redness", "texture"],
        "skin_types_suitable": ["dry", "normal", "sensitive"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["arid", "semi_arid", "temperate"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": True,
        "product_url": "https://www.cerave.com/skincare/value-sets",
        "rating_avg": 4.6, "review_count": 4100,
    },
]

BIODERMA_PRODUCTS = [
    {
        "brand": "others", "brand_display": "Bioderma",
        "product_name": "Bioderma Sensibio H2O Micellar Water",
        "category": "cleanser", "price_inr": 990.0, "mrp_inr": 1290.0,
        "key_ingredients": ["micellar water", "glycerin", "cucumber extract"],
        "key_actives": ["glycerin"],
        "targets_conditions": ["redness", "dryness"],
        "skin_types_suitable": ["sensitive", "dry", "normal"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["temperate", "arid", "semi_arid", "coastal"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": False,
        "product_url": "https://www.bioderma.in/our-products/sensibio/sensibio-h2o",
        "rating_avg": 4.6, "review_count": 18700,
    },
    {
        "brand": "others", "brand_display": "Bioderma",
        "product_name": "Bioderma Sensibio Defensive Soothing Moisturiser",
        "category": "moisturiser", "price_inr": 1150.0, "mrp_inr": 1450.0,
        "key_ingredients": ["glycerin", "niacinamide", "panthenol"],
        "key_actives": ["glycerin", "niacinamide"],
        "targets_conditions": ["redness", "dryness", "texture"],
        "skin_types_suitable": ["sensitive", "dry", "normal", "combination"],
        "fitzpatrick_suitable": ["I", "II", "III", "IV", "V", "VI"],
        "climate_zones_suitable": ["temperate", "arid", "semi_arid"],
        "is_dermatologist_approved": True, "pregnancy_safe": True, "is_new": True,
        "product_url": "https://www.bioderma.in/our-products/sensibio/sensibio-defensive",
        "rating_avg": 4.4, "review_count": 6300,
    },
]

# ---------------------------------------------------------------------------
# Indian city climate data (static, pre-seeded as a reference table)
# Note: These create EnvironmentProfile rows NOT linked to any user (user_id
# is nullable-null here only for the reference data pattern); in production
# each user's env profile is fetched from OpenWeatherMap on login.
# We insert these into a separate reference: we embed them as comments and
# seed actual user env profiles when users are created.
# ---------------------------------------------------------------------------

CITY_CLIMATE_DATA = {
    "Mumbai": {
        "state": "Maharashtra", "avg_temperature_c": 28.0, "avg_humidity_pct": 72.0,
        "pollution_index": 110.0, "water_hardness": "moderate", "uv_index": 7.5,
        "climate_zone": "tropical",
    },
    "Delhi": {
        "state": "Delhi", "avg_temperature_c": 25.0, "avg_humidity_pct": 55.0,
        "pollution_index": 280.0, "water_hardness": "hard", "uv_index": 6.8,
        "climate_zone": "semi_arid",
    },
    "Pune": {
        "state": "Maharashtra", "avg_temperature_c": 26.0, "avg_humidity_pct": 60.0,
        "pollution_index": 95.0, "water_hardness": "moderate", "uv_index": 6.5,
        "climate_zone": "semi_arid",
    },
    "Bangalore": {
        "state": "Karnataka", "avg_temperature_c": 23.0, "avg_humidity_pct": 65.0,
        "pollution_index": 105.0, "water_hardness": "soft", "uv_index": 5.8,
        "climate_zone": "temperate",
    },
    "Chennai": {
        "state": "Tamil Nadu", "avg_temperature_c": 30.0, "avg_humidity_pct": 78.0,
        "pollution_index": 90.0, "water_hardness": "moderate", "uv_index": 8.2,
        "climate_zone": "tropical",
    },
    "Hyderabad": {
        "state": "Telangana", "avg_temperature_c": 27.0, "avg_humidity_pct": 58.0,
        "pollution_index": 120.0, "water_hardness": "moderate", "uv_index": 6.9,
        "climate_zone": "semi_arid",
    },
    "Kolkata": {
        "state": "West Bengal", "avg_temperature_c": 27.0, "avg_humidity_pct": 80.0,
        "pollution_index": 175.0, "water_hardness": "soft", "uv_index": 5.5,
        "climate_zone": "tropical",
    },
    "Ahmedabad": {
        "state": "Gujarat", "avg_temperature_c": 28.5, "avg_humidity_pct": 45.0,
        "pollution_index": 195.0, "water_hardness": "hard", "uv_index": 8.0,
        "climate_zone": "arid",
    },
    "Jaipur": {
        "state": "Rajasthan", "avg_temperature_c": 26.0, "avg_humidity_pct": 40.0,
        "pollution_index": 145.0, "water_hardness": "very_hard", "uv_index": 8.5,
        "climate_zone": "arid",
    },
    "Kochi": {
        "state": "Kerala", "avg_temperature_c": 29.0, "avg_humidity_pct": 85.0,
        "pollution_index": 60.0, "water_hardness": "soft", "uv_index": 7.8,
        "climate_zone": "coastal",
    },
}

PLATFORM_SETTINGS_DATA = {
    "enable_dermatologist_review": True,
    "enable_waitlist": False,
    "max_scans_per_user_per_day": 3,
    "enable_analytics": True,
    "recommendation_engine_version": "1.0",
    "supported_cities": list(CITY_CLIMATE_DATA.keys()),
    "brands_available": ["nykaa", "minimalist", "dermaco"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _user_exists(session: AsyncSession, email: str) -> bool:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none() is not None


async def seed_admins(session: AsyncSession) -> list[User]:
    print("  Seeding admin users...")
    admins: list[User] = []
    for data in ADMIN_USERS:
        if await _user_exists(session, data["email"]):
            print(f"    skip {data['email']} (exists)")
            result = await session.execute(select(User).where(User.email == data["email"]))
            admins.append(result.scalar_one())
            continue
        user = User(
            id=uuid.uuid4(),
            email=data["email"],
            hashed_password=hash_password("Admin@12345"),
            full_name=data["full_name"],
            role="ADMIN",
            is_verified=True,
        )
        session.add(user)
        await session.flush()
        profile = UserProfile(
            user_id=user.id,
            city=data["city"],
            state=data["state"],
            country="India",
            consent_given_at=datetime.now(timezone.utc),
        )
        session.add(profile)
        admins.append(user)
        print(f"    + {data['email']}")
    return admins


async def seed_dermatologists(session: AsyncSession) -> list[User]:
    print("  Seeding dermatologist users...")
    derms: list[User] = []
    for data in DERMATOLOGIST_USERS:
        if await _user_exists(session, data["email"]):
            print(f"    skip {data['email']} (exists)")
            result = await session.execute(select(User).where(User.email == data["email"]))
            derms.append(result.scalar_one())
            continue
        user = User(
            id=uuid.uuid4(),
            email=data["email"],
            hashed_password=hash_password("Derm@12345"),
            full_name=data["full_name"],
            role="DERMATOLOGIST",
            is_verified=True,
        )
        session.add(user)
        await session.flush()
        profile = UserProfile(
            user_id=user.id,
            city=data["city"],
            state=data["state"],
            country="India",
            consent_given_at=datetime.now(timezone.utc),
        )
        session.add(profile)
        derm_profile = DermatologistProfile(
            user_id=user.id,
            medical_license_number=data["license"],
            specialization=data["specialization"],
            hospital_affiliation=data["hospital"],
            verified_at=datetime.now(timezone.utc),
        )
        session.add(derm_profile)
        derms.append(user)
        print(f"    + {data['email']} ({data['license']})")
    return derms


def _derive_actives(key_ingredients: list[str]) -> list[str]:
    """Normalise key_ingredients into key_actives (strip trailing percentages)."""
    actives: list[str] = []
    for ing in (key_ingredients or []):
        base = ing.lower().strip()
        if "%" in base:
            base = base.split("%")[0].rstrip(" 0123456789.")
        base = base.strip()
        if base and base not in actives:
            actives.append(base)
    return actives


async def seed_products(session: AsyncSession, approval_derm_id: uuid.UUID) -> None:
    print("  Seeding products...")
    all_products = (
        NYKAA_PRODUCTS + MINIMALIST_PRODUCTS + DERMACO_PRODUCTS
        + REEQUIL_PRODUCTS + CERAVE_PRODUCTS + BIODERMA_PRODUCTS
    )
    for p in all_products:
        exists = await session.execute(
            select(Product).where(
                Product.brand == p["brand"],
                Product.product_name == p["product_name"],
            )
        )
        existing = exists.scalar_one_or_none()
        if existing:
            # Backfill the v2 columns on already-seeded rows (mrp/actives/etc.)
            # without disturbing anything else.
            changed = False
            if existing.mrp_inr is None and p.get("mrp_inr") is not None:
                existing.mrp_inr = p["mrp_inr"]; changed = True
            elif existing.mrp_inr is None and existing.price_inr:
                # No explicit MRP — synthesise a modest one so discounts exist.
                existing.mrp_inr = round(existing.price_inr * 1.2, 2); changed = True
            if not existing.key_actives:
                existing.key_actives = p.get("key_actives") or _derive_actives(existing.key_ingredients or []); changed = True
            if existing.brand_display is None and p.get("brand_display"):
                existing.brand_display = p["brand_display"]; changed = True
            if p.get("pack_size") and existing.pack_size in (None, 1):
                existing.pack_size = p["pack_size"]; changed = True
            if p.get("pregnancy_safe") is not None and existing.pregnancy_safe is None:
                existing.pregnancy_safe = p["pregnancy_safe"]; changed = True
            print(f"    ~ backfill {p['brand']}/{p['product_name']}" if changed else f"    skip {p['brand']}/{p['product_name']} (exists)")
            continue
        product = Product(
            id=uuid.uuid4(),
            brand=p["brand"],
            brand_display=p.get("brand_display"),
            product_name=p["product_name"],
            product_url=p.get("product_url"),
            price_inr=p.get("price_inr"),
            mrp_inr=p.get("mrp_inr"),
            pack_size=p.get("pack_size", 1),
            category=p["category"],
            key_ingredients=p.get("key_ingredients", []),
            key_actives=p.get("key_actives") or _derive_actives(p.get("key_ingredients", [])),
            targets_conditions=p.get("targets_conditions", []),
            skin_types_suitable=p.get("skin_types_suitable", []),
            fitzpatrick_suitable=p.get("fitzpatrick_suitable", []),
            climate_zones_suitable=p.get("climate_zones_suitable", []),
            store_links=p.get("store_links", []),
            pregnancy_safe=p.get("pregnancy_safe"),
            is_new=p.get("is_new", False),
            is_dermatologist_approved=p.get("is_dermatologist_approved", False),
            approval_dermatologist_id=approval_derm_id if p.get("is_dermatologist_approved") else None,
            rating_avg=p.get("rating_avg", 0.0),
            review_count=p.get("review_count", 0),
            is_active=True,
        )
        session.add(product)
        print(f"    + [{p.get('brand_display') or p['brand']}] {p['product_name']}")

    # Backfill mrp_inr + key_actives on ALL existing rows not covered above
    # (e.g. rows seeded before v2 that aren't in the current seed lists).
    stragglers = (await session.scalars(
        select(Product).where(Product.is_active.is_(True))
    )).all()
    for prod in stragglers:
        if prod.mrp_inr is None and prod.price_inr:
            prod.mrp_inr = round(prod.price_inr * 1.2, 2)
        if not prod.key_actives:
            prod.key_actives = _derive_actives(prod.key_ingredients or [])


async def seed_platform_settings(session: AsyncSession) -> None:
    print("  Seeding platform settings...")
    for key, value in PLATFORM_SETTINGS_DATA.items():
        exists = await session.execute(
            select(PlatformSetting).where(PlatformSetting.key == key)
        )
        if exists.scalar_one_or_none():
            continue
        setting = PlatformSetting(key=key, value=value)
        session.add(setting)
    print("    + platform settings seeded")


async def reset_seed_tables(session: AsyncSession) -> None:
    print("  WARNING: resetting seed tables (DEV ONLY)...")
    for table in ["recommendation_products", "recommendations", "product_embeddings", "products",
                  "dermatologist_profiles", "user_profiles", "refresh_tokens", "users",
                  "platform_settings"]:
        await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
    print("  Tables truncated.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main(reset: bool = False) -> None:
    # Use the privileged (schema-owner) engine — seeding writes across users and
    # into RLS-protected tables, so it must not run as the least-privilege runtime
    # role. It also coerces the DSN to asyncpg and applies the PgBouncer-safe
    # connect_args (a fresh engine here would fall back to psycopg2 and/or break
    # on the Supabase transaction pooler).
    from app.core.database import migration_engine as engine
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        async with session.begin():
            if reset:
                await reset_seed_tables(session)

            admins = await seed_admins(session)
            derms = await seed_dermatologists(session)

            # Use first dermatologist as the approval signatory for seeded products
            approval_id = derms[0].id if derms else (admins[0].id if admins else uuid.uuid4())
            await seed_products(session, approval_id)
            await seed_platform_settings(session)

    await engine.dispose()
    print("\nSeed complete.")


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    if reset_flag:
        confirm = input("This will TRUNCATE seed tables. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)
    asyncio.run(main(reset=reset_flag))
