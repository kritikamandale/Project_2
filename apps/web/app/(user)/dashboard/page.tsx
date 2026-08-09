"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { SkinestLogo, SkinestLogoIcon } from "@/components/shared/skinest-logo";
import { Button } from "@/components/ui/button";
import {
  Clock,
  AlertTriangle,
  Info,
  Sparkles,
  FlaskConical,
  BarChart3,
  Camera,
  ClipboardList,
  TrendingUp,
  Map,
  User,
  Bell,
  Check,
  ArrowRight,
  Flame,
  Calendar,
  Activity,
  Droplet,
  Sun,
  Moon,
  Leaf,
  Lightbulb,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { progressApi } from "@/lib/api/progress";
import type { ProgressSummaryResponse } from "@/lib/api/progress";
import { QuestionnaireForm } from "@/components/questionnaire/questionnaire-form";

// ---------------------------------------------------------------------------
// Alert banner
// ---------------------------------------------------------------------------

function AlertBanner({ message, type }: { message: string; type: string }) {
  const isOverdue = type === "overdue_scan";
  const isWorsened = type === "worsened_condition";
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-xs font-sans backdrop-blur-sm",
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

// ---------------------------------------------------------------------------
// Stat Card — Phase 4 Thin-Border Cream System with Cormorant Numerals
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="group bg-cream border border-deep-brown/10 rounded-xl p-5 shadow-sm hover:border-olive/30 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="font-sans text-xs font-bold uppercase tracking-widest text-olive">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-olive/10 text-olive flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="font-serif text-4xl font-bold text-deep-brown leading-none tracking-tight">{value}</p>
      {sub && <p className="font-sans text-xs text-deep-brown/60 mt-2 truncate">{sub}</p>}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Quick Action Card
// ---------------------------------------------------------------------------

function ActionCard({
  href,
  icon: Icon,
  title,
  description,
  delay,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
    >
      <Link
        href={href}
        className="group flex flex-col h-full bg-cream border border-deep-brown/10 rounded-xl p-5 shadow-sm hover:border-olive/40 hover:shadow-md transition-all duration-200"
      >
        <div className="w-10 h-10 rounded-lg bg-olive text-butter flex items-center justify-center mb-4 shrink-0 shadow-xs">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-serif font-bold text-deep-brown text-lg group-hover:text-olive transition-colors mb-1">
          {title}
        </h3>
        <p className="font-sans text-xs text-deep-brown/70 leading-relaxed flex-1">{description}</p>
        <div className="flex items-center gap-1.5 mt-4 text-xs font-sans font-bold text-olive uppercase tracking-wider group-hover:translate-x-1 transition-transform">
          <span>Go</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Daily Skin Tips Carousel
// ---------------------------------------------------------------------------

const SKIN_TIPS = [
  { Icon: Droplet, title: "Hydration First", text: "Drink 8 glasses of water daily. Hydrated skin repairs its barrier faster." },
  { Icon: Sun, title: "SPF Every Day", text: "Apply broad-spectrum SPF 30+ even on cloudy days to prevent hyperpigmentation." },
  { Icon: Moon, title: "Night Repair Routine", text: "Skin cell turnover peaks at night. Apply ceramides and actives before bed." },
  { Icon: Leaf, title: "Antioxidant Rich Foods", text: "Berries, spinach, and walnuts fight free radical damage and boost natural radiance." },
];

function SkinTipsCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActive((p) => (p + 1) % SKIN_TIPS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  const current = SKIN_TIPS[active];
  const IconComp = current.Icon;

  return (
    <div className="bg-cream border border-deep-brown/10 rounded-xl p-6 shadow-sm relative overflow-hidden">
      <p className="font-sans text-xs font-bold uppercase tracking-widest text-olive mb-4 flex items-center gap-1.5">
        <Lightbulb className="w-4 h-4 text-olive" /> Daily Skincare Insight
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex items-start gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-olive/10 text-olive flex items-center justify-center shrink-0">
            <IconComp className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-deep-brown text-lg">{current.title}</h4>
            <p className="font-sans text-xs text-deep-brown/70 mt-1 leading-relaxed">{current.text}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-center gap-1.5 mt-5">
        {SKIN_TIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-5 bg-olive" : "w-1.5 bg-deep-brown/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<ProgressSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  const [qStatus, setQStatus] = useState<"checking" | "done" | "pending">("checking");

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    Promise.all([
      fetch("/api/proxy/questionnaire/latest").then((r) => r.ok).catch(() => false),
      progressApi.getSummary().catch(() => null),
    ]).then(([hasQ, summaryData]) => {
      setQStatus(hasQ ? "done" : "pending");
      if (summaryData) setSummary(summaryData);
      setLoading(false);
    });
  }, []);

  function handleQuestionnaireComplete() {
    setQStatus("done");
    progressApi
      .getSummary()
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const skinScore = summary?.latest_score != null ? Math.round(summary.latest_score) : null;
  const streak = summary?.current_streak ?? 0;
  const daysUntil = summary?.days_until_rescan;
  const isOverdue = summary?.is_rescan_overdue ?? false;
  const improvedCount = summary?.conditions.filter((c) => c.status === "improved").length ?? 0;
  const totalConditions = summary?.conditions.length ?? 0;

  const nextScanLabel = isOverdue
    ? "Overdue"
    : daysUntil != null
    ? daysUntil === 0
      ? "Today"
      : `${daysUntil}d away`
    : "—";

  return (
    <div className="min-h-screen bg-cream text-deep-brown p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Pending Questionnaire Reminder Banner */}
        {qStatus === "pending" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-butter/30 border border-deep-brown/15 text-deep-brown font-sans">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-olive shrink-0" />
              <div>
                <p className="font-bold text-sm">Lifestyle Questionnaire Pending</p>
                <p className="text-xs text-deep-brown/70">Complete your lifestyle profile to personalize your AI skin recommendations.</p>
              </div>
            </div>
            <Button size="sm" className="bg-olive hover:bg-olive/90 text-cream font-sans font-bold text-xs rounded-lg shrink-0" asChild>
              <Link href="/questionnaire">Go to Questionnaire &rarr;</Link>
            </Button>
          </div>
        )}
        {/* ── Greeting Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-deep-brown/10 pb-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 bg-olive/10 text-olive rounded-full px-3 py-1 text-xs font-sans font-bold uppercase tracking-widest mb-2 border border-deep-brown/10">
              <span className="w-2 h-2 rounded-full bg-olive animate-pulse" />
              AI Skin Analysis Engine
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-brown">
              {greeting()}, <span className="font-serif italic font-normal text-olive">{firstName}</span>
            </h1>
            <p className="font-sans text-xs sm:text-sm text-deep-brown/80 mt-1 max-w-lg">
              Here is your personalized skin health dashboard and active routine progress.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              size="lg"
              className="bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold text-sm px-6 h-11 rounded-xl border border-deep-brown/10 shadow-sm"
              asChild
            >
              <Link href="/scan">
                <Camera className="w-4 h-4 mr-2" /> ANALYSE MY SKIN →
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-deep-brown/20 bg-nude/30 px-4 py-3 text-xs text-deep-brown">
            <AlertTriangle className="w-4 h-4 text-olive shrink-0" />
            <p>Could not refresh live skin metrics. Retrying in background…</p>
          </div>
        )}

        {/* ── Alerts ── */}
        {summary?.alerts && summary.alerts.length > 0 && (
          <div className="space-y-2">
            {summary.alerts.map((a, i) => (
              <AlertBanner key={i} message={a.message} type={a.type} />
            ))}
          </div>
        )}

        {/* ── Stat Cards Grid (Phase 4 Thin-Border Cream System) ── */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Sparkles}
              label="Skin Score"
              value={skinScore != null ? skinScore : "—"}
              sub={
                summary?.total_improvement != null && summary.total_improvement !== 0
                  ? `${summary.total_improvement > 0 ? "+" : ""}${summary.total_improvement.toFixed(1)} from baseline`
                  : "Baseline evaluation"
              }
              delay={0.1}
            />
            <StatCard
              icon={Flame}
              label="Streak"
              value={streak > 0 ? `${streak}d` : "0d"}
              sub={streak > 0 ? "Daily routine active" : "Log your daily steps"}
              delay={0.15}
            />
            <StatCard
              icon={Calendar}
              label="Next Scan"
              value={nextScanLabel}
              sub={isOverdue ? "Rescan recommended" : "7-day check-in"}
              delay={0.2}
            />
            <StatCard
              icon={Activity}
              label="Improved"
              value={totalConditions > 0 ? `${improvedCount}/${totalConditions}` : "—"}
              sub={totalConditions > 0 ? "conditions improving" : "No baseline data"}
              delay={0.25}
            />
          </div>
        </section>

        {/* ── Quick Actions Grid ── */}
        <section>
          <div className="mb-4">
            <h2 className="font-serif font-bold text-deep-brown text-xl">Quick Actions</h2>
            <p className="font-sans text-xs text-deep-brown/70">Your essential skincare toolkit</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ActionCard
              href="/scan"
              icon={Camera}
              title="New Face Scan"
              description="10-second on-device AI evaluation"
              delay={0.2}
            />
            <ActionCard
              href="/results"
              icon={FlaskConical}
              title="Recommendations"
              description="Your tailored 20-week routine"
              delay={0.25}
            />
            <ActionCard
              href="/roadmap"
              icon={Map}
              title="Skincare Roadmap"
              description="Phased product plan & schedule"
              delay={0.3}
            />
            <ActionCard
              href="/progress"
              icon={TrendingUp}
              title="Progress Tracker"
              description="Score trends & adherence history"
              delay={0.35}
            />
          </div>
        </section>

        {/* ── Conditions & Tips Side-by-Side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Conditions Card */}
          <div className="bg-cream border border-deep-brown/10 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-bold text-deep-brown text-lg">Target Conditions</h3>
              <Link href="/progress" className="text-xs font-sans font-bold text-olive hover:underline flex items-center gap-1">
                View detail <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {summary && summary.conditions.length > 0 ? (
              <div className="space-y-2.5">
                {summary.conditions.slice(0, 4).map((c) => {
                  const isImproved = c.status === "improved";
                  const isWorsened = c.status === "worsened";
                  return (
                    <div key={c.condition} className="flex items-center justify-between p-3 rounded-lg border border-deep-brown/10 bg-cream">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-olive/10 text-olive flex items-center justify-center shrink-0">
                          {isImproved ? <Check className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-sans text-xs font-bold text-deep-brown capitalize">
                            {c.condition.replace(/_/g, " ")}
                          </p>
                          {c.improvement_pct != null && (
                            <p className="font-sans text-[11px] text-deep-brown/70">
                              {isImproved ? "+" : ""}{c.improvement_pct.toFixed(1)}% improvement
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-butter/40 text-deep-brown border border-deep-brown/10">
                        {c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Camera className="w-10 h-10 text-olive/50 mx-auto mb-2" />
                <p className="font-sans text-xs text-deep-brown/70">No condition baseline established yet.</p>
                <Button size="sm" className="mt-4 bg-butter text-deep-brown font-bold text-xs" asChild>
                  <Link href="/scan">Run Baseline Scan</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Daily Skin Tips Carousel */}
          <SkinTipsCarousel />
        </div>
      </div>
    </div>
  );
}
