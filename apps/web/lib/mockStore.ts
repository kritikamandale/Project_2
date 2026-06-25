/**
 * In-memory store for the hackathon demo mode.
 * Holds questionnaire and scan data between API route invocations.
 * Resets when the dev server restarts — fine for a demo.
 */

export interface StoredScan {
  scan_id: string;
  skin_type: string;
  fitzpatrick_tone: string;
  skin_type_confidence: number;
  conditions: Array<{
    name: string;
    severity: string;
    zone: string;
    confidence: number;
  }>;
  lighting_quality_score: number;
  model_version: string;
  analysis_timestamp: string;
}

export interface StoredQuestionnaire {
  questionnaire_id: string;
  submitted_at: string;
  sleep_hours_avg: number;
  sleep_quality: number;
  sleep_consistency: boolean;
  water_intake_liters: number;
  diet_type: string;
  sugar_consumption: string;
  dairy_consumption: string;
  stress_level: number;
  stress_source: string[];
  exercise_frequency: string;
  screen_time_hours: number;
  work_environment: string;
  pollution_exposure: string;
  city: string;
  water_hardness: string;
  routine_steps: string[];
  sunscreen_use: string | null;
  known_allergens_text: string | null;
  diagnosed_conditions: string[];
  medication_affects_skin: boolean;
  spicy_food_frequency: string | null;
  junk_food_frequency: string | null;
  fruits_veggies_per_day: string | null;
  sleep_environment: string | null;
  daily_sun_exposure: string | null;
  smoking_status: string | null;
  alcohol_consumption: string | null;
}

export interface StoredRecommendation {
  recommendation_id: string;
  generated_at: string;
  data: Record<string, unknown>;
}

const store: {
  questionnaire: StoredQuestionnaire | null;
  scan: StoredScan | null;
  recommendation: StoredRecommendation | null;
} = {
  questionnaire: null,
  scan: null,
  recommendation: null,
};

export function setQuestionnaire(q: StoredQuestionnaire) {
  store.questionnaire = q;
}
export function getQuestionnaire(): StoredQuestionnaire | null {
  return store.questionnaire;
}

export function setScan(s: StoredScan) {
  store.scan = s;
}
export function getScan(): StoredScan | null {
  return store.scan;
}

export function setRecommendation(r: StoredRecommendation) {
  store.recommendation = r;
}
export function getRecommendation(): StoredRecommendation | null {
  return store.recommendation;
}
