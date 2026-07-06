"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getLatestRecommendation } from "@/lib/api/recommendations";

/**
 * /results — redirects to the latest recommendation for the current user,
 * or to /scan if no recommendation exists yet.
 */
export default function ResultsLandingPage() {
  const router = useRouter();

  useEffect(() => {
    getLatestRecommendation()
      .then((rec) => router.replace(`/results/${rec.scan_id}`))
      .catch(() => router.replace("/scan"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-eggshell">
      <div className="w-8 h-8 rounded-full border-4 border-skin-200 border-t-skin-500 animate-spin" />
    </div>
  );
}
