"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";

// useSearchParams() requires a Suspense boundary for static prerendering —
// the inner component reads params; the default export provides the boundary.
function QuestionnairePageInner() {
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
    <div className="h-full flex flex-col justify-center bg-cream text-deep-brown overflow-hidden">
      <QuestionnaireForm onComplete={handleComplete} />
    </div>
  );
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={null}>
      <QuestionnairePageInner />
    </Suspense>
  );
}
