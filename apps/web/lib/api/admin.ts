/**
 * Admin API client — analytics overview for the admin dashboard.
 * Calls route through /api/proxy → FastAPI /api/v1/admin/... (require_admin).
 */

import { api } from "./client";

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface AnalyticsOverview {
  total_users: number;
  users_mom_growth_pct: number;
  scans_today: number;
  scans_this_week: number;
  scans_this_month: number;
  avg_skin_improvement_score: number;
  recommendation_acceptance_rate: number;
  pending_derm_reviews: number;
  active_products: number;
  user_growth_sparkline: SparklinePoint[];
}

export const adminApi = {
  getAnalyticsOverview: () => api.get<AnalyticsOverview>("admin/analytics"),
};
