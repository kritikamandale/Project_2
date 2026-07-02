"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera, ClipboardList, Map as MapIcon, ChevronRight, Star,
  Droplets, Moon, Activity, Sun, Loader2,
} from "lucide-react";
import { getScanHistory, type ScanSummary } from "@/lib/api/scan";
import {
  getQuestionnaireHistory,
  type QuestionnaireHistoryItem,
} from "@/lib/api/questionnaire";
import {
  getRecommendationHistory,
  type RecommendationHistoryItem,
} from "@/lib/api/recommendations";

// ---------------------------------------------------------------------------
// /history — every completed cycle (questionnaire + scan + recommendation),
// grouped as "Scan #N — date", newest first. Re-scans from the monthly progress
// flow land here too since they create the same scans/recommendations rows.
// ---------------------------------------------------------------------------

interface Cycle {
  scan: ScanSummary;
  rec: RecommendationHistoryItem | null;
  questionnaire: QuestionnaireHistoryItem | null;
  number: number; // Scan #N — 1 = oldest
}

const PAGE_SIZE = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const SKIN_TYPE_BADGE: Record<string, string> = {
  oily: "bg-emerald-50 text-emerald-700",
  dry: "bg-amber-50 text-amber-700",
  combination: "bg-violet-50 text-violet-700",
  normal: "bg-sky-50 text-sky-700",
  sensitive: "bg-rose-50 text-rose-700",
};

