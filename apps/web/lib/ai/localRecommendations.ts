/**
 * Hackathon demo: full client-side recommendation engine.
 * Takes the stored scan + questionnaire data and returns a complete
 * RecommendationDetail object — no Python backend or Claude API needed.
 */

import type { StoredScan, StoredQuestionnaire } from "@/lib/mockStore";

// ---------------------------------------------------------------------------
// Product catalog — real Indian skincare products
// ---------------------------------------------------------------------------

interface CatalogProduct {
  id: string;
  brand: "nykaa" | "minimalist" | "dermaco" | "others";
  product_name: string;
  category: string;
  price_inr: number;
  product_url: string;
  key_ingredients: string[];
  targets_conditions: string[];
  rating_avg: number;
  is_dermatologist_approved: boolean;
  // Selection hints
  suitable_for: string[];      // skin types
  phase: 1 | 2 | 3;
  time_of_day: "morning" | "night" | "both" | "weekly";
  start_week: number;
  is_mandatory: boolean;
}

const CATALOG: CatalogProduct[] = [
  // ── Phase 1: Foundations ──────────────────────────────────────────────────
  {
    id: "min-saw-1",
    brand: "minimalist",
    product_name: "2% Salicylic Acid Face Wash",
    category: "cleanser",
    price_inr: 349,
    product_url: "https://beminimalist.co/products/salicylic-acid-2-face-wash",
    key_ingredients: ["Salicylic Acid 2%", "LHA"],
    targets_conditions: ["acne", "pores", "texture"],
    rating_avg: 4.4,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination"],
    phase: 1,
    time_of_day: "both",
    start_week: 1,
    is_mandatory: true,
  },
  {
    id: "min-hcl-1",
    brand: "minimalist",
    product_name: "Amino Acid + Hyaluronic Acid Cleanser",
    category: "cleanser",
    price_inr: 349,
    product_url: "https://beminimalist.co/products/amino-acid-hyaluronic-acid-face-wash",
    key_ingredients: ["Amino Acids", "Hyaluronic Acid"],
    targets_conditions: ["dryness", "texture"],
    rating_avg: 4.3,
    is_dermatologist_approved: true,
    suitable_for: ["dry", "sensitive", "normal"],
    phase: 1,
    time_of_day: "both",
    start_week: 1,
    is_mandatory: true,
  },
  {
    id: "cet-gcl-1",
    brand: "others",
    product_name: "Gentle Skin Cleanser",
    category: "cleanser",
    price_inr: 599,
    product_url: "https://www.nykaa.com/cetaphil-gentle-skin-cleanser",
    key_ingredients: ["Niacinamide", "Panthenol", "Glycerin"],
    targets_conditions: ["redness", "dryness"],
    rating_avg: 4.5,
    is_dermatologist_approved: true,
    suitable_for: ["sensitive", "normal", "dry"],
    phase: 1,
    time_of_day: "both",
    start_week: 1,
    is_mandatory: true,
  },
  {
    id: "min-spf-1",
    brand: "minimalist",
    product_name: "SPF 50 PA++++ Sunscreen",
    category: "sunscreen",
    price_inr: 399,
    product_url: "https://beminimalist.co/products/spf-50-pa-sunscreen",
    key_ingredients: ["Avobenzone", "Octisalate", "Zinc Oxide"],
    targets_conditions: ["dark_spots", "pigmentation", "uneven_tone"],
    rating_avg: 4.6,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination", "normal"],
    phase: 1,
    time_of_day: "morning",
    start_week: 1,
    is_mandatory: true,
  },
  {
    id: "req-spf-1",
    brand: "others",
    product_name: "Ultra Matte SPF 50 PA++++",
    category: "sunscreen",
    price_inr: 595,
    product_url: "https://www.nykaa.com/re-equil-ultra-matte-dry-touch-sunscreen",
    key_ingredients: ["Tinosorb M", "Tinosorb S", "Zinc Oxide"],
    targets_conditions: ["dark_spots", "pigmentation"],
    rating_avg: 4.5,
    is_dermatologist_approved: true,
    suitable_for: ["oily"],
    phase: 1,
    time_of_day: "morning",
    start_week: 1,
    is_mandatory: true,
  },
  {
    id: "neu-spf-1",
    brand: "others",
    product_name: "Ultra Sheer Dry-Touch SPF 50+",
    category: "sunscreen",
    price_inr: 499,
    product_url: "https://www.nykaa.com/neutrogena-ultra-sheer-dry-touch-sunscreen",
    key_ingredients: ["Helioplex Technology", "Avobenzone"],
    targets_conditions: ["dark_spots", "pigmentation"],
    rating_avg: 4.4,
    is_dermatologist_approved: true,
    suitable_for: ["dry", "sensitive", "normal"],
    phase: 1,
    time_of_day: "morning",
    start_week: 1,
    is_mandatory: true,
  },
  {
    id: "min-moist-1",
    brand: "minimalist",
    product_name: "Multi-Peptide + HA Moisturizer",
    category: "moisturizer",
    price_inr: 699,
    product_url: "https://beminimalist.co/products/multi-peptide-ha-moisturizer",
    key_ingredients: ["5 Peptide Complex", "Hyaluronic Acid", "Ceramides"],
    targets_conditions: ["dryness", "wrinkles", "texture"],
    rating_avg: 4.5,
    is_dermatologist_approved: true,
    suitable_for: ["normal", "oily", "combination", "dry", "sensitive"],
    phase: 1,
    time_of_day: "both",
    start_week: 2,
    is_mandatory: true,
  },
  {
    id: "neu-hb-1",
    brand: "others",
    product_name: "Hydro Boost Water Gel",
    category: "moisturizer",
    price_inr: 899,
    product_url: "https://www.nykaa.com/neutrogena-hydro-boost-water-gel",
    key_ingredients: ["Hyaluronic Acid", "Glycerin"],
    targets_conditions: ["dryness"],
    rating_avg: 4.6,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination"],
    phase: 1,
    time_of_day: "both",
    start_week: 2,
    is_mandatory: true,
  },
  {
    id: "cer-mc-1",
    brand: "others",
    product_name: "CeraVe Moisturizing Cream",
    category: "moisturizer",
    price_inr: 1199,
    product_url: "https://www.nykaa.com/cerave-moisturizing-cream",
    key_ingredients: ["Ceramides", "Hyaluronic Acid", "Niacinamide"],
    targets_conditions: ["dryness", "redness"],
    rating_avg: 4.7,
    is_dermatologist_approved: true,
    suitable_for: ["dry", "sensitive"],
    phase: 1,
    time_of_day: "both",
    start_week: 2,
    is_mandatory: true,
  },

  // ── Phase 2: Targeted treatment ───────────────────────────────────────────
  {
    id: "min-nia-1",
    brand: "minimalist",
    product_name: "10% Niacinamide + Zinc Serum",
    category: "serum",
    price_inr: 599,
    product_url: "https://beminimalist.co/products/niacinamide-10-zinc-1",
    key_ingredients: ["Niacinamide 10%", "Zinc PCA 1%"],
    targets_conditions: ["acne", "pores", "uneven_tone", "dark_spots"],
    rating_avg: 4.6,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination"],
    phase: 2,
    time_of_day: "both",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "min-aa-1",
    brand: "minimalist",
    product_name: "Alpha Arbutin 2% + HA Serum",
    category: "serum",
    price_inr: 599,
    product_url: "https://beminimalist.co/products/alpha-arbutin-2-ha",
    key_ingredients: ["Alpha Arbutin 2%", "Hyaluronic Acid"],
    targets_conditions: ["dark_spots", "pigmentation", "uneven_tone"],
    rating_avg: 4.5,
    is_dermatologist_approved: true,
    suitable_for: ["dry", "normal", "sensitive", "combination"],
    phase: 2,
    time_of_day: "both",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "min-vitc-1",
    brand: "minimalist",
    product_name: "10% Vitamin C Face Serum",
    category: "serum",
    price_inr: 649,
    product_url: "https://beminimalist.co/products/vitamin-c-10-face-serum",
    key_ingredients: ["Ethyl Ascorbic Acid 10%", "Ferulic Acid"],
    targets_conditions: ["dark_spots", "pigmentation", "uneven_tone"],
    rating_avg: 4.4,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination", "normal", "dry"],
    phase: 2,
    time_of_day: "morning",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "min-ha-1",
    brand: "minimalist",
    product_name: "2% Hyaluronic Acid Serum",
    category: "serum",
    price_inr: 349,
    product_url: "https://beminimalist.co/products/hyaluronic-acid-2",
    key_ingredients: ["Hyaluronic Acid 2%", "PGA 0.5%"],
    targets_conditions: ["dryness"],
    rating_avg: 4.5,
    is_dermatologist_approved: true,
    suitable_for: ["dry", "sensitive", "normal"],
    phase: 2,
    time_of_day: "both",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "derm-nia-1",
    brand: "dermaco",
    product_name: "10% Niacinamide Serum",
    category: "serum",
    price_inr: 595,
    product_url: "https://www.nykaa.com/the-derma-co-10-niacinamide-face-serum",
    key_ingredients: ["Niacinamide 10%", "PEG-40 Hydrogenated Castor Oil"],
    targets_conditions: ["acne", "pores", "dark_spots"],
    rating_avg: 4.4,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination", "normal"],
    phase: 2,
    time_of_day: "both",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "derm-vitc-1",
    brand: "dermaco",
    product_name: "10% Vitamin C Serum",
    category: "serum",
    price_inr: 799,
    product_url: "https://www.nykaa.com/the-derma-co-10-vitamin-c-face-serum",
    key_ingredients: ["Vitamin C 10%", "Ferulic Acid", "Vitamin E"],
    targets_conditions: ["dark_spots", "uneven_tone", "pigmentation"],
    rating_avg: 4.3,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination", "normal", "dry"],
    phase: 2,
    time_of_day: "morning",
    start_week: 6,
    is_mandatory: false,
  },
  {
    id: "plum-ton-1",
    brand: "others",
    product_name: "Green Tea Alcohol-Free Toner",
    category: "toner",
    price_inr: 285,
    product_url: "https://www.nykaa.com/plum-green-tea-alcohol-free-toner",
    key_ingredients: ["Green Tea Extract", "Witch Hazel", "Glycerin"],
    targets_conditions: ["acne", "pores", "redness"],
    rating_avg: 4.4,
    is_dermatologist_approved: false,
    suitable_for: ["oily", "combination"],
    phase: 2,
    time_of_day: "both",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "min-pha-1",
    brand: "minimalist",
    product_name: "PHA 3% + BG 4% Toner",
    category: "toner",
    price_inr: 449,
    product_url: "https://beminimalist.co/products/pha-3-bg-4-toner",
    key_ingredients: ["PHA 3%", "Betaine Glucoside 4%"],
    targets_conditions: ["texture", "dryness", "pores"],
    rating_avg: 4.3,
    is_dermatologist_approved: false,
    suitable_for: ["sensitive", "dry", "normal"],
    phase: 2,
    time_of_day: "both",
    start_week: 5,
    is_mandatory: false,
  },
  {
    id: "derm-kojic-1",
    brand: "dermaco",
    product_name: "2% Kojic Acid Face Toner",
    category: "toner",
    price_inr: 595,
    product_url: "https://www.nykaa.com/the-derma-co-2-kojic-acid-face-toner",
    key_ingredients: ["Kojic Acid 2%", "Niacinamide 3%"],
    targets_conditions: ["dark_spots", "pigmentation", "uneven_tone"],
    rating_avg: 4.3,
    is_dermatologist_approved: false,
    suitable_for: ["oily", "combination", "normal"],
    phase: 2,
    time_of_day: "night",
    start_week: 6,
    is_mandatory: false,
  },

  // ── Phase 3: Optimise / boosters ──────────────────────────────────────────
  {
    id: "min-ret-1",
    brand: "minimalist",
    product_name: "0.3% Retinol + 0.2% Peptide Serum",
    category: "treatment",
    price_inr: 689,
    product_url: "https://beminimalist.co/products/retinol-0-3-peptide-0-2",
    key_ingredients: ["Retinol 0.3%", "Granactive Retinoid", "Peptides"],
    targets_conditions: ["wrinkles", "texture", "acne", "dark_spots"],
    rating_avg: 4.5,
    is_dermatologist_approved: true,
    suitable_for: ["normal", "combination", "oily"],
    phase: 3,
    time_of_day: "night",
    start_week: 13,
    is_mandatory: false,
  },
  {
    id: "min-aza-1",
    brand: "minimalist",
    product_name: "10% Azelaic Acid Suspension",
    category: "treatment",
    price_inr: 399,
    product_url: "https://beminimalist.co/products/azelaic-acid-10",
    key_ingredients: ["Azelaic Acid 10%"],
    targets_conditions: ["acne", "redness", "pigmentation"],
    rating_avg: 4.4,
    is_dermatologist_approved: true,
    suitable_for: ["sensitive", "combination", "oily"],
    phase: 3,
    time_of_day: "night",
    start_week: 13,
    is_mandatory: false,
  },
  {
    id: "min-bha-1",
    brand: "minimalist",
    product_name: "2% BHA + Lotus Extract Exfoliator",
    category: "treatment",
    price_inr: 449,
    product_url: "https://beminimalist.co/products/bha-2-lotus-extract",
    key_ingredients: ["Salicylic Acid 2%", "Lotus Extract"],
    targets_conditions: ["acne", "pores", "texture"],
    rating_avg: 4.3,
    is_dermatologist_approved: true,
    suitable_for: ["oily", "combination"],
    phase: 3,
    time_of_day: "night",
    start_week: 14,
    is_mandatory: false,
  },
  {
    id: "derm-mask-1",
    brand: "dermaco",
    product_name: "1% Salicylic Acid + 2% Zinc Face Mask",
    category: "mask",
    price_inr: 449,
    product_url: "https://www.nykaa.com/the-derma-co-1-salicylic-acid-2-zinc-face-mask",
    key_ingredients: ["Salicylic Acid 1%", "Zinc 2%", "Kaolin Clay"],
    targets_conditions: ["acne", "pores"],
    rating_avg: 4.2,
    is_dermatologist_approved: false,
    suitable_for: ["oily", "combination"],
    phase: 3,
    time_of_day: "weekly",
    start_week: 15,
    is_mandatory: false,
  },
];

