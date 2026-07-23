"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

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
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm backdrop-blur-sm",
        isOverdue
          ? "border-rose-200/60 bg-rose-50/80 text-rose-700"
          : isWorsened
          ? "border-cream-300/60 bg-cream-50/80 text-cream-800"
          : "border-skin-200/60 bg-skin-50/80 text-skin-800",
      ].join(" ")}
    >
      <span className="mt-0.5 shrink-0 text-base">
        {isOverdue ? "⏰" : isWorsened ? "⚠️" : "ℹ️"}
      </span>
      <p>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Water-fill glass ring — a circular gauge that "fills" like rising water,
// used for the primary Skin Score stat instead of a bare icon.
// ---------------------------------------------------------------------------

function ScoreRing({ value, size = 48 }: { value: number | null; size?: number }) {
  const pct = value != null ? Math.max(0, Math.min(100, value)) : 0;
  return (
    <div
      className="relative shrink-0 rounded-full overflow-hidden glass-card shadow-water"
      style={{ width: size, height: size }}
    >
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-aquaglass-accent-dark to-aquaglass-accent"
        initial={{ height: 0 }}
        animate={{ height: value != null ? `${pct}%` : "0%" }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
      >
        {/* Water-surface highlight line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/50" />
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-number text-sm font-bold text-aquaglass-navy drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
          {value ?? "—"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glassmorphism stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon,
  gradient,
  delay = 0,
  ring,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  gradient: string;
  delay?: number;
  ring?: number | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative glass-card rounded-2xl p-5 overflow-hidden cursor-default"
    >
      {/* Accent glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${gradient} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500`} />

      <div className="relative z-10 flex items-start gap-3">
        {ring !== undefined ? (
          <ScoreRing value={ring} size={48} />
        ) : (
          <div className={`w-12 h-12 rounded-2xl ${gradient} flex items-center justify-center text-xl shrink-0 shadow-lg`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">{label}</p>
          <p className="font-number text-2xl font-bold text-zinc-900 leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-xs text-zinc-400 mt-1 truncate">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Quick action card — premium style
// ---------------------------------------------------------------------------

function ActionCard({
  href,
  icon,
  title,
  description,
  gradient,
  delay,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="h-full"
    >
      <Link
        href={href}
        className="group relative flex flex-col h-full glass-card rounded-2xl hover:shadow-glass-lg transition-all duration-300 overflow-hidden"
      >
        {/* Top gradient accent */}
        <div className={`h-1.5 ${gradient} transition-all duration-300 group-hover:h-2`} />
        
        {/* Floating accent blob */}
        <div className={`absolute top-4 right-4 w-20 h-20 rounded-full ${gradient} opacity-[0.07] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-500`} />
        
        <div className="relative z-10 p-5 flex flex-col flex-1">
          <div className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
            {icon}
          </div>
          <p className="font-heading font-bold text-zinc-900 group-hover:text-skin-700 transition-colors text-base">
            {title}
          </p>
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed flex-1">{description}</p>
          <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-skin-500 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-300">
            <span>Get started</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Floating face gallery
// ---------------------------------------------------------------------------

function FaceGallery() {
  // Polaroid-style frame: thicker white bottom margin + tiny caption, so each
  // face reads as a photo suspended over the gradient background rather than
  // a plain rounded image.
  const Polaroid = ({
    src,
    alt,
    caption,
    className,
  }: {
    src: string;
    alt: string;
    caption: string;
    className: string;
  }) => (
    <div className={`${className} bg-white/70 backdrop-blur-md p-2 pb-5 rounded-2xl shadow-glass-lg border border-white/60`}>
      <div className="relative w-full h-full rounded-lg overflow-hidden">
        <Image src={src} alt={alt} fill sizes="220px" className="object-cover" />
      </div>
      <p className="text-center text-[10px] font-medium text-aquaglass-navy/60 mt-1.5 tracking-wide">{caption}</p>
    </div>
  );

  return (
    <div className="relative w-full h-full min-h-[320px]">
      {/* Decorative glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full bg-skin-300/30 blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-36 h-36 rounded-full bg-teal-300/25 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute top-1/2 right-1/3 w-28 h-28 rounded-full bg-cream-300/30 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />

      {/* Face 1 — large, primary */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, rotate: -3 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
        className="absolute top-4 left-[10%] z-20"
      >
        <Polaroid src="/face1.jpg" alt="Radiant skin" caption="Glow · Day 30" className="w-44 h-44 sm:w-52 sm:h-52" />
      </motion.div>

      {/* Face 2 — medium, offset right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
        animate={{ opacity: 1, scale: 1, rotate: 4 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 150 }}
        className="absolute top-16 right-[5%] z-10"
      >
        <Polaroid src="/face2.jpg" alt="Clear skin" caption="Clarity · Day 14" className="w-36 h-36 sm:w-44 sm:h-44" />
      </motion.div>

      {/* Face 3 — small, bottom center */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 2 }}
        transition={{ delay: 0.7, type: "spring", stiffness: 150 }}
        className="absolute bottom-2 left-[30%] z-30"
      >
        <Polaroid src="/face3.jpg" alt="Healthy skin" caption="Baseline" className="w-32 h-32 sm:w-40 sm:h-40" />
      </motion.div>

      {/* Floating badges */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, type: "spring" }}
        className="absolute top-2 right-[15%] glass-card rounded-full px-3 py-1.5 z-40"
      >
        <span className="text-xs font-semibold text-teal-600">✨ AI Powered</span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, type: "spring" }}
        className="absolute bottom-8 left-[5%] glass-card rounded-full px-3 py-1.5 z-40"
      >
        <span className="text-xs font-semibold text-skin-600">🔬 Dermatologist Approved</span>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skin tips carousel
// ---------------------------------------------------------------------------

const SKIN_TIPS = [
  { icon: "💧", title: "Hydration First", text: "Drink 8 glasses of water daily. Hydrated skin looks plumper, firmer, and more radiant." },
  { icon: "☀️", title: "SPF Every Day", text: "Apply broad-spectrum SPF 30+ even on cloudy days. UV damage is the #1 cause of premature aging." },
  { icon: "🌙", title: "Night Repair", text: "Your skin repairs itself at night. Apply retinol or peptide serums before bed for best results." },
  { icon: "🥗", title: "Eat for Your Skin", text: "Antioxidant-rich foods like berries, spinach, and nuts fight free radicals and boost glow." },
  { icon: "😴", title: "Beauty Sleep", text: "7-9 hours of quality sleep reduces dark circles, puffiness, and stress-related breakouts." },
];

function SkinTipsCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setActive((p) => (p + 1) % SKIN_TIPS.length), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative glass-card glass-shimmer rounded-3xl p-6 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-teal-300/10 blur-3xl" />
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 relative z-10">💡 Daily Skin Tips</h3>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
          className="relative z-10"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-2xl shrink-0 shadow-lg">
              {SKIN_TIPS[active].icon}
            </div>
            <div>
              <h4 className="font-heading font-bold text-zinc-900 text-lg">{SKIN_TIPS[active].title}</h4>
              <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{SKIN_TIPS[active].text}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-5 relative z-10">
        {SKIN_TIPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-6 bg-teal-500" : "w-1.5 bg-zinc-300 hover:bg-zinc-400"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 animate-pulse ${className ?? "h-24"}`} />
  );
}

// ---------------------------------------------------------------------------
// Greeting helper
// ---------------------------------------------------------------------------

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<ProgressSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  // Questionnaire gate: check if user has completed their skin profile
  const [qStatus, setQStatus] = useState<"checking" | "done" | "pending">("checking");

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  useEffect(() => {
    // Check questionnaire completion first
    fetch("/api/proxy/questionnaire/latest")
      .then((r) => setQStatus(r.ok ? "done" : "pending"))
      .catch(() => setQStatus("pending"));
  }, []);

  useEffect(() => {
    if (qStatus !== "done") return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    progressApi
      .getSummary()
      .then(setSummary)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [qStatus]);

  function handleQuestionnaireComplete() {
    // Brief delay so the completion animation plays before switching views
    setTimeout(() => {
      setQStatus("done");
      progressApi
        .getSummary()
        .then(setSummary)
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, 1800);
  }

  const skinScore =
    summary?.latest_score != null ? Math.round(summary.latest_score) : null;
  const streak = summary?.current_streak ?? 0;
  const daysUntil = summary?.days_until_rescan;
  const isOverdue = summary?.is_rescan_overdue ?? false;
  const improvedCount = summary?.conditions.filter(
    (c) => c.status === "improved"
  ).length ?? 0;
  const totalConditions = summary?.conditions.length ?? 0;
  const notifications = summary?.unread_notification_count ?? 0;

  const nextScanLabel = isOverdue
    ? "Overdue"
    : daysUntil != null
    ? daysUntil === 0
      ? "Today"
      : `${daysUntil}d away`
    : "—";

  // ── Questionnaire gate: checking ──
  if (qStatus === "checking") {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-skin-50 via-white to-teal-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shadow-xl animate-pulse">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <p className="text-zinc-400 text-sm font-medium">Loading your profile…</p>
        </motion.div>
      </div>
    );
  }

  // ── Questionnaire gate: not yet completed ──
  if (qStatus === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-skin-50 via-white to-skin-100/40">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Welcome header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-base leading-none">S</span>
                </div>
                <span className="font-bold text-lg text-skin-800">Skinest</span>
              </Link>
            </div>
            <h1 className="font-heading text-2xl font-bold text-zinc-900">
              Welcome, {firstName}! 👋
            </h1>
            <p className="text-zinc-500 mt-1 text-sm leading-relaxed">
              Complete your skin profile first — it only takes ~5 minutes and lets our AI give you
              accurate, personalised results instead of generic ones.
            </p>
          </motion.div>

          {/* Embedded questionnaire */}
          <QuestionnaireForm onComplete={handleQuestionnaireComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skin-50/80 via-white to-teal-50/40 relative overflow-x-hidden">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-skin-200/20 blur-3xl" />
        <div className="absolute top-1/3 -left-48 w-80 h-80 rounded-full bg-teal-200/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-cream-200/20 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <span className="text-white font-bold text-lg leading-none">S</span>
              </div>
              <span className="font-heading font-bold text-xl text-zinc-800 hidden sm:block">Skinest</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {notifications > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="relative"
              >
                <button className="p-2.5 rounded-xl glass-card hover:shadow-glass-md transition-all">
                  <span className="text-lg">🔔</span>
                </button>
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-bold shadow-lg">
                  {notifications}
                </span>
              </motion.div>
            )}
            <Link
              href="/profile"
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center text-white font-bold text-sm shadow-lg hover:shadow-xl transition-shadow ring-2 ring-white/50"
            >
              {firstName[0]?.toUpperCase() ?? "U"}
            </Link>
          </div>
        </motion.header>

        {/* ── Hero section with face gallery ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10"
        >
          {/* Left — Welcome */}
          <div className="flex flex-col justify-center py-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-700 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-4 border border-teal-200/40">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                AI Analysis Active
              </div>
              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 leading-tight">
                {greeting()},<br />
                <span className="bg-gradient-to-r from-skin-500 to-skin-700 bg-clip-text text-transparent">{firstName}</span> 👋
              </h1>
              <p className="text-zinc-500 mt-3 text-base sm:text-lg leading-relaxed max-w-md">
                Here&apos;s your personalised skin health dashboard. Track your progress, discover insights, and achieve your skin goals.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <Link
                  href="/scan"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-skin-500 to-skin-600 hover:from-skin-600 hover:to-skin-700 text-white font-button font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  New Scan
                </Link>
                <Link
                  href="/progress"
                  className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-md border border-zinc-200/60 hover:border-skin-300 text-zinc-700 hover:text-skin-700 font-button font-semibold px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md"
                >
                  View Progress
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right — Face gallery */}
          <div className="hidden lg:block">
            <FaceGallery />
          </div>
        </motion.section>

        {/* ── API error ── */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200/60 bg-rose-50/80 backdrop-blur-sm px-5 py-4 text-sm text-rose-700 mb-6">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <p>Could not load your skin data. Check your connection and <button onClick={() => window.location.reload()} className="underline font-medium hover:text-rose-800">try again</button>.</p>
          </div>
        )}

        {/* ── Alerts ── */}
        {summary?.alerts && summary.alerts.length > 0 && (
          <div className="space-y-2 mb-6">
            {summary.alerts.map((a, i) => (
              <AlertBanner key={i} message={a.message} type={a.type} />
            ))}
          </div>
        )}

        {/* ── Stats strip ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard
              icon={<span>✨</span>}
              label="Skin Score"
              value={skinScore != null ? skinScore : "—"}
              sub={
                summary?.total_improvement != null && summary.total_improvement !== 0
                  ? `${summary.total_improvement > 0 ? "+" : ""}${summary.total_improvement.toFixed(1)} from baseline`
                  : "No scans yet"
              }
              gradient="bg-gradient-to-br from-teal-400 to-teal-600"
              ring={skinScore}
              delay={0.1}
            />
            <StatCard
              icon={<span>🔥</span>}
              label="Current Streak"
              value={streak > 0 ? `${streak}d` : "—"}
              sub={streak > 0 ? "routine adherence" : "Start your routine"}
              gradient="bg-gradient-to-br from-cream-400 to-cream-600"
              delay={0.15}
            />
            <StatCard
              icon={<span>📅</span>}
              label="Next Scan"
              value={nextScanLabel}
              sub={isOverdue ? "Please rescan now" : "recommended schedule"}
              gradient={isOverdue ? "bg-gradient-to-br from-rose-400 to-rose-600" : "bg-gradient-to-br from-skin-400 to-skin-600"}
              delay={0.2}
            />
            <StatCard
              icon={<span>💪</span>}
              label="Improved"
              value={totalConditions > 0 ? `${improvedCount}/${totalConditions}` : "—"}
              sub={totalConditions > 0 ? "conditions improving" : "No data yet"}
              gradient="bg-gradient-to-br from-teal-400 to-teal-600"
              delay={0.25}
            />
          </div>
        )}

        {/* ── Quick Actions ── */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-lg font-bold text-zinc-800">Quick Actions</h2>
            <span className="text-xs text-zinc-400 font-medium">Your skin care toolkit</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ActionCard
              href="/scan"
              icon={<span>📸</span>}
              title="New Scan"
              description="AI-powered skin analysis in seconds"
              gradient="bg-gradient-to-br from-skin-400 to-skin-600"
              delay={0.25}
            />
            <ActionCard
              href="/history"
              icon={<span>📋</span>}
              title="My History"
              description="Past scans, answers & care plans"
              gradient="bg-gradient-to-br from-zinc-400 to-zinc-600"
              delay={0.3}
            />
            <ActionCard
              href="/progress"
              icon={<span>📈</span>}
              title="Track Progress"
              description="Skin score trends & routine log"
              gradient="bg-gradient-to-br from-teal-400 to-teal-600"
              delay={0.35}
            />
            <ActionCard
              href="/roadmap"
              icon={<span>🗺️</span>}
              title="My Roadmap"
              description="Personalised care plan by AI"
              gradient="bg-gradient-to-br from-cream-400 to-skin-500"
              delay={0.4}
            />
          </div>
        </motion.section>

        {/* ── Bottom section: Conditions + Tips side by side ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* Recent conditions */}
          {!loading && summary && summary.conditions.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading text-lg font-bold text-zinc-800">Top Conditions</h2>
                <Link
                  href="/progress"
                  className="text-xs text-skin-600 hover:text-skin-700 font-semibold transition-colors flex items-center gap-1"
                >
                  View all
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </Link>
              </div>
              <div className="space-y-3">
                {summary.conditions.slice(0, 4).map((c) => {
                  const isImproved = c.status === "improved";
                  const isWorsened = c.status === "worsened";
                  return (
                    <div key={c.condition} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 hover:bg-white/80 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                        isImproved ? "bg-teal-100 text-teal-600" : isWorsened ? "bg-rose-100 text-rose-600" : "bg-zinc-100 text-zinc-500"
                      }`}>
                        {isImproved ? "✅" : isWorsened ? "⚠️" : "➡️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 capitalize truncate">
                          {c.condition.replace(/_/g, " ")}
                        </p>
                        {c.improvement_pct != null && (
                          <p
                            className={`text-xs font-medium ${
                              isImproved
                                ? "text-teal-600"
                                : isWorsened
                                ? "text-rose-600"
                                : "text-zinc-400"
                            }`}
                          >
                            {isImproved ? "+" : ""}
                            {c.improvement_pct.toFixed(1)}% from baseline
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                          isImproved
                            ? "bg-teal-100 text-teal-700"
                            : isWorsened
                            ? "bg-rose-100 text-rose-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : !loading && !summary ? (
            /* ── No data empty state ── */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass-card rounded-3xl p-8 text-center flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center text-4xl mx-auto mb-5 shadow-xl">
                📸
              </div>
              <h2 className="font-heading text-xl font-bold text-zinc-900 mb-2">
                Start your skin journey
              </h2>
              <p className="text-sm text-zinc-500 mb-6 max-w-xs mx-auto leading-relaxed">
                Take your first AI scan to get your baseline skin score and a personalised care roadmap.
              </p>
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-skin-500 to-skin-600 hover:from-skin-600 hover:to-skin-700 text-white font-button font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
              >
                <span>📸</span> Start First Scan
              </Link>
            </motion.div>
          ) : null}

          {/* Skin tips carousel */}
          <SkinTipsCarousel />
        </div>

        {/* ── Feature highlights — visual cards ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-10"
        >
          <h2 className="font-heading text-lg font-bold text-zinc-800 mb-5">Powered by Advanced AI</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                gradient: "from-skin-400 to-skin-600",
                icon: "🧬",
                title: "Deep Skin Analysis",
                desc: "4 neural networks analyse your skin type, tone, conditions, and acne severity in real-time.",
              },
              {
                gradient: "from-teal-400 to-teal-600",
                icon: "🤖",
                title: "Smart Recommendations",
                desc: "AI matches your unique skin profile with dermatologist-vetted products from trusted Indian brands.",
              },
              {
                gradient: "from-cream-500 to-skin-500",
                icon: "📊",
                title: "Progress Tracking",
                desc: "Watch your skin transform over time with AI-powered progress scores and trend analysis.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                whileHover={{ y: -4 }}
                className="relative glass-card rounded-2xl hover:shadow-glass-lg transition-all duration-300 p-6 overflow-hidden group"
              >
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${feature.gradient} opacity-[0.08] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-500`} />
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-2xl mb-4 shadow-lg`}>
                  {feature.icon}
                </div>
                <h3 className="font-heading font-bold text-zinc-900 text-base mb-1.5">{feature.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Footer nav ── */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex flex-wrap items-center justify-center gap-6 pt-6 pb-8 border-t border-zinc-100/60"
        >
          {[
            { href: "/scan", label: "Scan", icon: "📸" },
            { href: "/results", label: "Results", icon: "📊" },
            { href: "/progress", label: "Progress", icon: "📈" },
            { href: "/roadmap", label: "Roadmap", icon: "🗺️" },
            { href: "/profile", label: "Profile", icon: "👤" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-skin-600 transition-colors font-medium group"
            >
              <span className="group-hover:scale-110 transition-transform">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </motion.footer>
      </div>
    </div>
  );
}
