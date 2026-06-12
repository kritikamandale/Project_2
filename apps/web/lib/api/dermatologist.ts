/**
 * Dermatologist portal API client — Phase 8.
 * All calls route through /api/proxy → FastAPI /api/v1/dermatologist/...
 */

import { api } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewQueueItem {
  queue_id: string;
  recommendation_id: string;
  patient_id: string;
  skin_type: string | null;
  fitzpatrick_tone: string | null;
  top_conditions: string[];
  submission_date: string;
  priority: "high" | "normal" | "low";
  status: "pending" | "in_review" | "approved" | "rejected" | "escalated";
  age_group: string | null;
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ConditionDetail {
  name: string;
  severity: string;
  affected_zone: string | null;
}

export interface AnonymizedPatient {
  patient_id: string;
  age_group: string | null;
  gender: string | null;
  city: string | null;
  skin_type: string | null;
  fitzpatrick_tone: string | null;
  conditions: ConditionDetail[];
  confidence_score: number | null;
  // lifestyle
  sleep_hours_avg: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  water_intake_liters: number | null;
  diet_type: string | null;
  exercise_frequency: string | null;
  work_environment: string | null;
  pollution_exposure: string | null;
  // climate
  climate_zone: string | null;
  avg_humidity_pct: number | null;
  uv_index: number | null;
  water_hardness: string | null;
  // routine
  current_routine_items: string[];
  // medical
  diagnosed_conditions: string[];
  medication_affects_skin: boolean | null;
  medication_name: string | null;
}

export interface ProductForReview {
  recommendation_product_id: string;
  product_id: string;
  product_name: string;
  brand: string;
  category: string;
  key_ingredients: string[];
  price_inr: number | null;
  product_url: string | null;
  ai_reasoning: string;
  highlighted_ingredient: string | null;
  usage_instruction: string | null;
  time_of_day: string | null;
  phase: number;
  order_in_routine: number;
  derm_action: "approve" | "modify" | "remove" | null;
  derm_override_note: string | null;
}

export interface CaseDetailResponse {
  recommendation_id: string;
  queue_id: string;
  status: string;
  priority: string;
  requires_derm_review: boolean;
  patient: AnonymizedPatient;
  ai_summary: string | null;
  skin_score: number | null;
  confidence_score: number | null;
  estimated_monthly_cost_inr: number | null;
  allergen_flags: string[];
  products: ProductForReview[];
  roadmap_phase_count: number;
  roadmap_total_weeks: number;
  patient_note: string | null;
  submission_date: string;
  review_started_at: string | null;
}

export interface ProductActionRequest {
  action: "approve" | "modify" | "remove";
  override_note?: string;
}

export interface ReviewSubmitRequest {
  decision: "approved" | "rejected" | "request_info";
  reviewer_notes?: string;
  patient_note?: string;
  product_actions?: Record<string, ProductActionRequest>;
}

export interface ReviewSubmitResponse {
  recommendation_id: string;
  new_status: string;
  reviewed_at: string;
  message: string;
}

export interface ProductOverrideRequest {
  action: "approve" | "modify" | "remove";
  override_note?: string;
}

export interface ProductOverrideResponse {
  recommendation_product_id: string;
  action: string;
  message: string;
}

export interface DermStatsResponse {
  total_assigned_this_month: number;
  pending_review: number;
  approved_today: number;
  avg_review_time_minutes: number | null;
}

export interface ProductSuggestionRequest {
  product_name: string;
  brand: string;
  category: string;
  price_inr?: number;
  product_url?: string;
  key_ingredients: string[];
  targets_conditions: string[];
  reason_for_suggestion: string;
}

export interface ProductSuggestionResponse {
  suggestion_id: string;
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Queue filters
// ---------------------------------------------------------------------------

export interface QueueFilters {
  page?: number;
  per_page?: number;
  status?: string;
  skin_type?: string;
  priority?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: "submission_date" | "priority" | "status";
  sort_dir?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

function buildQs(params: Record<string, string | number | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export const dermApi = {
  /** GET /derm/queue */
  getQueue(filters: QueueFilters = {}): Promise<ReviewQueueResponse> {
    const qs = buildQs({
      page: filters.page ?? 1,
      per_page: filters.per_page ?? 20,
      status: filters.status,
      skin_type: filters.skin_type,
      priority: filters.priority,
      date_from: filters.date_from,
      date_to: filters.date_to,
      sort_by: filters.sort_by ?? "submission_date",
      sort_dir: filters.sort_dir ?? "asc",
    });
    return api.get<ReviewQueueResponse>(`dermatologist/queue${qs}`);
  },

  /** GET /derm/case/:id */
  getCase(recommendationId: string): Promise<CaseDetailResponse> {
    return api.get<CaseDetailResponse>(`dermatologist/case/${recommendationId}`);
  },

  /** POST /derm/case/:id/review */
  submitReview(
    recommendationId: string,
    payload: ReviewSubmitRequest
  ): Promise<ReviewSubmitResponse> {
    return api.post<ReviewSubmitResponse>(
      `dermatologist/case/${recommendationId}/review`,
      payload
    );
  },

  /** PUT /derm/case/:recId/product/:prodId */
  overrideProduct(
    recommendationId: string,
    productId: string,
    payload: ProductOverrideRequest
  ): Promise<ProductOverrideResponse> {
    return fetch(
      `/api/proxy/dermatologist/case/${recommendationId}/product/${productId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    ).then((r) => r.json() as Promise<ProductOverrideResponse>);
  },

  /** GET /derm/stats */
  getStats(): Promise<DermStatsResponse> {
    return api.get<DermStatsResponse>("dermatologist/stats");
  },

  /** POST /derm/products/suggest */
  suggestProduct(
    payload: ProductSuggestionRequest
  ): Promise<ProductSuggestionResponse> {
    return api.post<ProductSuggestionResponse>(
      "dermatologist/products/suggest",
      payload
    );
  },
};
