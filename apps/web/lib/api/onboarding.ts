/**
 * Onboarding progress API — reads/advances the server-authoritative onboarding
 * status. The status is also mirrored into the NextAuth JWT (see lib/auth.ts) so
 * the edge middleware can gate routes; callers should update the session after
 * advancing so the gate opens without a full re-login.
 */

const BASE = "/api/proxy/onboarding";

export type OnboardingStatus =
  | "not_started"
  | "questionnaire_done"
  | "scan_done"
  | "completed";

export interface OnboardingStatusResponse {
  onboarding_status: OnboardingStatus;
  current_step: "questionnaire" | "scan" | "recommendations" | null;
  next_path: string;
}

export async function getOnboardingStatus(): Promise<OnboardingStatusResponse> {
  const res = await fetch(`${BASE}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to read onboarding status");
  return res.json();
}

/** Advance-only; the server rejects anything other than questionnaire_done/scan_done. */
export async function advanceOnboarding(
  status: "questionnaire_done" | "scan_done",
): Promise<OnboardingStatusResponse> {
  const res = await fetch(`${BASE}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update onboarding status");
  return res.json();
}
