/**
 * Typed API client for routine-level reasoning — Phase 3.
 * Routes through Next.js /api/proxy which attaches the Bearer token.
 *
 * Mirrors app/schemas/routine.py — POST /products/routine-check (cost,
 * conflicts, duplicate actives, gaps, AM/PM layering) and
 * GET /products/optimise-routine ("fit my routine under ₹X").
 */

import type { Product, ProductCategory } from "./products";

const BASE = "/api/proxy/products";

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
// Types — mirror backend schemas (app/schemas/routine.py)
// ---------------------------------------------------------------------------

export interface ConflictPair {
  active_a: string;
  active_b: string;
  reason: string;
  products_a: string[];
  products_b: string[];
}

export interface DuplicateActive {
  active: string;
  product_names: string[];
  message: string;
}

export type RoutineGapCode = "missing_sunscreen" | "missing_moisturiser" | "missing_cleanser";

export interface RoutineGap {
  code: RoutineGapCode;
  message: string;
}

export interface LayerStep {
  order: number;
  product_id: string | null;
  product_name: string | null;
  step_label: string;
  wait_minutes: number;
  note: string | null;
}

export interface LayeringPlan {
  am: LayerStep[];
  pm: LayerStep[];
}

export interface RoutineCheckResponse {
  total_cost_inr: number;
  cost_per_day_inr: number;
  conflicts: ConflictPair[];
  duplicate_actives: DuplicateActive[];
  gaps: RoutineGap[];
  layering: LayeringPlan;
}

export interface OptimisedStep {
  step_label: string;
  category: ProductCategory;
  product: Product | null;
}

export interface OptimiseRoutineResponse {
  steps: OptimisedStep[];
  total_cost_inr: number;
  cost_per_day_inr: number;
  drop_suggestion: string | null;
}

export interface OptimiseRoutineParams {
  budget_inr: number;
  steps?: 3 | 4 | 5;
  skin_type?: string | null;
  condition?: string | null;
  climate_zone?: string | null;
  fitzpatrick?: string | null;
  scan_id?: string | null;
  questionnaire_id?: string | null;
  pregnant?: boolean;
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export async function checkRoutine(productIds: string[]): Promise<RoutineCheckResponse> {
  return apiFetch<RoutineCheckResponse>("/routine-check", {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds }),
  });
}

export async function optimiseRoutine(
  params: OptimiseRoutineParams
): Promise<OptimiseRoutineResponse> {
  const q = new URLSearchParams();
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    q.append(key, String(value));
  };

  add("budget_inr", params.budget_inr);
  add("steps", params.steps);
  add("skin_type", params.skin_type);
  add("condition", params.condition);
  add("climate_zone", params.climate_zone);
  add("fitzpatrick", params.fitzpatrick);
  add("scan_id", params.scan_id);
  add("questionnaire_id", params.questionnaire_id);
  add("pregnant", params.pregnant);

  return apiFetch<OptimiseRoutineResponse>(`/optimise-routine?${q.toString()}`);
}