// ---------------------------------------------------------------------------
// Ingredient rules
// ---------------------------------------------------------------------------

const INGREDIENTS_BY_SKIN_TYPE: Record<string, { use: string[]; avoid: string[] }> = {
  oily: {
    use: ["Niacinamide", "Salicylic Acid", "Zinc", "BHA", "Hyaluronic Acid (lightweight)"],
    avoid: ["Heavy oils", "Coconut oil", "Occlusives", "Thick creams", "Alcohol-based toners"],
  },
  dry: {
    use: ["Ceramides", "Hyaluronic Acid", "Glycerin", "Squalane", "Shea Butter"],
    avoid: ["Salicylic Acid (daily)", "Retinol (without moisturizer)", "Harsh sulfates", "Alcohol"],
  },
  combination: {
    use: ["Niacinamide", "Hyaluronic Acid", "AHAs (gentle)", "Peptides"],
    avoid: ["Heavy oils on T-zone", "Harsh physical scrubs", "Pore-clogging silicones"],
  },
  sensitive: {
    use: ["Centella Asiatica", "Ceramides", "Panthenol", "Allantoin", "Oat Extract"],
    avoid: ["Fragrance", "Essential oils", "High-strength retinol", "Physical scrubs", "AHA above 5%"],
  },
  normal: {
    use: ["Vitamin C", "Peptides", "Retinol (preventative)", "Hyaluronic Acid"],
    avoid: ["Over-exfoliation", "Unnecessary actives", "Too many products at once"],
  },
};

