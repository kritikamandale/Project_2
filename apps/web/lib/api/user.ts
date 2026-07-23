/**
 * Typed API client for the caller's own profile (GET/PATCH /users/me).
 */

import { api } from "./client";

export type FitzpatrickScale = "I" | "II" | "III" | "IV" | "V" | "VI";

export interface UserProfile {
  date_of_birth: string | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  country: string;
  skin_tone_category: FitzpatrickScale | null;
  consent_given_at: string | null;
  id: string;
  user_id: string;
  profile_photo_url: string | null;
  created_at: string;
}

export interface UserWithProfile {
  id: string;
  email: string;
  full_name: string;
  role: "USER" | "DERMATOLOGIST" | "ADMIN";
  is_verified: boolean;
  is_active: boolean;
  onboarding_status: string;
  created_at: string;
  last_login: string | null;
  profile: UserProfile | null;
}

export interface UserProfileUpdatePayload {
  date_of_birth?: string | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  skin_tone_category?: FitzpatrickScale | null;
  consent_given_at?: string | null;
}

export const userApi = {
  getMe: () => api.get<UserWithProfile>("users/me"),
  updateMe: (payload: UserProfileUpdatePayload) =>
    api.patch<UserWithProfile>("users/me", payload),
};
