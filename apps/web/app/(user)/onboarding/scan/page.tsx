"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CameraCapture } from "@/components/camera/CameraCapture";
import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";
import { getOnboardingStatus } from "@/lib/api/onboarding";

/**
 * Onboarding Step 2 — Face Scan.
 * Reuses the existing CameraCapture + TF.js pipeline untouched. submitScan (called
 * inside CameraCapture) advances the server-side status to `scan_done`; here we
 * sync the session JWT and move to the recommendations step, threading the scan_id.
 * The user can only reach this route after Step 1 (enforced by the middleware gate).
 */
export default function OnboardingScanPage() {
  const router = useRouter();
  const { update } = useSession();

  async function handleComplete(_result: SkinAnalysisResult, scanId: string) {
    // Navigate immediately — don't wait for the status sync API call.
    router.push(`/onboarding/recommendations?scan_id=${scanId}`);
    // Sync the session JWT in the background (best-effort).
    try {
      const s = await getOnboardingStatus();
      await update({ onboardingStatus: s.onboarding_status });
    } catch {
      /* non-critical — middleware will recheck on next navigation */
    }
  }

  function handleCancel() {
    // Can't skip onboarding — the gate will bounce back to this step.
    router.push("/dashboard");
  }

  return <CameraCapture onComplete={handleComplete} onCancel={handleCancel} />;
}