const CONDITION_INGREDIENTS: Record<string, string[]> = {
  acne:        ["Salicylic Acid", "Niacinamide", "Benzoyl Peroxide (spot)", "Azelaic Acid", "Tea Tree (diluted)"],
  dark_spots:  ["Alpha Arbutin", "Vitamin C", "Kojic Acid", "Niacinamide", "Retinol"],
  pigmentation:["Alpha Arbutin", "Vitamin C", "Kojic Acid", "Tranexamic Acid"],
  dryness:     ["Hyaluronic Acid", "Ceramides", "Squalane", "Glycerin", "Panthenol"],
  pores:       ["Niacinamide", "Salicylic Acid", "BHA", "Retinol"],
  wrinkles:    ["Retinol", "Peptides", "Vitamin C", "Hyaluronic Acid"],
  redness:     ["Azelaic Acid", "Centella Asiatica", "Panthenol", "Green Tea Extract"],
  texture:     ["AHA (Glycolic/Lactic)", "BHA", "Retinol", "PHA"],
  uneven_tone: ["Vitamin C", "Alpha Arbutin", "Niacinamide", "AHA"],
};

// ---------------------------------------------------------------------------
// Lifestyle tip rules (based on questionnaire answers)
// ---------------------------------------------------------------------------

function buildLifestyleTips(q: StoredQuestionnaire | null, conditions: string[]): string[] {
  const tips: string[] = [];

  if (!q) {
    return [
      "Drink at least 2–3 litres of water daily — hydration directly affects skin plumpness.",
      "Sleep 7–8 hours consistently. Cortisol spikes from poor sleep worsen acne and dullness.",
      "Apply SPF every morning — even on cloudy days and indoors near windows.",
    ];
  }

  if (q.water_intake_liters < 2) {
    tips.push("You're drinking less than 2L of water daily — aim for 2.5L minimum. Dehydration causes dull, tight skin.");
  }

  if (q.sleep_hours_avg < 6.5) {
    tips.push("Less than 6.5h of sleep raises cortisol, which directly worsens acne and pigmentation. Aim for 7–8h.");
  }

  if (q.stress_level >= 4) {
    tips.push("High stress is a major skin trigger. Even 10 minutes of deep breathing or meditation daily reduces cortisol and breakouts.");
  }

  if (q.sugar_consumption === "high") {
    tips.push("High sugar intake causes insulin spikes that trigger excess sebum production. Cut sugary drinks and sweets for 4 weeks and compare.");
  }

  if (q.dairy_consumption === "daily" && conditions.includes("acne")) {
    tips.push("Daily dairy is a top dietary driver of adult acne. Try switching to oat milk for 30 days and track changes.");
  }

  if (q.sunscreen_use === "never" || q.sunscreen_use === "rarely") {
    tips.push("You're skipping sunscreen — this is the single biggest cause of dark spots, pigmentation, and premature ageing. Apply SPF 50 every morning, no exceptions.");
  }

  if (q.exercise_frequency === "none") {
    tips.push("Exercise improves blood circulation to the skin and lowers stress hormones. Even 20-minute walks 3x a week help skin clarity.");
  }

  if (q.pollution_exposure === "metro" || q.pollution_exposure === "industrial") {
    tips.push("City pollution deposits on skin and clogs pores. Double-cleanse at night (oil cleanser first, then face wash) to remove particulate matter.");
  }

  if (q.work_environment === "indoor_ac") {
    tips.push("AC air is very drying. Keep a facial mist at your desk and use a humidifier. Apply moisturiser mid-afternoon if skin feels tight.");
  }

  if (q.smoking_status === "occasionally" || q.smoking_status === "regularly") {
    tips.push("Smoking depletes Vitamin C in the skin, causing dullness and premature wrinkles. Each cigarette reduces topical Vitamin C effectiveness.");
  }

  if (q.spicy_food_frequency === "daily" || q.spicy_food_frequency === "often") {
    tips.push("Frequent spicy food dilates blood vessels and worsens redness and flushing. Try reducing to 2–3 times a week and see if redness improves.");
  }

  if ((q.junk_food_frequency === "often" || q.junk_food_frequency === "daily") && conditions.includes("acne")) {
    tips.push("Fried and processed food increases glycation and inflammation, both of which worsen acne. Swap with whole grains and home-cooked meals.");
  }

  if (q.fruits_veggies_per_day === "less_than_1") {
    tips.push("You're eating almost no fruits/vegetables — antioxidants in these directly repair skin damage. Add one fruit and one vegetable to every meal.");
  }

  if (q.screen_time_hours > 8) {
    tips.push("High screen time means blue light exposure. This breaks down collagen and causes hyperpigmentation over time — use blue-light-filtering glasses or a screen protector.");
  }

  if (tips.length < 3) {
    tips.push("Consistency is more important than using the best products. Stick to your routine for 90 days before switching anything.");
    tips.push("Patch-test every new product on your inner arm for 24h before applying to your face.");
  }

  return tips.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Climate insight
// ---------------------------------------------------------------------------

const CITY_CLIMATE: Record<string, { humidity: number; uv: number; zone: string; state: string }> = {
  Mumbai:      { humidity: 78, uv: 7.5, zone: "coastal",   state: "Maharashtra" },
  Delhi:       { humidity: 55, uv: 6.5, zone: "semi_arid", state: "Delhi" },
  Bangalore:   { humidity: 62, uv: 6.0, zone: "temperate", state: "Karnataka" },
  Chennai:     { humidity: 75, uv: 8.0, zone: "tropical",  state: "Tamil Nadu" },
  Hyderabad:   { humidity: 58, uv: 7.0, zone: "semi_arid", state: "Telangana" },
  Kolkata:     { humidity: 72, uv: 6.5, zone: "tropical",  state: "West Bengal" },
  Pune:        { humidity: 60, uv: 6.5, zone: "semi_arid", state: "Maharashtra" },
  Ahmedabad:   { humidity: 48, uv: 7.5, zone: "arid",      state: "Gujarat" },
  Jaipur:      { humidity: 42, uv: 7.0, zone: "arid",      state: "Rajasthan" },
  Surat:       { humidity: 68, uv: 7.0, zone: "coastal",   state: "Gujarat" },
  Lucknow:     { humidity: 60, uv: 6.0, zone: "temperate", state: "Uttar Pradesh" },
  Kochi:       { humidity: 80, uv: 8.0, zone: "tropical",  state: "Kerala" },
  Indore:      { humidity: 52, uv: 6.5, zone: "semi_arid", state: "Madhya Pradesh" },
  Bhopal:      { humidity: 54, uv: 6.5, zone: "semi_arid", state: "Madhya Pradesh" },
  Chandigarh:  { humidity: 55, uv: 5.5, zone: "temperate", state: "Punjab" },
};

function buildClimateInsight(city: string, pollution: string | null): string {
  const data = CITY_CLIMATE[city];

  if (!data) {
    if (pollution === "metro") {
      return "Living in a metro city means high PM2.5 exposure. Double-cleanse at night and use antioxidant serums (Vitamin C) to neutralise pollution-induced free radical damage.";
    }
    return "Apply SPF 50 daily and use an antioxidant serum to protect against UV and environmental stress.";
  }

  const parts: string[] = [];

  if (data.humidity > 70) {
    parts.push(`${city}'s high humidity (${data.humidity}%) means lightweight, non-comedogenic formulas are essential — avoid heavy creams that trap sweat and clog pores.`);
  } else if (data.humidity < 50) {
    parts.push(`${city}'s dry climate (${data.humidity}% humidity) means your skin loses moisture faster — apply a humectant serum (Hyaluronic Acid) before moisturiser every day.`);
  } else {
    parts.push(`${city}'s moderate humidity (${data.humidity}%) suits most skin types well.`);
  }

  if (data.uv >= 7.5) {
    parts.push(`UV index in ${city} reaches ${data.uv} — that's intense. SPF 50 PA++++ is non-negotiable, and reapply every 2 hours if you're outdoors.`);
  } else {
    parts.push(`UV index in ${city} is ${data.uv} — apply SPF 50 every morning and reapply mid-afternoon.`);
  }

  if (pollution === "metro" || pollution === "industrial") {
    parts.push("Pollution accelerates skin ageing and hyperpigmentation. Use an antioxidant Vitamin C serum in the morning as a pollution shield.");
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Skin score
// ---------------------------------------------------------------------------

function calcSkinScore(
  scan: StoredScan,
  q: StoredQuestionnaire | null,
): number {
  let score = 80;

  // Condition penalties
  for (const c of scan.conditions) {
    const penalty = c.severity === "severe" ? 12 : c.severity === "moderate" ? 7 : 4;
    score -= penalty;
  }

  if (q) {
    if (q.stress_level >= 4) score -= 5;
    if (q.sleep_hours_avg < 6) score -= 5;
    if (q.sugar_consumption === "high") score -= 4;
    if (q.dairy_consumption === "daily") score -= 3;
    if (q.sunscreen_use === "never") score -= 6;
    if (q.exercise_frequency === "none") score -= 3;
    if (q.smoking_status === "regularly") score -= 7;
    if (q.water_intake_liters < 1.5) score -= 3;
    // Positive modifiers
    if (q.sunscreen_use === "yes_always") score += 4;
    if (q.exercise_frequency === "active") score += 3;
    if (q.fruits_veggies_per_day === "more_than_5") score += 3;
    if (q.sleep_hours_avg >= 7.5) score += 2;
  }

  return Math.max(28, Math.min(94, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Product selection
// ---------------------------------------------------------------------------

function selectProducts(
  skinType: string,
  conditionNames: string[],
  q: StoredQuestionnaire | null,
): ReturnType<typeof buildRecommendedEntry>[] {
  const selected: CatalogProduct[] = [];

  // Phase 1: always add one cleanser, one moisturizer, one sunscreen
  const cleanserCandidates = CATALOG.filter(
    (p) => p.category === "cleanser" && p.phase === 1 && p.suitable_for.includes(skinType),
  );
  const moistCandidates = CATALOG.filter(
    (p) => p.category === "moisturizer" && p.phase === 1 && p.suitable_for.includes(skinType),
  );
  const spfCandidates = CATALOG.filter(
    (p) => p.category === "sunscreen" && p.phase === 1 && p.suitable_for.includes(skinType),
  );

  const cleanser = cleanserCandidates[0] ?? CATALOG.find((p) => p.category === "cleanser");
  const moist    = moistCandidates[0]   ?? CATALOG.find((p) => p.category === "moisturizer");
  const spf      = spfCandidates[0]     ?? CATALOG.find((p) => p.category === "sunscreen");

  if (cleanser) selected.push(cleanser);
  if (moist)    selected.push(moist);
  if (spf)      selected.push(spf);

  // Phase 2: add serums targeting detected conditions
  const conditionPriority = ["acne", "dark_spots", "pigmentation", "uneven_tone", "pores", "dryness", "redness", "texture", "wrinkles"];
  const sortedConditions = conditionPriority.filter((c) => conditionNames.includes(c));

  const addedSerumIds = new Set<string>();
  for (const cond of sortedConditions.slice(0, 2)) {
    const serum = CATALOG.find(
      (p) =>
        p.phase === 2 &&
        (p.category === "serum" || p.category === "toner") &&
        p.targets_conditions.includes(cond) &&
        (p.suitable_for.includes(skinType) || p.suitable_for.length === 0) &&
        !addedSerumIds.has(p.id),
    );
    if (serum) {
      selected.push(serum);
      addedSerumIds.add(serum.id);
    }
  }

  // Phase 3: add one treatment booster based on primary condition
  const primaryCond = sortedConditions[0];
  if (primaryCond) {
    const treatment = CATALOG.find(
      (p) =>
        p.phase === 3 &&
        p.targets_conditions.includes(primaryCond) &&
        (p.suitable_for.includes(skinType) || p.suitable_for.length === 0),
    );
    if (treatment) selected.push(treatment);
  }

  return selected.map((p, i) => buildRecommendedEntry(p, i + 1, skinType, conditionNames));
}

function buildRecommendedEntry(
  p: CatalogProduct,
  order: number,
  skinType: string,
  conditionNames: string[],
) {
  const matchedConditions = p.targets_conditions.filter((c) => conditionNames.includes(c));
  const primaryTarget = matchedConditions[0] ?? p.targets_conditions[0];

  const reasonMap: Record<string, string> = {
    acne:        `Selected because your scan detected acne. ${p.key_ingredients[0]} helps unclog pores and reduce breakouts without over-drying.`,
    dark_spots:  `Your scan shows dark spots on cheeks. ${p.key_ingredients[0]} is clinically proven to reduce hyperpigmentation over 8–12 weeks.`,
    pigmentation:`Recommended for your uneven pigmentation. ${p.key_ingredients[0]} inhibits melanin production for a more even tone.`,
    dryness:     `Your skin shows signs of dryness. ${p.key_ingredients[0]} draws moisture into the skin and holds it there throughout the day.`,
    pores:       `Enlarged pores detected in your T-zone. ${p.key_ingredients[0]} tightens pore appearance and reduces sebum within 4 weeks.`,
    wrinkles:    `Added as a preventative anti-ageing treatment. ${p.key_ingredients[0]} stimulates collagen production and reduces fine lines over 12 weeks.`,
    redness:     `Your scan shows redness. ${p.key_ingredients[0]} calms inflammation and strengthens the skin barrier.`,
    texture:     `Uneven texture detected. ${p.key_ingredients[0]} exfoliates dead cells gently to smooth skin surface over 6 weeks.`,
    uneven_tone: `Recommended for your uneven skin tone. ${p.key_ingredients[0]} evens out tone and adds radiance within 8 weeks.`,
  };

  const usageMap: Record<string, string> = {
    cleanser:   "Apply to damp skin, massage gently for 30–60 seconds, rinse thoroughly. Use morning and night.",
    moisturizer:"Apply 2–3 pumps to clean, slightly damp skin. Gently press in — don't rub.",
    sunscreen:  "Apply a full teaspoon (2mg/cm²) to face and neck as the final morning step. Reapply every 2 hours if outdoors.",
    serum:      `Apply 2–3 drops after toner, before moisturiser. ${p.time_of_day === "night" ? "Night use only." : "Can be used morning and night."}`,
    toner:      "After cleansing, apply with clean hands (no cotton pad) by pressing into skin.",
    treatment:  "Start 2× per week only. Build to 3× by week 16 if no irritation. Always follow with moisturiser.",
    mask:       "Apply a thin layer to clean, dry skin. Leave for 10–15 minutes. Rinse off. Use once a week on a weekend evening.",
  };

  const highlightedIngredient = p.key_ingredients[0] ?? null;

  return {
    id: `entry-${p.id}`,
    product: {
      id: p.id,
      brand: p.brand,
      product_name: p.product_name,
      category: p.category,
      price_inr: p.price_inr,
      product_url: p.product_url,
      key_ingredients: p.key_ingredients,
      targets_conditions: p.targets_conditions,
      rating_avg: p.rating_avg,
      is_dermatologist_approved: p.is_dermatologist_approved,
    },
    order_in_routine: order,
    start_week: p.start_week,
    reason_text: reasonMap[primaryTarget] ?? `Recommended for ${skinType} skin type to address ${primaryTarget?.replace(/_/g, " ")}.`,
    is_mandatory: p.is_mandatory,
    phase: p.phase,
    highlighted_ingredient: highlightedIngredient,
    usage_instruction: usageMap[p.category] ?? null,
    time_of_day: p.time_of_day,
  };
}

// ---------------------------------------------------------------------------
// Morning / night routines
// ---------------------------------------------------------------------------

function buildMorningRoutine(skinType: string, conditions: string[]): string[] {
  const steps = ["Cleanse with your face wash"];

  if (conditions.includes("dark_spots") || conditions.includes("pigmentation") || conditions.includes("uneven_tone")) {
    steps.push("Apply Vitamin C serum — 2–3 drops, pressed in gently");
  }
  if (conditions.includes("acne") || conditions.includes("pores")) {
    steps.push("Apply Niacinamide serum — focus on T-zone and blemish-prone areas");
  }
  if (skinType === "dry" || skinType === "sensitive") {
    steps.push("Apply Hyaluronic Acid serum to damp skin for maximum hydration");
  }

  steps.push("Moisturize — apply to slightly damp skin after serum");
  steps.push("Apply SPF 50 PA++++ — final step, every single morning");

  return steps;
}

function buildNightRoutine(skinType: string, conditions: string[]): string[] {
  const steps = ["Double cleanse — oil cleanser first, then face wash (removes SPF + pollution)"];

  if (conditions.includes("dark_spots") || conditions.includes("pigmentation")) {
    steps.push("Apply Alpha Arbutin serum — 2–3 drops on dark spot areas");
  }
  if (conditions.includes("acne")) {
    steps.push("Apply Niacinamide + Zinc serum to acne-prone areas");
  }
  if (skinType === "dry") {
    steps.push("Apply Hyaluronic Acid on damp skin before moisturizer");
  }
  if (conditions.includes("texture") || conditions.includes("pores")) {
    steps.push("Use BHA toner 3× per week (not daily — alternate nights)");
  }

  steps.push("Apply night moisturizer — can be slightly richer than morning formula");

  return steps;
}

// ---------------------------------------------------------------------------
// Roadmap builder
// ---------------------------------------------------------------------------

const CONDITION_TIMELINES: Record<string, { week: number; pct: number; note: string }> = {
  acne:        { week: 8,  pct: 50, note: "Acne typically reduces 40–50% by week 8 with consistent BHA and Niacinamide use." },
  dark_spots:  { week: 12, pct: 35, note: "Dark spots improve 30–40% by week 12 with Vitamin C + daily SPF 50." },
  pigmentation:{ week: 16, pct: 30, note: "Uneven pigmentation requires 12–16 weeks of Alpha Arbutin + sunscreen." },
  dryness:     { week: 4,  pct: 70, note: "Moisture barrier typically repairs within 3–4 weeks with ceramide moisturiser." },
  pores:       { week: 8,  pct: 25, note: "Pore appearance reduces subtly by week 8 with consistent Niacinamide." },
  wrinkles:    { week: 12, pct: 20, note: "Fine lines improve after 12 weeks of retinol — start 2x/week and build slowly." },
  redness:     { week: 4,  pct: 40, note: "Redness calms within 4 weeks once irritants are removed from the routine." },
  texture:     { week: 6,  pct: 40, note: "Skin texture improves 30–40% after 6 weeks of gentle consistent exfoliation." },
  uneven_tone: { week: 12, pct: 30, note: "Tone evening requires 10–12 weeks with brightening actives + SPF every day." },
};

function buildRoadmap(
  products: ReturnType<typeof buildRecommendedEntry>[],
  conditions: string[],
  city: string,
) {
  const phase1Products = products.filter((p) => p.phase === 1);
  const phase2Products = products.filter((p) => p.phase === 2);
  const phase3Products = products.filter((p) => p.phase === 3);

  const phases = [
    {
      phase: 1, title: "Foundations", weeks_start: 1, weeks_end: 4,
      goal: "Build a safe, gentle routine. Let your skin barrier strengthen before adding actives.",
      product_names: phase1Products.map((p) => p.product.product_name),
    },
    {
      phase: 2, title: "Targeted Treatment", weeks_start: 5, weeks_end: 12,
      goal: "Introduce targeted actives for your primary concerns. Patch-test each new product for 24h first.",
      product_names: phase2Products.map((p) => p.product.product_name),
    },
    {
      phase: 3, title: "Optimise & Boost", weeks_start: 13, weeks_end: 20,
      goal: "Layer in secondary treatments once skin is accustomed to Phase 2 actives.",
      product_names: phase3Products.map((p) => p.product.product_name),
    },
  ];

  // Week entries
  const week_entries = [];
  const introduced = new Set<string>();

  for (let week = 1; week <= 20; week++) {
    const phaseNum = week <= 4 ? 1 : week <= 12 ? 2 : 3;
    const phaseProds = products.filter((p) => p.phase === phaseNum && p.start_week === week);
    const newThisWeek = phaseProds.filter((p) => !introduced.has(p.product.product_name));

    if (newThisWeek.length > 0) {
      for (const prod of newThisWeek) {
        introduced.add(prod.product.product_name);
        const intro = week === 1
          ? `Start with ${prod.product.product_name} only. Use ${prod.time_of_day === "morning" ? "every morning" : prod.time_of_day === "night" ? "every evening" : "morning and night"}. Let your skin adjust.`
          : `Introduce ${prod.product.product_name}. Patch-test on inner arm for 24h first. ${prod.usage_instruction ?? ""}`;
        const climateNote = week === 1 && CITY_CLIMATE[city]?.humidity > 70
          ? ` Given ${city}'s high humidity, choose lightweight non-comedogenic formulas.`
          : "";
        week_entries.push({ week, phase: phaseNum, action: `Introduce ${prod.product.product_name}`, product_name: prod.product.product_name, instruction: intro + climateNote, is_introduction: true });
      }
    } else {
      const activeNames = [...introduced].slice(0, 2).join(" + ");
      week_entries.push({
        week, phase: phaseNum,
        action: week <= 4 ? "Focus on basics" : "Continue routine",
        product_name: null,
        instruction: activeNames
          ? `Maintain your routine: ${activeNames}. Consistency is key.`
          : "Rest week — no new products. Let your skin stabilise.",
        is_introduction: false,
      });
    }
  }

  const condition_timelines = conditions
    .filter((c) => CONDITION_TIMELINES[c])
    .map((c) => ({
      condition: c,
      expected_improvement_week: CONDITION_TIMELINES[c].week,
      expected_improvement_pct: CONDITION_TIMELINES[c].pct,
      note: CONDITION_TIMELINES[c].note,
    }));

  return { total_weeks: 20, phases, week_entries, condition_timelines };
}

// ---------------------------------------------------------------------------
// Allergen flags
// ---------------------------------------------------------------------------

function buildAllergenFlags(
  knownAllergens: string | null,
  products: ReturnType<typeof buildRecommendedEntry>[],
): string[] {
  if (!knownAllergens) return [];
  const flags: string[] = [];
  const allergenList = knownAllergens.toLowerCase().split(/[,;]+/).map((s) => s.trim());

  for (const prod of products) {
    for (const allergen of allergenList) {
      const match = prod.product.key_ingredients?.find((ing) =>
        ing.toLowerCase().includes(allergen),
      );
      if (match) {
        flags.push(`${prod.product.product_name} contains ${match} — you listed this as a known allergen. Patch-test carefully or consult a dermatologist before use.`);
      }
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Dermatologist note
// ---------------------------------------------------------------------------

function buildDermNote(
  skinType: string,
  conditions: string[],
  q: StoredQuestionnaire | null,
): string {
  const hasAcne = conditions.includes("acne");
  const hasPigmentation = conditions.includes("dark_spots") || conditions.includes("pigmentation");
  const isDry = skinType === "dry";

  if (hasAcne && q?.diagnosed_conditions?.includes("acne")) {
    return "Your scan and lifestyle profile both indicate active acne. The recommended routine targets this with BHA and Niacinamide, but if you see no improvement in 10–12 weeks or develop cystic lesions, consult a dermatologist — prescription options like Clindamycin or Adapalene may be needed.";
  }
  if (hasPigmentation) {
    return "Post-inflammatory hyperpigmentation and dark spots respond well to the Alpha Arbutin + Vitamin C combination, but results require 90+ days of consistent use with daily SPF. Do not skip sunscreen — it is as important as the treatment serum.";
  }
  if (isDry) {
    return "Dry skin often indicates a compromised skin barrier. Avoid hot water while washing, use gentle sulfate-free cleansers, and apply moisturiser within 60 seconds of patting skin dry to lock in water. Give the barrier-repair routine 4 full weeks before adding any actives.";
  }
  return "Your routine is designed to be introduced gradually. Introduce one new product at a time, wait 2 weeks before adding the next, and always patch-test. If you experience persistent irritation, redness, or breakouts, pause actives for a week and return to just cleanser + moisturiser + SPF.";
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeRecommendation(
  scan: StoredScan,
  q: StoredQuestionnaire | null,
  recommendationId = "demo-rec-001",
): Record<string, unknown> {
  const skinType = scan.skin_type ?? "normal";
  const conditions = scan.conditions ?? [];
  const conditionNames = conditions.map((c) => c.name);

  const skinScore = calcSkinScore(scan, q);
  const products = selectProducts(skinType, conditionNames, q);

  const ingredientsForSkinType = INGREDIENTS_BY_SKIN_TYPE[skinType] ?? INGREDIENTS_BY_SKIN_TYPE.normal;
  const conditionIngredients = conditionNames.flatMap((c) => CONDITION_INGREDIENTS[c] ?? []);
  const ingredientsToUse = [...new Set([...conditionIngredients.slice(0, 3), ...ingredientsForSkinType.use.slice(0, 3)])].slice(0, 7);
  const ingredientsToAvoid = ingredientsForSkinType.avoid.slice(0, 5);

  const morningRoutine = buildMorningRoutine(skinType, conditionNames);
  const nightRoutine   = buildNightRoutine(skinType, conditionNames);
  const lifestyleTips  = buildLifestyleTips(q, conditionNames);
  const climateInsight = buildClimateInsight(q?.city ?? "", q?.pollution_exposure ?? null);
  const roadmap        = buildRoadmap(products, conditionNames, q?.city ?? "");
  const allergenFlags  = buildAllergenFlags(q?.known_allergens_text ?? null, products);
  const dermNote       = buildDermNote(skinType, conditionNames, q);

  const mandatoryProducts = products.filter((p) => p.is_mandatory);
  const estimatedMonthlyCost = mandatoryProducts.reduce((sum, p) => sum + (p.product.price_inr ?? 0), 0);

  const requiresDermReview =
    conditions.some((c) => c.severity === "severe") ||
    (q?.diagnosed_conditions ?? []).some((d) => ["eczema", "psoriasis", "rosacea"].includes(d));

  return {
    id: recommendationId,
    user_id: "demo-user-001",
    scan_id: scan.scan_id,
    questionnaire_id: q?.questionnaire_id ?? null,
    generated_at: new Date().toISOString(),
    recommendation_engine_version: "demo-v1.0",
    skin_score: skinScore,
    skin_type: skinType,
    fitzpatrick_tone: scan.fitzpatrick_tone,
    conditions_summary: conditions.map((c) => ({
      condition_name: c.name,
      severity: c.severity,
      affected_zone: c.zone,
      confidence_score: c.confidence,
    })),
    products,
    roadmap,
    climate_insight: climateInsight,
    estimated_monthly_cost_inr: estimatedMonthlyCost,
    morning_routine: morningRoutine,
    night_routine: nightRoutine,
    ingredients_to_use: ingredientsToUse,
    ingredients_to_avoid: ingredientsToAvoid,
    lifestyle_tips: lifestyleTips,
    dermatologist_note: dermNote,
    allergen_flags: allergenFlags,
    requires_derm_review: requiresDermReview,
    is_dermatologist_reviewed: false,
    reviewer_id: null,
    reviewed_at: null,
    feedback_rating: null,
  };
}
