/**
 * Typed API client for questionnaire endpoints.
 * All calls route through Next.js /api/proxy which attaches the Bearer token.
 */

const BASE = "/api/proxy/questionnaire";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.detail?.message ?? body?.detail ?? `Request failed (${res.status})`
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DietType = "veg" | "non_veg" | "vegan" | "mixed";
export type ExerciseFrequency = "none" | "light" | "moderate" | "active";
export type WaterHardness = "soft" | "moderate" | "hard" | "very_hard";
export type ClimateZone = "tropical" | "arid" | "semi_arid" | "temperate" | "coastal";
export type SugarConsumption = "low" | "moderate" | "high";
export type DairyConsumption = "never" | "sometimes" | "daily";
export type StressSource = "work" | "studies" | "family" | "financial" | "other";
export type WorkEnvironment = "indoor_ac" | "indoor_non_ac" | "outdoor" | "mixed";
export type PollutionExposure = "low_city" | "metro" | "industrial";
export type CleanserFrequency = "morning_only" | "morning_night" | "night_only" | "rarely";
export type SunscreenUse = "yes_always" | "sometimes" | "rarely" | "never";
export type RoutineStep =
  | "cleanser" | "toner" | "moisturiser" | "sunscreen"
  | "serum" | "exfoliant" | "face_mask" | "nothing";
export type DiagnosedCondition =
  | "acne" | "rosacea" | "eczema" | "psoriasis"
  | "melasma" | "none" | "prefer_not_to_say";

// Section 8 — lifestyle detail types
export type SpicyFoodFrequency = "never" | "sometimes" | "often" | "daily";
export type JunkFoodFrequency  = "never" | "sometimes" | "often" | "daily";
export type FruitsVeggies      = "less_than_1" | "1_to_2" | "3_to_5" | "more_than_5";
export type Bedtime            = "before_10pm" | "10pm_to_midnight" | "after_midnight";
export type SleepEnvironment   = "ac" | "fan" | "natural_air";
export type SunExposure        = "minimal" | "moderate" | "high" | "very_high";
export type SmokingStatus      = "never" | "ex_smoker" | "occasionally" | "regularly";
export type AlcoholConsumption = "never" | "occasionally" | "regularly";

export interface QuestionnaireSubmitRequest {
  // Section 1
  sleep_hours_avg: number;
  sleep_quality: number;
  sleep_consistency: boolean;
  // Section 2
  water_intake_liters: number;
  diet_type: DietType;
  sugar_consumption: SugarConsumption;
  dairy_consumption: DairyConsumption;
  // Section 3
  stress_level: number;
  stress_source: StressSource[];
  exercise_frequency: ExerciseFrequency;
  // Section 4
  screen_time_hours: number;
  work_environment: WorkEnvironment;
  pollution_exposure: PollutionExposure;
  // Section 5
  city: string;
  water_hardness: WaterHardness;
  // Section 6
  routine_steps: RoutineStep[];
  cleanser_frequency?: CleanserFrequency | null;
  sunscreen_use?: SunscreenUse | null;
  known_allergens_text?: string;
  products_currently_using?: string;
  // Section 7
  diagnosed_conditions: DiagnosedCondition[];
  medication_affects_skin: boolean;
  medication_name_text?: string;
  // Section 8 — optional lifestyle details
  spicy_food_frequency?: SpicyFoodFrequency;
  junk_food_frequency?: JunkFoodFrequency;
  fruits_veggies_per_day?: FruitsVeggies;
  bedtime?: Bedtime;
  phone_before_bed?: boolean;
  sleep_environment?: SleepEnvironment;
  daily_sun_exposure?: SunExposure;
  smoking_status?: SmokingStatus;
  alcohol_consumption?: AlcoholConsumption;
}

export interface ClimateProfile {
  city: string;
  state: string;
  avg_temperature_c: number;
  avg_humidity_pct: number;
  uv_index: number;
  water_hardness: WaterHardness | null;
  climate_zone: ClimateZone;
}

export interface QuestionnaireSubmitResponse {
  questionnaire_id: string;
  message: string;
  climate_profile: ClimateProfile | null;
}

export interface RoutineDetail {
  uses_cleanser: boolean;
  uses_toner: boolean;
  uses_moisturiser: boolean;
  uses_sunscreen: boolean;
  uses_serum: boolean;
  uses_exfoliant: boolean;
  uses_face_mask: boolean;
  uses_nothing: boolean;
  known_allergens_text: string | null;
  products_currently_using: Record<string, string> | null;
}

export interface QuestionnaireDetailResponse {
  id: string;
  submitted_at: string;
  questionnaire_version: number;
  sleep_hours_avg: number | null;
  sleep_quality: number | null;
  sleep_consistency: boolean | null;
  water_intake_liters: number | null;
  diet_type: DietType | null;
  sugar_consumption: SugarConsumption | null;
  dairy_consumption: DairyConsumption | null;
  stress_level: number | null;
  stress_source: StressSource[] | null;
  exercise_frequency: ExerciseFrequency | null;
  screen_time_hours: number | null;
  work_environment: WorkEnvironment | null;
  pollution_exposure: PollutionExposure | null;
  cleanser_frequency: CleanserFrequency | null;
  sunscreen_use: SunscreenUse | null;
  diagnosed_conditions: DiagnosedCondition[] | null;
  medication_affects_skin: boolean | null;
  climate_profile: ClimateProfile | null;
  routine: RoutineDetail | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function submitQuestionnaire(
  body: QuestionnaireSubmitRequest
): Promise<QuestionnaireSubmitResponse> {
  return apiFetch<QuestionnaireSubmitResponse>("/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchClimatePreview(city: string): Promise<ClimateProfile> {
  return apiFetch<ClimateProfile>("/climate-enrich", {
    method: "POST",
    body: JSON.stringify({ city }),
  });
}

export async function getLatestQuestionnaire(): Promise<QuestionnaireDetailResponse> {
  return apiFetch<QuestionnaireDetailResponse>("/latest");
}

export async function updateQuestionnaire(
  id: string,
  body: Partial<QuestionnaireSubmitRequest>
): Promise<QuestionnaireDetailResponse> {
  return apiFetch<QuestionnaireDetailResponse>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getIndianCities(): Promise<string[]> {
  return apiFetch<string[]>("/cities");
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface QuestionnaireHistoryItem {
  id: string;
  submitted_at: string;
  questionnaire_version: number | null;
  sleep_hours_avg: number | null;
  stress_level: number | null;
  water_intake_liters: number | null;
  diet_type: string | null;
  screen_time_hours: number | null;
  sunscreen_use: string | null;
  exercise_frequency: string | null;
}

export interface PaginatedQuestionnaires {
  items: QuestionnaireHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export async function getQuestionnaireHistory(
  page = 1,
  perPage = 20,
): Promise<PaginatedQuestionnaires> {
  return apiFetch<PaginatedQuestionnaires>(`/history?page=${page}&per_page=${perPage}`);
}
