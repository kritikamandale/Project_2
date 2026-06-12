/**
 * Admin API client — typed wrappers for all /api/v1/admin/* endpoints.
 */

const BASE = "/api/v1/admin";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SparklinePoint { date: string; value: number }

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

export interface RegistrationTrendPoint { date: string; count: number }
export interface SkinTypeDistributionItem { skin_type: string; count: number; percentage: number }
export interface CityDistributionItem { city: string; user_count: number }
export interface FitzpatrickDistributionItem { tone: string; count: number; percentage: number }
export interface ConditionImprovementItem {
  condition: string;
  avg_improvement_pct: number;
  user_count: number;
}

export interface ChartsData {
  registration_trend: RegistrationTrendPoint[];
  skin_type_distribution: SkinTypeDistributionItem[];
  top_cities: CityDistributionItem[];
  fitzpatrick_distribution: FitzpatrickDistributionItem[];
  improvement_by_condition: ConditionImprovementItem[];
}

export type UserRole = "USER" | "DERMATOLOGIST" | "ADMIN";
export type UserStatusAction = "suspend" | "activate" | "delete";

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_verified: boolean;
  is_active: boolean;
  totp_enabled: boolean;
  last_login: string | null;
  scan_count: number;
  city: string | null;
  created_at: string;
}

export interface PaginatedAdminUsers {
  items: AdminUserListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DermVerificationItem {
  user_id: string;
  full_name: string;
  email: string;
  medical_license_number: string;
  specialization: string | null;
  hospital_affiliation: string | null;
  verification_document_url: string | null;
  registered_at: string;
}

export interface AdminProductListItem {
  id: string;
  brand: string;
  product_name: string;
  category: string;
  price_inr: number | null;
  is_active: boolean;
  is_dermatologist_approved: boolean;
  rating_avg: number;
  review_count: number;
  recommendation_count: number;
  created_at: string;
}

export interface PaginatedAdminProducts {
  items: AdminProductListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminProductCreate {
  brand: "nykaa" | "minimalist" | "dermaco" | "others";
  product_name: string;
  product_url?: string;
  price_inr?: number;
  category: "cleanser" | "toner" | "serum" | "moisturiser" | "sunscreen" | "treatment" | "mask";
  key_ingredients: string[];
  targets_conditions: string[];
  skin_types_suitable: string[];
  fitzpatrick_suitable: string[];
  climate_zones_suitable: string[];
  is_dermatologist_approved: boolean;
}

export type AdminProductUpdate = Partial<AdminProductCreate & { is_active: boolean }>;

export interface BiasReportItem {
  fitzpatrick_tone: string;
  user_count: number;
  avg_confidence: number;
  recommendation_count: number;
  avg_skin_score: number;
}

export interface BiasReport {
  items: BiasReportItem[];
  overall_avg_confidence: number;
  tones_below_threshold: string[];
  generated_at: string;
}

export interface AuditLogItem {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface PaginatedAuditLogs {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FeatureFlagsUpdate {
  enable_camera_scan?: boolean;
  enable_auto_climate_fetch?: boolean;
  enable_dermatologist_review?: boolean;
  maintenance_mode?: boolean;
  derm_review_confidence_threshold?: number;
  recommendation_engine_version?: "v1" | "v2";
}

export interface TOTPSetupResponse {
  secret: string;
  otpauth_uri: string;
}

export interface TOTPStatusResponse {
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function adminFetch<T>(
  path: string,
  opts?: RequestInit & { totpCode?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.totpCode ? { "X-TOTP-Code": opts.totpCode } : {}),
    ...(opts?.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Admin API error");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export const adminApi = {
  getAnalyticsOverview: () =>
    adminFetch<AnalyticsOverview>("/analytics"),

  getChartsData: () =>
    adminFetch<ChartsData>("/analytics/charts"),

  getBiasReport: () =>
    adminFetch<BiasReport>("/bias-report"),

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  getUsers: (params: {
    search?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    if (params.is_active !== undefined) q.set("is_active", String(params.is_active));
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return adminFetch<PaginatedAdminUsers>(`/users?${q}`);
  },

  changeUserRole: (userId: string, role: UserRole, totpCode?: string) =>
    adminFetch<void>(`/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
      totpCode,
    }),

  changeUserStatus: (
    userId: string,
    action: UserStatusAction,
    reason?: string,
    totpCode?: string,
  ) =>
    adminFetch<void>(`/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ action, reason }),
      totpCode,
    }),

  // -------------------------------------------------------------------------
  // Dermatologist verification
  // -------------------------------------------------------------------------
  getDermVerificationQueue: () =>
    adminFetch<DermVerificationItem[]>("/dermatologists/pending"),

  verifyDermatologist: (
    userId: string,
    action: "approve" | "reject",
    rejectionReason?: string,
    totpCode?: string,
  ) =>
    adminFetch<void>(`/dermatologist/${userId}/verify`, {
      method: "POST",
      body: JSON.stringify({ action, rejection_reason: rejectionReason }),
      totpCode,
    }),

  // -------------------------------------------------------------------------
  // Products
  // -------------------------------------------------------------------------
  getProducts: (params: {
    search?: string;
    status?: "active" | "inactive";
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.status) q.set("status", params.status);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return adminFetch<PaginatedAdminProducts>(`/products?${q}`);
  },

  createProduct: (data: AdminProductCreate, totpCode?: string) =>
    adminFetch<AdminProductListItem>("/products", {
      method: "POST",
      body: JSON.stringify(data),
      totpCode,
    }),

  updateProduct: (id: string, data: AdminProductUpdate, totpCode?: string) =>
    adminFetch<AdminProductListItem>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      totpCode,
    }),

  deleteProduct: (id: string, totpCode?: string) =>
    adminFetch<void>(`/products/${id}`, { method: "DELETE", totpCode }),

  regenerateEmbedding: (id: string, totpCode?: string) =>
    adminFetch<{ product_id: string; status: string; message: string }>(
      `/products/${id}/regenerate-embedding`,
      { method: "POST", totpCode },
    ),

  // -------------------------------------------------------------------------
  // Audit logs
  // -------------------------------------------------------------------------
  getAuditLogs: (params: {
    user_id?: string;
    action?: string;
    entity_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)); });
    return adminFetch<PaginatedAuditLogs>(`/audit-logs?${q}`);
  },

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------
  getSettings: () =>
    adminFetch<Record<string, unknown>>("/settings"),

  updateSettings: (data: FeatureFlagsUpdate, totpCode?: string) =>
    adminFetch<Record<string, unknown>>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
      totpCode,
    }),

  // -------------------------------------------------------------------------
  // TOTP
  // -------------------------------------------------------------------------
  setupTotp: () =>
    adminFetch<TOTPSetupResponse>("/totp/setup"),

  verifyTotp: (code: string) =>
    adminFetch<TOTPStatusResponse>("/totp/verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  disableTotp: (code: string) =>
    adminFetch<TOTPStatusResponse>("/totp/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
};