export default function HistoryPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lookup maps built once from the (larger) rec/questionnaire histories
  const [recByScan, setRecByScan] = useState<Map<string, RecommendationHistoryItem>>(new Map());
  const [qById, setQById] = useState<Map<string, QuestionnaireHistoryItem>>(new Map());

  async function loadPage(pageNum: number, recMap?: Map<string, RecommendationHistoryItem>, qMap?: Map<string, QuestionnaireHistoryItem>) {
    const scans = await getScanHistory(pageNum, PAGE_SIZE);
    const rMap = recMap ?? recByScan;
    const qqMap = qMap ?? qById;

    const newCycles: Cycle[] = scans.items.map((scan, i) => {
      const rec = scan.id ? rMap.get(scan.id) ?? null : null;
      const questionnaire = rec?.questionnaire_id
        ? qqMap.get(rec.questionnaire_id) ?? null
        : null;
      return {
        scan,
        rec,
        questionnaire,
        // Newest-first list: #total is the newest, so page offsets count down.
        number: scans.total - ((pageNum - 1) * PAGE_SIZE + i),
      };
    });

    setTotalScans(scans.total);
    setHasMore(scans.has_more);
    setCycles((prev) => (pageNum === 1 ? newCycles : [...prev, ...newCycles]));
    setPage(pageNum);
  }

  useEffect(() => {
    (async () => {
      try {
        // Fetch linkage histories first (max page size) so cycles can be joined.
        const [recs, qs] = await Promise.all([
          getRecommendationHistory(1, 50).catch(() => null),
          getQuestionnaireHistory(1, 50).catch(() => null),
        ]);
        const rMap = new Map<string, RecommendationHistoryItem>();
        // newest-first: keep the LATEST rec per scan (first seen wins)
        recs?.items.forEach((r) => {
          if (r.scan_id && !rMap.has(r.scan_id)) rMap.set(r.scan_id, r);
        });
        const qMap = new Map<string, QuestionnaireHistoryItem>();
        qs?.items.forEach((q) => qMap.set(q.id, q));
        setRecByScan(rMap);
        setQById(qMap);

        await loadPage(1, rMap, qMap);
      } catch (e) {
        setError((e as Error).message ?? "Failed to load your history.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadPage(page + 1);
    } catch {
      /* keep what we have; button stays for retry */
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-end justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold font-heading text-zinc-900">My History</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Every scan, questionnaire and personalised plan — newest first.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-skin-600 hover:underline whitespace-nowrap"
          >
            ← Dashboard
          </Link>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-zinc-100 p-5 animate-pulse"
              >
                <div className="h-4 bg-zinc-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-zinc-100 rounded w-2/3 mb-2" />
                <div className="h-3 bg-zinc-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-rose-100 p-6 text-center">
            <p className="text-sm text-rose-600">{error}</p>
            <button
              onClick={() => location.reload()}
              className="mt-3 text-sm text-skin-600 font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && cycles.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-zinc-100 p-10 text-center"
          >
            <span className="text-4xl block mb-3">📖</span>
            <p className="font-semibold text-zinc-900">No history yet</p>
            <p className="text-sm text-zinc-400 mt-1 mb-5">
              Complete your first scan to start building your skin journey.
            </p>
            <Link
              href="/scan"
              className="inline-block px-5 py-2.5 rounded-lg bg-gradient-to-r from-skin-400 to-skin-600 text-white text-sm font-semibold hover:opacity-90"
            >
              Start a scan
            </Link>
          </motion.div>
        )}

        {/* Cycle cards */}
        <div className="space-y-4">
          {cycles.map((cycle, idx) => (
            <motion.div
              key={cycle.scan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.3) }}
              className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">
                      Scan #{cycle.number}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatDate(cycle.scan.scan_timestamp)}
                    </p>
                  </div>
                </div>
                {cycle.scan.skin_type && (
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                      SKIN_TYPE_BADGE[cycle.scan.skin_type] ?? "bg-zinc-50 text-zinc-600"
                    }`}
                  >
                    {cycle.scan.skin_type}
                  </span>
                )}
              </div>

              <div className="px-5 py-4 space-y-3">
                {/* Recommendation summary */}
                {cycle.rec ? (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-zinc-600">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      {cycle.rec.skin_score != null
                        ? `Skin score ${Math.round(cycle.rec.skin_score)}`
                        : "Plan generated"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-zinc-600">
                      <MapIcon className="w-3.5 h-3.5 text-skin-500" />
                      {cycle.rec.roadmap_weeks}-week roadmap
                    </span>
                    <span className="text-zinc-400 text-xs">
                      {cycle.rec.products_count} products
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">
                    No plan was generated from this scan.
                  </p>
                )}

                {/* Questionnaire summary chips */}
                {cycle.questionnaire && (
                  <div className="flex flex-wrap gap-1.5">
                    {cycle.questionnaire.sleep_hours_avg != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-zinc-50 text-zinc-500 px-2 py-1 rounded-md">
                        <Moon className="w-3 h-3" />
                        {cycle.questionnaire.sleep_hours_avg}h sleep
                      </span>
                    )}
                    {cycle.questionnaire.stress_level != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-zinc-50 text-zinc-500 px-2 py-1 rounded-md">
                        <Activity className="w-3 h-3" />
                        Stress {cycle.questionnaire.stress_level}/5
                      </span>
                    )}
                    {cycle.questionnaire.water_intake_liters != null && (
                      <span className="inline-flex items-center gap-1 text-xs bg-zinc-50 text-zinc-500 px-2 py-1 rounded-md">
                        <Droplets className="w-3 h-3" />
                        {cycle.questionnaire.water_intake_liters}L water
                      </span>
                    )}
                    {cycle.questionnaire.sunscreen_use && (
                      <span className="inline-flex items-center gap-1 text-xs bg-zinc-50 text-zinc-500 px-2 py-1 rounded-md">
                        <Sun className="w-3 h-3" />
                        Sunscreen: {cycle.questionnaire.sunscreen_use.replace(/_/g, " ")}
                      </span>
                    )}
                    {cycle.questionnaire.diet_type && (
                      <span className="inline-flex items-center gap-1 text-xs bg-zinc-50 text-zinc-500 px-2 py-1 rounded-md">
                        <ClipboardList className="w-3 h-3" />
                        {cycle.questionnaire.diet_type.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer link */}
                {cycle.rec && (
                  <Link
                    href={`/results/${cycle.scan.id}?questionnaire_id=${cycle.rec.questionnaire_id ?? ""}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-skin-600 hover:text-skin-700"
                  >
                    View results &amp; roadmap
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Load more */}
        {!loading && hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-5 py-2.5 rounded-lg bg-white border border-zinc-200 text-sm font-medium text-zinc-600 hover:border-skin-300 hover:text-skin-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
              {loadingMore ? "Loading…" : `Load older scans (${totalScans - cycles.length} more)`}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
