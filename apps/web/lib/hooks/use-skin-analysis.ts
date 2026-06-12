/**
 * Hook that manages the full in-browser skin analysis flow:
 * capture → TF.js inference → upload to S3 → server validation.
 */

import { useState, useCallback } from "react";
import { analyzeSkin } from "@/lib/ai/skin-model";
import { api } from "@/lib/api/client";
import { useScanStore } from "@/lib/stores/scan-store";
import type { TFJSResult } from "@skin-analysis/shared-types";

type AnalysisState = "idle" | "capturing" | "analyzing" | "uploading" | "complete" | "error";

export function useSkinAnalysis() {
  const [state, setState] = useState<AnalysisState>("idle");
  const [error, setError] = useState<string | null>(null);
  const { setTFJSResult, setScan } = useScanStore();

  const runAnalysis = useCallback(async (videoEl: HTMLVideoElement) => {
    try {
      setState("analyzing");
      setError(null);

      // 1. In-browser TF.js inference
      const result: TFJSResult = await analyzeSkin(videoEl);
      setTFJSResult(result);

      setState("uploading");

      // 2. Get presigned S3 upload URL
      const { upload_url, s3_key } = await api.post<{ upload_url: string; s3_key: string }>(
        "scan/upload-url",
        {}
      );

      // 3. Capture frame as JPEG blob and upload to S3
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      canvas.getContext("2d")!.drawImage(videoEl, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9)
      );

      await fetch(upload_url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });

      // 4. Trigger server-side validation
      const scan = await api.post<any>("scan/analyze", {
        s3_key,
        tfjs_result: {
          skin_type: result.skinType,
          conditions: result.conditions,
          confidence_scores: result.confidenceScores,
        },
      });

      setScan(scan);
      setState("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setState("error");
    }
  }, [setTFJSResult, setScan]);

  return { state, error, runAnalysis };
}
