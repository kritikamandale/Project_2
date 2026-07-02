"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";
import { getOnboardingStatus } from "@/lib/api/onboarding";

/**
 * Onboarding Step 1 — Lifestyle Questionnaire.
 * Reuses the existing QuestionnaireForm untouched. Submitting it advances the
 * server-side onboarding status to `questionnaire_done`; here we sync that into
 * the session JWT (so the middleware gate opens) and move to the scan step.
 */
export default function OnboardingQuestionnairePage() {
  const router = useRouter();
  const { update } = useSession();

  async function handleComplete() {
    try {
      const s = await getOnboardingStatus(); // authoritative status after submit
      await update({ onboardingStatus: s.onboarding_status });
      // Brief pause so the form's done-animation plays before navigating.
      setTimeout(() => router.push(s.next_path), 1200);
    } catch {
      setTimeout(() => router.push("/onboarding/scan"), 1200);
    }
  }

  return <QuestionnaireForm onComplete={handleComplete} />;
}
