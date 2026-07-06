"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
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
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        isOverdue
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : isWorsened
          ? "border-cream-300 bg-cream-50 text-cream-800"
          : "border-skin-200 bg-skin-50 text-skin-800",
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
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex items-start gap-3"
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
          accent ?? "bg-skin-50"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-400 font-medium truncate">{label}</p>
        <p className="font-number text-xl font-bold text-zinc-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Quick action card
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
  icon: string;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link
        href={href}
        className="group block bg-white rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-skin-200 transition-all duration-200 overflow-hidden"
      >
        <div className={`h-2 ${gradient}`} />
        <div className="p-5">
          <span className="text-3xl block mb-3">{icon}</span>
          <p className="font-bold text-zinc-900 group-hover:text-skin-700 transition-colors">
            {title}
          </p>
          <p className="text-sm text-zinc-400 mt-1 leading-snug">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-zinc-100 animate-pulse ${className ?? "h-24"}`} />
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
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-zinc-400 text-sm animate-pulse">Loading your profile…</div>
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
                <span className="font-bold text-lg text-skin-800">SkinAI</span>
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
    <div className="min-h-screen bg-gradient-to-br from-skin-50 via-white to-skin-100/40">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-base leading-none">S</span>
              </div>
              <span className="font-bold text-lg text-skin-800 hidden sm:block">SkinAI</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {notifications > 0 && (
              <div className="relative">
                <button className="p-2 rounded-full bg-white border border-zinc-100 shadow-sm hover:bg-zinc-50 transition-colors">
                  <span className="text-lg">🔔</span>
                </button>
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-rose-500 text-white text-xs font-bold">
                  {notifications}
                </span>
              </div>
            )}
            <Link
              href="/profile"
              className="w-9 h-9 rounded-full bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center text-white font-bold text-sm shadow-sm hover:shadow-md transition-shadow"
            >
              {firstName[0]?.toUpperCase() ?? "U"}
            </Link>
          </div>
        </motion.div>

        {/* ── Welcome ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <h1 className="font-heading text-2xl font-bold text-zinc-900">
            {greeting()}, {firstName} 👋
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Here&apos;s a snapshot of your skin health journey.
          </p>
        </motion.div>

        {/* ── API error ── */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <p>Could not load your skin data. Check your connection and <button onClick={() => window.location.reload()} className="underline font-medium">try again</button>.</p>
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

        {/* ── Stats strip ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon="✨"
              label="Skin Score"
              value={skinScore != null ? skinScore : "—"}
              sub={
                summary?.total_improvement != null && summary.total_improvement !== 0
                  ? `${summary.total_improvement > 0 ? "+" : ""}${summary.total_improvement.toFixed(1)} from baseline`
                  : "No scans yet"
              }
              accent="bg-teal-50"
            />
            <StatCard
              icon="🔥"
              label="Current Streak"
              value={streak > 0 ? `${streak}d` : "—"}
              sub={streak > 0 ? "routine adherence" : "Start your routine"}
              accent="bg-cream-50"
            />
            <StatCard
              icon="📅"
              label="Next Scan"
              value={nextScanLabel}
              sub={isOverdue ? "Please rescan now" : "recommended schedule"}
              accent={isOverdue ? "bg-rose-50" : "bg-teal-50"}
            />
            <StatCard
              icon="💪"
              label="Improved"
              value={totalConditions > 0 ? `${improvedCount}/${totalConditions}` : "—"}
              sub={totalConditions > 0 ? "conditions improving" : "No data yet"}
              accent="bg-teal-50"
            />
          </div>
        )}

        {/* ── Quick actions ── */}
        <div>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3"
          >
            Quick Actions
          </motion.h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ActionCard
              href="/scan"
              icon="📸"
              title="New Scan"
              description="Analyse your skin with AI"
              gradient="bg-gradient-to-r from-skin-400 to-skin-600"
              delay={0.1}
            />
            <ActionCard
              href="/history"
              icon="📋"
              title="My History"
              description="Past scans, answers & plans"
              gradient="bg-gradient-to-r from-gray-400 to-gray-600"
              delay={0.15}
            />
            <ActionCard
              href="/progress"
              icon="📈"
              title="Track Progress"
              description="Skin score & routine log"
              gradient="bg-gradient-to-r from-teal-400 to-teal-600"
              delay={0.2}
            />
            <ActionCard
              href="/roadmap"
              icon="🗺️"
              title="My Roadmap"
              description="Personalised care plan"
              gradient="bg-gradient-to-r from-cream-400 to-skin-500"
              delay={0.25}
            />
          </div>
        </div>

        {/* ── Recent conditions ── */}
        {!loading && summary && summary.conditions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-900">Top Conditions</h2>
              <Link
                href="/progress"
                className="text-xs text-skin-600 hover:text-skin-700 font-medium transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {summary.conditions.slice(0, 3).map((c) => {
                const isImproved = c.status === "improved";
                const isWorsened = c.status === "worsened";
                return (
                  <div key={c.condition} className="flex items-center gap-3">
                    <span className="text-lg shrink-0">
                      {isImproved ? "✅" : isWorsened ? "⚠️" : "➡️"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 capitalize truncate">
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
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        isImproved
                          ? "bg-teal-50 text-teal-700"
                          : isWorsened
                          ? "bg-rose-50 text-rose-700"
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
        )}

        {/* ── No data empty state ── */}
        {!loading && !summary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-skin-100 shadow-sm p-8 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center text-3xl mx-auto mb-4">
              📸
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">
              Start your skin journey
            </h2>
            <p className="text-sm text-zinc-500 mb-5 max-w-xs mx-auto">
              Take your first AI scan to get your baseline skin score and a personalised care roadmap.
            </p>
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 bg-skin-500 hover:bg-skin-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <span>📸</span> Start First Scan
            </Link>
          </motion.div>
        )}

        {/* ── Footer nav ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap items-center justify-center gap-4 pt-2 pb-4 border-t border-zinc-100"
        >
          {[
            { href: "/scan", label: "Scan" },
            { href: "/results", label: "Results" },
            { href: "/progress", label: "Progress" },
            { href: "/roadmap", label: "Roadmap" },
            { href: "/profile", label: "Profile" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-400 hover:text-skin-600 transition-colors font-medium"
            >
              {link.label}
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
