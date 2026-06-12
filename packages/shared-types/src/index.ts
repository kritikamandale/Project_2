// Shared TypeScript types used by both frontend and any typed API clients

// ---------------------------------------------------------------------------
// Auth & User
// ---------------------------------------------------------------------------

export type UserRole = "USER" | "DERMATOLOGIST" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  age?: number;
  gender?: string;
  skinTone?: string;
  city?: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "bearer";
  user: User;
}

// ---------------------------------------------------------------------------
// Skin Analysis
// ---------------------------------------------------------------------------

export type SkinType = "dry" | "oily" | "combination" | "normal" | "sensitive";

export type SkinCondition =
  | "acne"
  | "pigmentation"
  | "dark_circles"
  | "uneven_tone"
  | "wrinkles"
  | "dehydration"
  | "redness"
  | "enlarged_pores";

export type ScanStatus = "uploading" | "analyzing" | "complete" | "failed";

export interface TFJSResult {
  skinType: SkinType;
  conditions: SkinCondition[];
  confidenceScores: Record<SkinType, number>;
}

export interface Scan {
  id: string;
  userId: string;
  skinType?: SkinType;
  conditions?: SkinCondition[];
  confidenceScores?: Record<SkinType, number>;
  tfjsResult?: TFJSResult;
  status: ScanStatus;
  createdAt: string;
  analyzedAt?: string;
}

// ---------------------------------------------------------------------------
// Questionnaire
// ---------------------------------------------------------------------------

export interface QuestionnaireAnswers {
  scanId: string;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  dietScore: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  waterIntakeLiters: number;
  uvExposureHours: number;
  exerciseDaysPerWeek: number;
  currentProducts: string[];
  allergies: string[];
  skinConcerns: string[];
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export type ProductBrand = "Nykaa" | "Minimalist" | "Dermaco";

export interface ProductRecommendation {
  name: string;
  brand: ProductBrand;
  category: string;
  reason: string;
  usage: string;
  priceInr?: number;
  imageUrl?: string;
  affiliateUrl?: string;
}

export interface Recommendation {
  id: string;
  scanId: string;
  products: ProductRecommendation[];
  morningRoutine: string[];
  nightRoutine: string[];
  ingredientsToUse: string[];
  ingredientsToAvoid: string[];
  lifestyleTips: string[];
  dermatologistApproved: boolean;
  dermNotes?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface ProgressEntry {
  id: string;
  userId: string;
  weekNumber: number;
  selfRating: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ApiError {
  detail: string;
  code?: string;
  field?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
