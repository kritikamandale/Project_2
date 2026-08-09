/**
 * Typed API client for recommendation endpoints.
 * Routes through Next.js /api/proxy which attaches the Bearer token.
 */

const BASE = "/api/proxy/recommendations";

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

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types — mirror backend schemas
// ---------------------------------------------------------------------------

export interface ProductInRecommendation {
  id: string;
  brand: string;
  brand_display?: string | null;
  product_name: string;
  category: string;
  price_inr: number | null;
  product_url: string | null;
  image_url: string | null;
  key_ingredients: string[] | null;
  targets_conditions: string[] | null;
  rating_avg: number;
  is_dermatologist_approved: boolean;
}

export interface RecommendedProductEntry {
  id: string;
  product: ProductInRecommendation;
  order_in_routine: number;
  start_week: number;
  reason_text: string | null;
  is_mandatory: boolean;
  phase: 1 | 2 | 3;
  highlighted_ingredient: string | null;
  usage_instruction: string | null;
  time_of_day: "morning" | "night" | "both" | "weekly" | null;
}

export interface RoadmapWeekEntry {
  week: number;
  phase: 1 | 2 | 3;
  action: string;
  product_name: string | null;
  instruction: string;
  is_introduction: boolean;
}

export interface RoadmapPhase {
  phase: 1 | 2 | 3;
  title: string;
  weeks_start: number;
  weeks_end: number;
  goal: string;
  product_names: string[];
}

export interface ConditionTimeline {
  condition: string;
  expected_improvement_week: number;
  expected_improvement_pct: number;
  note: string;
}

export interface RoadmapResponse {
  total_weeks: number;
  phases: RoadmapPhase[];
  week_entries: RoadmapWeekEntry[];
  condition_timelines: ConditionTimeline[];
}

export interface ConditionSummary {
  condition_name: string;
  severity: "none" | "mild" | "moderate" | "severe";
  affected_zone: string;
  confidence_score: number | null;
}

export interface RecommendationDetail {
  id: string;
  user_id: string;
  scan_id: string;
  questionnaire_id: string | null;
  generated_at: string;
  recommendation_engine_version: string;

  skin_score: number | null;
  skin_type: string | null;
  fitzpatrick_tone: string | null;
  conditions_summary: ConditionSummary[];

  products: RecommendedProductEntry[];
  roadmap: RoadmapResponse | null;

  climate_insight: string | null;
  estimated_monthly_cost_inr: number | null;
  morning_routine: string[];
  night_routine: string[];
  ingredients_to_use: string[];
  ingredients_to_avoid: string[];
  lifestyle_tips: string[];
  dermatologist_note: string | null;

  allergen_flags: string[];
  requires_derm_review: boolean;
  is_dermatologist_reviewed: boolean;
  reviewer_id: string | null;
  reviewed_at: string | null;

  feedback_rating: number | null;
}

export interface GenerateRecommendationRequest {
  scan_id: string;
  questionnaire_id?: string;
}

export interface GenerateRecommendationResponse {
  recommendation_id: string;
  message: string;
  skin_score: number | null;
  products_count: number;
  requires_derm_review: boolean;
  estimated_monthly_cost_inr: number | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function generateRecommendation(
  req: GenerateRecommendationRequest
): Promise<GenerateRecommendationResponse> {
  return apiFetch<GenerateRecommendationResponse>("/generate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getRecommendation(id: string): Promise<RecommendationDetail> {
  return apiFetch<RecommendationDetail>(`/${id}`);
}

export async function getLatestRecommendation(): Promise<RecommendationDetail> {
  return apiFetch<RecommendationDetail>("/latest");
}

export async function getRecommendationRoadmap(id: string): Promise<RoadmapResponse> {
  return apiFetch<RoadmapResponse>(`/${id}/roadmap`);
}

export async function getRecommendationProducts(
  id: string
): Promise<RecommendedProductEntry[]> {
  return apiFetch<RecommendedProductEntry[]>(`/${id}/products`);
}

export async function submitRecommendationFeedback(
  id: string,
  rating: number,
  text?: string
): Promise<void> {
  return apiFetch<void>(`/${id}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating, text: text ?? null }),
  });
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface RecommendationHistoryItem {
  id: string;
  scan_id: string | null;
  questionnaire_id: string | null;
  generated_at: string;
  skin_score: number | null;
  roadmap_weeks: number;
  estimated_monthly_cost_inr: number | null;
  products_count: number;
  is_dermatologist_reviewed: boolean;
  requires_derm_review: boolean;
  feedback_rating: number | null;
}

export interface PaginatedRecommendationHistory {
  items: RecommendationHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export async function getRecommendationHistory(
  page = 1,
  perPage = 20,
): Promise<PaginatedRecommendationHistory> {
  return apiFetch<PaginatedRecommendationHistory>(
    `/history?page=${page}&per_page=${perPage}`,
  );
}
