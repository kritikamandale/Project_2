"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, Info } from "lucide-react";
import { progressApi } from "@/lib/api/progress";
import type { ProgressSummaryResponse, ProductRating } from "@/lib/api/progress";
import { ProgressTimeline } from "@/components/progress/progress-timeline";
import { ConditionCards } from "@/components/progress/condition-cards";
import { AdherenceHeatmap } from "@/components/progress/adherence-heatmap";
import { ProductFeedbackPanel } from "@/components/progress/product-feedback";
import { RescanCTA } from "@/components/progress/rescan-cta";

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

const CONFETTI_COLORS = ["#5C6040", "#F4D84A", "#28261E", "#D6B59A"];

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl sm:text-3xl font-bold text-deep-brown border-b border-deep-brown/15 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function AlertBanner({ message, type }: { message: string; type: string }) {
  const isOverdue = type === "overdue_scan";
  const isWorsened = type === "worsened_condition";
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-xs font-sans shadow-xs backdrop-blur-sm",
        isOverdue
          ? "border-deep-brown/20 bg-butter/30 text-deep-brown font-medium"
          : isWorsened
          ? "border-deep-brown/20 bg-nude/40 text-deep-brown font-medium"
          : "border-deep-brown/10 bg-cream text-deep-brown",
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0 text-olive">
        {isOverdue ? <Clock className="w-4 h-4" /> : isWorsened ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
      </span>
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

function SkeletonBlock({ h = "h-32" }: { h?: string }) {
  return <div className={`${h} rounded-xl bg-cream border border-deep-brown/10 animate-pulse`} />;
}

export default function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await progressApi.getSummary();
        if (!cancelled) {
          setSummary(data);
          setStreak(data.current_streak);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load progress summary");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleProductRated(productId: string, rating: ProductRating) {
    if (!summary) return;
    setSummary({
      ...summary,
      product_effectiveness: summary.product_effectiveness.map((p) =>
        p.product_id === productId ? { ...p, rating } : p
      ),
    });
  }

  function handleCheckinComplete(newStreak: number) {
    setStreak(newStreak);
    if (newStreak > 0 && newStreak % 7 === 0) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 bg-cream min-h-screen">
        <SkeletonBlock h="h-10" />
        <SkeletonBlock h="h-64" />
        <SkeletonBlock h="h-48" />
        <SkeletonBlock h="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 bg-cream min-h-screen">
        <div className="rounded-xl border border-deep-brown/15 bg-cream p-6 text-center shadow-sm">
          <p className="text-deep-brown font-bold font-sans text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!summary || summary.timeline.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 bg-cream min-h-screen font-sans">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown">My Skin Journey</h1>
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
  } = summary;

  return (
    <div className="min-h-screen bg-cream text-deep-brown p-4 sm:p-6 lg:p-8 font-sans">
      {showCelebration && <Confetti />}

      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-deep-brown/10 pb-4">
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-olive">Analytics</span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown mt-1">My Skin Journey</h1>
        </div>

        {/* Alerts */}
        {alerts && alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <AlertBanner key={i} message={a.message} type={a.type} />
            ))}
          </div>
        )}

        {/* Section 1: Progress timeline */}
        <Section title="Skin Score Trend">
          <ProgressTimeline
            points={timeline}
            baselineScore={baseline_score}
            latestScore={latest_score}
            totalImprovement={total_improvement}
            improvementPct={improvement_pct_toward_healthy}
          />
        </Section>

        {/* Section 2: Conditions breakdown */}
        {conditions && conditions.length > 0 && (
          <Section title="Conditions Breakdown">
            <ConditionCards conditions={conditions} />
          </Section>
        )}

        {/* Section 3: Adherence Heatmap */}
        <Section title="Routine Adherence">
          <AdherenceHeatmap initialStreak={streak} onCheckinComplete={handleCheckinComplete} />
        </Section>

        {/* Section 4: Product effectiveness feedback */}
        {product_effectiveness && product_effectiveness.length > 0 && (
          <Section title="Product Effectiveness">
            <ProductFeedbackPanel products={product_effectiveness} onRated={handleProductRated} />
          </Section>
        )}

        {/* Section 5: Rescan CTA */}
        <Section title="Next Scan">
          <RescanCTA
            lastScanDate={last_scan_date}
            daysUntilRescan={days_until_rescan}
            isOverdue={is_rescan_overdue}
          />
        </Section>
      </div>
    </div>
  );
}
