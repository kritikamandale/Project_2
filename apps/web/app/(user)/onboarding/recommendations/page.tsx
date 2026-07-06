"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { generateRecommendation } from "@/lib/api/recommendations";
import { getScanHistory } from "@/lib/api/scan";
import { getLatestQuestionnaire } from "@/lib/api/questionnaire";

/**
 * Onboarding Step 3 — Recommendations.
 * Triggers the recommendation engine for the just-completed scan + questionnaire.
 * A successful generation is the ONLY thing that marks onboarding `completed`
 * server-side (see the /recommendations/generate endpoint). Once done we sync the
 * session and hand off to the existing results/roadmap screen (now unlocked by the
 * gate) to display the generated 20-week plan — no display logic is duplicated.
 */
const GENERATING_STEPS = [
  "Analysing your skin scan results…",
  "Matching products from our catalog…",
  "Running Indian climate assessment…",
  "Building your 20-week roadmap…",
  "Finalising personalised recommendations…",
];

// useSearchParams() requires a Suspense boundary for static prerendering —
// the inner component reads params; the default export provides the boundary.
function OnboardingRecommendationsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  // Rotating progress copy while the engine runs.
  useEffect(() => {
    const id = setInterval(
      () => setStepIdx((s) => Math.min(s + 1, GENERATING_STEPS.length - 1)),
      1800,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (startedRef.current) return; // guard against StrictMode double-invoke
    startedRef.current = true;

    (async () => {
      try {
        // Resolve the scan: prefer the id threaded from Step 2, else latest.
        let scanId = searchParams.get("scan_id") ?? undefined;
        if (!scanId) {
          const hist = await getScanHistory();
          scanId = hist.items?.[0]?.id;
        }
        if (!scanId) {
          throw new Error("No face scan found — please retake your scan.");
        }

        let questionnaireId: string | undefined;
        try {
          questionnaireId = (await getLatestQuestionnaire()).id;
        } catch {
          /* questionnaire is optional context for the engine */
        }

        // Generate — marks onboarding `completed` server-side on success.
        const gen = await generateRecommendation({
          scan_id: scanId,
          questionnaire_id: questionnaireId,
        });

        // Seed the results-page cache so it renders this rec instead of
        // regenerating. Must be sessionStorage — that's what the results page
        // reads (it was localStorage before, so the seed never hit and every
        // results visit re-ran the engine).
        try {
          sessionStorage.setItem(
            `rec_${scanId}_${questionnaireId ?? "none"}`,
            gen.recommendation_id,
          );
        } catch {
          /* private mode / storage disabled — results page will fetch latest */
        }

        // Open the gate in the JWT, then show the full roadmap on the results screen.
        await update({ onboardingStatus: "completed" });
        router.replace(
          `/results/${scanId}?questionnaire_id=${questionnaireId ?? ""}`,
        );
      } catch (e) {
        setError((e as Error).message ?? "Failed to generate your recommendations.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-16 px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-100 mb-4">
          <AlertTriangle className="w-7 h-7 text-cream-700" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900">We couldn&apos;t finish your plan</h1>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
        <button
          onClick={() => router.push("/onboarding/scan")}
          className="mt-6 px-5 py-2.5 rounded-lg bg-gradient-to-r from-skin-400 to-skin-600 text-white text-sm font-semibold hover:opacity-90"
        >
          Retake face scan
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-6 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-skin-400 to-skin-600 mb-5">
        <Loader2 className="w-7 h-7 text-white animate-spin" />
      </div>
      <h1 className="text-xl font-bold font-heading text-gray-900">Building your plan</h1>
      <p className="text-sm text-skin-600 mt-3 min-h-[20px] transition-all">
        {GENERATING_STEPS[stepIdx]}
      </p>
      <p className="text-xs text-gray-400 mt-6">
        Generating your personalised routine — this may take up to a minute.
      </p>
    </div>
  );
}

export default function OnboardingRecommendationsPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingRecommendationsPageInner />
    </Suspense>
  );
}
