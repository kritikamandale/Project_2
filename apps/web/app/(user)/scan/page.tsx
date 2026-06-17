"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CameraCapture } from "@/components/camera/CameraCapture";
import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";

type GateStatus = "checking" | "ready" | "needs_questionnaire";

export default function ScanPage() {
  const router = useRouter();
  const [gate, setGate] = useState<GateStatus>("checking");

  useEffect(() => {
    fetch("/api/proxy/questionnaire/latest")
      .then((r) => setGate(r.ok ? "ready" : "needs_questionnaire"))
      .catch(() => setGate("needs_questionnaire"));
  }, []);

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
