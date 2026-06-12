/**
 * Typed API client for Phase 7 progress tracking endpoints.
 */

import { api } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImprovementStatus = "improved" | "unchanged" | "worsened";
export type AdherenceLevel = "yes" | "mostly" | "no";
export type ProductRating = "working" | "unsure" | "not_working";
export type NotificationType =
  | "scan_reminder"
  | "derm_review_complete"
  | "new_product_suggestion"
  | "routine_tip";
export type AlertType = "worsened_condition" | "slow_progress" | "overdue_scan";

export interface ProgressMetric {
  id: string;
  metric_name: string;
  previous_value: number | null;
  current_value: number | null;
  improvement_pct: number | null;
}

export interface ConditionScoreItem {
  condition: string;
  severity: number; // 0–3
}

export interface ProgressScanCreate {
  recommendation_id: string;
  scan_id?: string;
  overall_skin_score: number;
  condition_scores?: ConditionScoreItem[];
  notes?: string;
}

export interface ProgressScanResponse {
  id: string;
  user_id: string;
  recommendation_id: string | null;
  scan_id: string | null;
  scan_number: number;
  scanned_at: string;
  overall_skin_score: number | null;
  delta_from_baseline: number | null;
  notes: string | null;
  metrics: ProgressMetric[];
  celebration_threshold_met: boolean;
  slow_progress_flag: boolean;
}

export interface TimelinePoint {
  id: string;
  scan_number: number;
  scanned_at: string;
  overall_skin_score: number | null;
  delta_from_baseline: number | null;
}

export interface TimelineResponse {
  user_id: string;
  total_scans: number;
  baseline_score: number | null;
  latest_score: number | null;
  total_improvement: number | null;
  improvement_pct: number | null;
  points: TimelinePoint[];
}

export interface ConditionProgressItem {
  condition: string;
  baseline_severity: number | null;
  latest_severity: number | null;
  improvement_pct: number | null;
  status: ImprovementStatus;
  scan_history: number[];
}

export interface ConditionsProgressResponse {
  user_id: string;
  conditions: ConditionProgressItem[];
}

export interface RoutineCheckinCreate {
  adherence: AdherenceLevel;
  checkin_date?: string;
  notes?: string;
}

export interface RoutineCheckinResponse {
  id: string;
  checkin_date: string;
  adherence: AdherenceLevel;
  notes: string | null;
  current_streak: number;
}

export interface HeatmapDay {
  date: string;
  adherence: AdherenceLevel | null;
}

export interface AdherenceHeatmapResponse {
  user_id: string;
  days: HeatmapDay[];
  current_streak: number;
  longest_streak: number;
  total_checkins: number;
}

export interface ProductFeedbackCreate {
  product_id: string;
  recommendation_product_id?: string;
  rating: ProductRating;
  notes?: string;
}

export interface ProductFeedbackResponse {
  id: string;
  product_id: string;
  rating: ProductRating;
  notes: string | null;
}

export interface ProductEffectivenessItem {
  product_id: string;
  product_name: string;
  brand: string;
  targets_condition: string | null;
  highlighted_ingredient: string | null;
  weeks_used: number | null;
  condition_improvement_pct: number | null;
  user_rating: ProductRating | null;
}

export interface AlertItem {
  type: AlertType;
  condition?: string;
  message: string;
}

export interface ProgressSummaryResponse {
  user_id: string;
  baseline_score: number | null;
  latest_score: number | null;
  total_improvement: number | null;
  improvement_pct_toward_healthy: number | null;
  timeline: TimelinePoint[];
  conditions: ConditionProgressItem[];
  current_streak: number;
  last_7_days: HeatmapDay[];
  product_effectiveness: ProductEffectivenessItem[];
  last_scan_date: string | null;
  days_until_rescan: number | null;
  is_rescan_overdue: boolean;
  alerts: AlertItem[];
  unread_notification_count: number;
}

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const progressApi = {
  /** Link a new re-scan result to a recommendation and compute deltas. */
  linkScan: (data: ProgressScanCreate) =>
    api.post<ProgressScanResponse>("progress/scan", data),

  /** Skin score timeline for the LineChart. */
  getTimeline: () => api.get<TimelineResponse>("progress/timeline"),

  /** Per-condition improvement for condition cards. */
  getConditions: () =>
    api.get<ConditionsProgressResponse>("progress/conditions"),

  /** Log today's routine adherence. */
  submitCheckin: (data: RoutineCheckinCreate) =>
    api.post<RoutineCheckinResponse>("progress/routine-checkin", data),

  /** 90-day adherence heatmap data. */
  getAdherence: () =>
    api.get<AdherenceHeatmapResponse>("progress/adherence"),

  /** Rate a recommended product. */
  submitProductFeedback: (data: ProductFeedbackCreate) =>
    api.post<ProductFeedbackResponse>("progress/product-feedback", data),

  /** Full dashboard summary (single call for the progress page). */
  getSummary: () =>
    api.get<ProgressSummaryResponse>("progress/summary"),

  /** In-app notification bell entries. */
  getNotifications: (unreadOnly = false) =>
    api.get<InAppNotification[]>(
      `progress/notifications${unreadOnly ? "?unread_only=true" : ""}`
    ),

  /** Mark a single notification as read. */
  markRead: (id: string) =>
    api.patch<void>(`progress/notifications/${id}/read`, {}),
};
