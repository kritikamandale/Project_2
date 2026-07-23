"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";

// Code-split TensorFlow.js + the camera/ML pipeline out of the initial route
// chunk — it's ~100MB+ of model weights and WebGL setup that should only be
// fetched once we know the user is actually about to scan (gate === "ready"),
// not on every visit to /scan (including ones that bounce to the
// questionnaire gate below).
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
    // Kick off the ~105MB model download + WebGL warm-up as soon as we know
    // the user is proceeding to the camera, so it runs in the background
    // while they grant camera access and frame their face — instead of only
    // starting once the camera is live. Fire-and-forget; CameraCapture/
    // analyzeFrame handle any load failure.
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
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-white/50 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (gate === "needs_questionnaire") {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-skin-50 via-white to-skin-100/40 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center text-4xl mx-auto shadow-lg">
            📋
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Complete your skin profile first</h1>
            <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
              Answer a few quick questions about your lifestyle, diet, and environment so our AI
              can give you accurate, personalised results — not just generic ones.
            </p>
          </div>
          <div className="space-y-3">
            <Link
              href="/questionnaire?redirectTo=/scan"
              className="flex items-center justify-center gap-2 w-full bg-skin-500 hover:bg-skin-600 text-white font-semibold py-3.5 rounded-2xl transition-colors shadow-sm"
            >
              <span>✨</span> Fill out my skin profile
              <span className="text-xs font-normal text-white/70 ml-1">(~5 min)</span>
            </Link>
            <button
              onClick={handleCancel}
              className="w-full text-zinc-400 hover:text-zinc-600 text-sm py-2 transition-colors"
            >
              Back to dashboard
            </button>
          </div>
          <div className="flex items-center justify-center gap-5 text-xs text-zinc-400">
            <span>🔒 Private & secure</span>
            <span>⚡ Better results</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <CameraCapture onComplete={handleComplete} onCancel={handleCancel} />
    </div>
  );
}
