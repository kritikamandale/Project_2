"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { progressApi } from "@/lib/api/progress";
import type { ProgressSummaryResponse, ProductRating } from "@/lib/api/progress";
import { ProgressTimeline } from "@/components/progress/progress-timeline";
import { ConditionCards } from "@/components/progress/condition-cards";
import { AdherenceHeatmap } from "@/components/progress/adherence-heatmap";
import { ProductFeedbackPanel } from "@/components/progress/product-feedback";
import { RescanCTA } from "@/components/progress/rescan-cta";

// ---------------------------------------------------------------------------
// Confetti celebration (framer-motion particles)
// ---------------------------------------------------------------------------

function ConfettiParticle({ x, color, delay }: { x: number; color: string; delay: number }) {
  return (
    <motion.div
      className="fixed pointer-events-none rounded-full z-50"
      style={{ left: `${x}%`, top: "-10px", width: 8, height: 8, backgroundColor: color }}
      initial={{ y: 0, opacity: 1, rotate: 0 }}
      animate={{ y: "110vh", opacity: 0, rotate: 360 }}
      transition={{ duration: 2.5, delay, ease: "easeIn" }}
    />
  );
}

const CONFETTI_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#f97316"];

function Confetti() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    x: Math.random() * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.8,
  }));
  return (
    <>
      {particles.map((p, i) => (
        <ConfettiParticle key={i} {...p} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-800 border-b border-zinc-100 pb-2">{title}</h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Alert banner
// ---------------------------------------------------------------------------

function AlertBanner({ message, type }: { message: string; type: string }) {
  const isOverdue = type === "overdue_scan";
  const isWorsened = type === "worsened_condition";
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        isOverdue
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : isWorsened
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-zinc-200 bg-zinc-50 text-zinc-700",
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0">{isOverdue ? "⏰" : isWorsened ? "⚠️" : "ℹ️"}</span>
      <p>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonBlock({ h = "h-32" }: { h?: string }) {
  return <div className={`${h} rounded-xl bg-zinc-100 animate-pulse`} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [streak, setStreak] = useState(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    progressApi
      .getSummary()
      .then((data) => {
        setSummary(data);
        setStreak(data.current_streak);
      })
      .catch(() => setError("Could not load your progress. Please try again later."))
      .finally(() => setLoading(false));
  }, []);

  function handleProductRated(productId: string, rating: ProductRating) {
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            product_effectiveness: prev.product_effectiveness.map((p) =>
              p.product_id === productId ? { ...p, user_rating: rating } : p
            ),
          }
        : prev
    );
  }

  function handleCheckinComplete(newStreak: number) {
    setStreak(newStreak);
    if (newStreak > 0 && newStreak % 7 === 0) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <SkeletonBlock h="h-10" />
        <SkeletonBlock h="h-64" />
        <SkeletonBlock h="h-48" />
        <SkeletonBlock h="h-48" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-rose-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state — no scans yet
  if (!summary || summary.timeline.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900">My Skin Journey</h1>
        <RescanCTA lastScanDate={null} daysUntilRescan={null} isOverdue={false} />
      </div>
    );
  }

  const {
    baseline_score,
    latest_score,
    total_improvement,
    improvement_pct_toward_healthy,
    timeline,
    conditions,
    product_effectiveness,
    last_scan_date,
    days_until_rescan,
    is_rescan_overdue,
    alerts,
    unread_notification_count,
  } = summary;

  const improvementLabel =
    total_improvement != null && total_improvement !== 0
      ? `${total_improvement > 0 ? "+" : ""}${total_improvement.toFixed(1)} points in ${
          timeline.length > 1
            ? `${Math.round(
                (new Date(timeline[timeline.length - 1].scanned_at).getTime() -
                  new Date(timeline[0].scanned_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )} days`
            : "your journey"
        }`
      : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Celebration overlay */}
      <AnimatePresence>{showCelebration && <Confetti />}</AnimatePresence>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">My Skin Journey</h1>
          {improvementLabel && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 text-emerald-600 font-semibold text-lg"
            >
              {improvementLabel}
            </motion.p>
          )}
        </div>
        {unread_notification_count > 0 && (
          <div className="relative">
            <button className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors">
              <span className="text-lg">🔔</span>
            </button>
            <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-xs font-bold">
              {unread_notification_count}
            </span>
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <AlertBanner key={i} message={a.message} type={a.type} />
          ))}
        </div>
      )}

      {/* Section 1: Skin Score Timeline */}
      <Section title="Overall Skin Journey">
        <ProgressTimeline
          points={timeline}
          baselineScore={baseline_score}
          latestScore={latest_score}
          totalImprovement={total_improvement}
          improvementPct={improvement_pct_toward_healthy}
        />
      </Section>

      {/* Section 2: Condition-by-Condition Progress */}
      <Section title="Condition-by-Condition Progress">
        <ConditionCards conditions={conditions} />
      </Section>

      {/* Section 3: Routine Adherence */}
      <Section title="Routine Adherence">
        <AdherenceHeatmap
          initialStreak={streak}
          onCheckinComplete={handleCheckinComplete}
        />
      </Section>

      {/* Section 4: Product Effectiveness */}
      <Section title="Product Effectiveness">
        <ProductFeedbackPanel
          products={product_effectiveness}
          onRated={handleProductRated}
        />
      </Section>

      {/* Section 5: Next Re-Scan CTA */}
      <Section title="Next Re-Scan">
        <RescanCTA
          lastScanDate={last_scan_date}
          daysUntilRescan={days_until_rescan}
          isOverdue={is_rescan_overdue}
        />
      </Section>
    </div>
  );
}
