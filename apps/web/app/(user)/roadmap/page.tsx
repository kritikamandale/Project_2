"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clock, ChevronRight, Sparkles, Calendar, ArrowRight, Camera,
} from "lucide-react";
import {
  getLatestRecommendation,
  type RecommendationDetail,
  type RoadmapPhase,
} from "@/lib/api/recommendations";

const PHASE_STYLES: Record<number, { border: string; bg: string; badge: string; text: string }> = {
  1: { border: "border-blue-200",    bg: "bg-blue-50",    badge: "bg-blue-100 text-blue-700",     text: "text-blue-700" },
  2: { border: "border-purple-200",  bg: "bg-purple-50",  badge: "bg-purple-100 text-purple-700",  text: "text-purple-700" },
  3: { border: "border-emerald-200", bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
};

function currentWeek(generatedAt: string): number {
  const elapsedMs = Date.now() - new Date(generatedAt).getTime();
  const weeks = Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, weeks);
}

function PhaseCard({ phase, week, index }: { phase: RoadmapPhase; week: number; index: number }) {
  const style = PHASE_STYLES[phase.phase] ?? PHASE_STYLES[1];
  const isActive = week >= phase.weeks_start && week <= phase.weeks_end;
  const isDone = week > phase.weeks_end;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      className={`relative rounded-2xl border-2 p-5 ${
        isActive ? `${style.border} ${style.bg} shadow-md` : "border-gray-100 bg-white"
      }`}
    >
      {isActive && (
        <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wide bg-indigo-600 text-white px-2 py-0.5 rounded-full">
          You are here
        </span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${
            isDone ? "bg-green-100 text-green-700" : style.badge
          }`}
        >
          {isDone ? "✓" : phase.phase}
        </div>
        <div>
          <p className={`text-xs font-bold ${style.text}`}>Phase {phase.phase} · Weeks {phase.weeks_start}–{phase.weeks_end}</p>
          <p className="text-base font-bold text-gray-900">{phase.title}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{phase.goal}</p>
      {phase.product_names.length > 0 && (
        <div className="space-y-1.5">
          {phase.product_names.map((name) => (
            <div key={name} className="flex items-center gap-1.5 text-sm text-gray-700">
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {name}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-5">
        <Calendar className="w-7 h-7 text-indigo-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">No roadmap yet</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        Complete a skin scan and questionnaire to get your personalised week-by-week skincare roadmap.
      </p>
      <button
        onClick={() => router.push("/scan")}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
      >
        <Camera className="w-4 h-4" />
        Start a Scan
      </button>
    </div>
  );
}

export default function RoadmapPage() {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [rec, setRec] = useState<RecommendationDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLatestRecommendation()
      .then((detail) => {
        if (cancelled) return;
        setRec(detail);
        setState(detail.roadmap ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) setState("empty");
      });
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600"
        />
      </div>
    );
  }

  if (state === "empty" || !rec?.roadmap) {
    return <EmptyState />;
  }

  const week = currentWeek(rec.generated_at);
  const totalWeeks = rec.roadmap.total_weeks;
  const progressPct = Math.min(100, Math.round((week / totalWeeks) * 100));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Dashboard
        </button>
        <button
          onClick={() => router.push(`/results/${rec.scan_id}?questionnaire_id=${rec.questionnaire_id ?? ""}`)}
          className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
        >
          Full results <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Hero progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg"
        >
          <p className="text-indigo-200 text-sm font-medium mb-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Your Skincare Roadmap
          </p>
          <p className="text-2xl font-bold mb-4">
            Week {Math.min(week, totalWeeks)} of {totalWeeks}
          </p>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <p className="text-indigo-200 text-xs mt-2">{progressPct}% through your personalised plan</p>
        </motion.div>

        {/* Phase timeline */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            Phase Timeline
          </h2>
          <div className="space-y-4">
            {rec.roadmap.phases.map((phase, i) => (
              <PhaseCard key={phase.phase} phase={phase} week={week} index={i} />
            ))}
          </div>
        </section>

        {/* Expected results */}
        {rec.roadmap.condition_timelines.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Expected Results Timeline</h2>
            <div className="space-y-3">
              {rec.roadmap.condition_timelines.map((ct) => (
                <div key={ct.condition} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold capitalize text-gray-800">
                      {ct.condition.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-indigo-600 font-medium">
                      ~{ct.expected_improvement_pct}% by week {ct.expected_improvement_week}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{ct.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
