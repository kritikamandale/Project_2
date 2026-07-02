/**
 * Typed API client for scan endpoints.
 * All requests route through /api/proxy which attaches the Bearer token
 * server-side — never calling FastAPI directly from the browser.
 */

import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";

const BASE = "/api/proxy";

// ---------------------------------------------------------------------------
// Response types (mirroring backend schemas)
// ---------------------------------------------------------------------------

export interface ScanSubmitResponse {
  scan_id: string;
  message: string;
  skin_type: string;
  fitzpatrick_tone: string;
  confidence: number;
  conditions_detected: number;
  bias_flag: boolean;
  bias_message: string | null;
}

export interface ScanCondition {
  id: string;
  condition_name: string;
  severity: string;
  affected_zone: string;
  confidence_score: number | null;
}

export interface ScanDetail {
  id: string;
  user_id: string;
  scan_timestamp: string;
  skin_type: string | null;
  analysis_confidence_score: number | null;
  lighting_quality_score: number | null;
  fitzpatrick_tone: string | null;
  image_permanently_deleted: boolean;
  image_was_processed_locally: boolean;
  conditions: ScanCondition[];
  created_at: string;
}

export interface ScanSummary {
  id: string;
  scan_timestamp: string;
  skin_type: string | null;
  analysis_confidence_score: number | null;
  created_at: string;
}

export interface ScanHistoryResponse {
  items: ScanSummary[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail?.message ?? body?.detail ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * Submit a completed skin analysis to the server.
 * Only the 512-dim feature vector and classification labels are sent — never the raw image.
 */
export async function submitScan(result: SkinAnalysisResult): Promise<ScanSubmitResponse> {
  const body = {
    skin_type: result.skin_type,
    skin_type_confidence: result.skin_type_confidence,
    fitzpatrick_tone: result.fitzpatrick_tone,
    conditions: result.conditions.map((c) => ({
      name: c.name,
      severity: c.severity,
      zone: c.zone,
      confidence: c.confidence,
    })),
    lighting_quality_score: result.lighting_quality_score,
    feature_vector: result.feature_vector,
    model_version: result.model_version,
    processed_locally: true as const,
    analysis_timestamp: result.analysis_timestamp,
  };

  return apiFetch<ScanSubmitResponse>("scan/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getScan(scanId: string): Promise<ScanDetail> {
  return apiFetch<ScanDetail>(`scan/${scanId}`);
}

export async function getScanHistory(
  page = 1,
  perPage = 10,
): Promise<ScanHistoryResponse> {
  return apiFetch<ScanHistoryResponse>(
    `scan/history?page=${page}&per_page=${perPage}`,
  );
}
