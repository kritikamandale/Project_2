"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ClipboardList, Sparkles, ShieldCheck, Zap } from "lucide-react";
import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";

const CameraCapture = dynamic(
  () => import("@/components/camera/CameraCapture").then((m) => m.CameraCapture),
  { ssr: false }
);

type GateStatus = "checking" | "ready" | "needs_questionnaire";

export default function ScanPage() {
  const router = useRouter();
  const [gate, setGate] = useState<GateStatus>("checking");

  useEffect(() => {
    fetch("/api/proxy/questionnaire/latest")
      .then((r) => setGate(r.ok ? "ready" : "needs_questionnaire"))
      .catch(() => setGate("needs_questionnaire"));
  }, []);

  useEffect(() => {
    if (gate !== "ready") return;
    import("@/lib/ai/skinAnalysis").then(({ loadSkinModel }) => loadSkinModel().catch(() => {}));
  }, [gate]);

  function handleComplete(_result: SkinAnalysisResult, scanId: string) {
    router.push(`/results/${scanId}`);
  }

  function handleCancel() {
    router.push("/dashboard");
  }

  if (gate === "checking") {
    return (
      <div className="fixed inset-0 z-50 bg-cream text-deep-brown flex flex-col items-center justify-center font-sans">
        <div className="font-sans text-xs font-bold uppercase tracking-widest text-olive animate-pulse">
          Initializing AI Scan Engine…
        </div>
      </div>
    );
  }

  if (gate === "needs_questionnaire") {
    return (
      <div className="fixed inset-0 z-50 bg-cream text-deep-brown flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="max-w-md w-full bg-cream border border-deep-brown/15 rounded-xl p-6 sm:p-8 shadow-sm text-center space-y-6 relative z-10">
          <div className="w-14 h-14 rounded-xl bg-olive text-butter border border-deep-brown/10 flex items-center justify-center mx-auto shadow-sm">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-serif text-deep-brown">Complete Your Profile First</h1>
            <p className="text-deep-brown/80 mt-2 text-xs leading-relaxed font-sans">
              Answer a few quick questions about your lifestyle, diet, and environment so our AI
              can give you accurate, personalised skin recommendations.
            </p>
          </div>
          <div className="space-y-3">
            <Link
              href="/questionnaire?redirectTo=/scan"
              className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold border border-deep-brown/10 shadow-sm rounded-xl py-3.5 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
            >
              <Sparkles className="w-4 h-4 text-olive" /> Fill out skin profile
              <span className="text-[11px] font-normal opacity-80">(~5 min)</span>
            </Link>
            <button
              onClick={handleCancel}
              className="w-full text-deep-brown/70 hover:text-deep-brown font-sans text-xs uppercase font-bold tracking-wider py-2 transition-colors"
            >
              Back to dashboard
            </button>
          </div>
          <div className="flex items-center justify-center gap-5 font-sans text-[11px] font-semibold uppercase text-deep-brown/70 pt-2 border-t border-deep-brown/10">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-olive" /> 100% Ephemeral</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-olive" /> Calibrated AI</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-cream">
      <CameraCapture onComplete={handleComplete} onCancel={handleCancel} />
    </div>
  );
}
