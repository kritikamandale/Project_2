"use client";

import { useRouter } from "next/navigation";
import { CameraCapture } from "@/components/camera/CameraCapture";
import type { SkinAnalysisResult } from "@/lib/ai/skinAnalysis";

export default function ScanPage() {
  const router = useRouter();

  function handleComplete(result: SkinAnalysisResult, scanId: string) {
    router.push(`/results/${scanId}`);
  }

  function handleCancel() {
    router.push("/dashboard");
  }

  return (
    <div className="fixed inset-0 z-50">
      <CameraCapture onComplete={handleComplete} onCancel={handleCancel} />
    </div>
  );
}
