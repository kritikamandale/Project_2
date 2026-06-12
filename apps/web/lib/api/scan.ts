/**
 * Typed API client for scan endpoints.
 * All requests are authenticated via the session access token.
 */

import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
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
    skin_type: result.skinType,
    skin_type_confidence: result.skinTypeConfidence,
    fitzpatrick_tone: result.fitzpatrickTone,
    conditions: result.conditions.map((c) => ({
      name: c.name,
      severity: c.severity,
      zone: c.zone,
      confidence: c.confidence,
    })),
    lighting_quality_score: result.lightingQualityScore,
    feature_vector: result.featureVector,
    model_version: result.modelVersion,
    processed_locally: true as const,
    analysis_timestamp: result.analysisTimestamp,
  };

  return apiFetch<ScanSubmitResponse>("/api/scan/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getScan(scanId: string): Promise<ScanDetail> {
  return apiFetch<ScanDetail>(`/api/scan/${scanId}`);
}

export async function getScanHistory(
  page = 1,
  perPage = 10,
): Promise<ScanHistoryResponse> {
  return apiFetch<ScanHistoryResponse>(
    `/api/scan/history?page=${page}&per_page=${perPage}`,
  );
}
