"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";

export default function QuestionnairePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirectTo");
  // Validate redirect target is a safe relative path (no open-redirect)
  const redirectTo = rawRedirect && /^\/(?!\/)/.test(rawRedirect) ? rawRedirect : null;

  function handleComplete() {
    // Brief pause so the done-animation plays before navigating
    setTimeout(() => {
      router.push(redirectTo ?? "/dashboard");
    }, 1800);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <QuestionnaireForm onComplete={handleComplete} />
    </main>
  );
}
