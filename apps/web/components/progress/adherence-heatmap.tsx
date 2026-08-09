"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { progressApi } from "@/lib/api/progress";
import type { HeatmapDay, AdherenceLevel } from "@/lib/api/progress";

import { Flame } from "lucide-react";

interface Props {
  /** Seed data from summary (7 days). Component fetches full 90-day data itself. */
  initialStreak?: number;
  onCheckinComplete?: (streak: number) => void;
}

const ADHERENCE_COLORS: Record<AdherenceLevel | "empty", string> = {
  yes: "bg-teal-500",
  mostly: "bg-cream-500",
  no: "bg-zinc-200",
  empty: "bg-zinc-100",
};

const ADHERENCE_LABELS: Record<AdherenceLevel, string> = {
  yes: "Yes",
  mostly: "Mostly",
  no: "No",
};

function HeatmapCell({ day }: { day: HeatmapDay }) {
  const colorKey = day.adherence ?? "empty";
  const color = ADHERENCE_COLORS[colorKey];
  const dateStr = day.date
    ? `${format(parseISO(day.date), "MMM d")}${day.adherence ? ` — ${ADHERENCE_LABELS[day.adherence]}` : " — no data"}`
    : "";

  return (
    <div
      title={dateStr}
      aria-label={dateStr}
      className={`w-3.5 h-3.5 rounded-sm ${color} cursor-default`}
    />
  );
}

export function AdherenceHeatmap({ initialStreak = 0, onCheckinComplete }: Props) {
  const [days, setDays] = useState<HeatmapDay[]>([]);
  const [streak, setStreak] = useState(initialStreak);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [todayAnswer, setTodayAnswer] = useState<AdherenceLevel | null>(null);

  useEffect(() => {
    progressApi
      .getAdherence()
      .then((data) => {
        setDays(data.days);
        setStreak(data.current_streak);
        setLongestStreak(data.longest_streak);
        setTotalCheckins(data.total_checkins);
        const today = format(new Date(), "yyyy-MM-dd");
        const existing = data.days.find((d) => d.date === today)?.adherence ?? null;
        setTodayAnswer(existing);
      })
      .catch(() => {/* silently degrade */})
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckin(level: AdherenceLevel) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await progressApi.submitCheckin({ adherence: level });
      setTodayAnswer(level);
      setStreak(res.current_streak);
      onCheckinComplete?.(res.current_streak);
      // Update today's cell in local state
      const today = format(new Date(), "yyyy-MM-dd");
      setDays((prev) =>
        prev.map((d) => (d.date === today ? { ...d, adherence: level } : d))
      );
      toast.success(
        level === "yes"
          ? res.current_streak > 1
            ? `${res.current_streak}-day streak!`
            : "Day 1 — keep going!"
          : "Logged — tomorrow is a fresh start."
      );
    } catch {
      toast.error("Could not save check-in. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Build 13-week grid — pad to 91 entries so first cell = Sunday
  const padded = [...days];
  while (padded.length < 91) {
    padded.unshift({ date: "", adherence: null });
  }
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <div className="space-y-5">
      {/* Weekly check-in widget */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
        <p className="font-semibold text-zinc-800 text-sm">
          Did you follow your routine this week?
        </p>
        <div className="flex gap-2 flex-wrap">
          {(["yes", "mostly", "no"] as AdherenceLevel[]).map((level) => (
            <button
              key={level}
              disabled={submitting}
              onClick={() => handleCheckin(level)}
              className={[
                "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                todayAnswer === level
                  ? level === "yes"
                    ? "bg-teal-500 text-white border-teal-500"
                    : level === "mostly"
                    ? "bg-cream-500 text-gray-900 border-cream-500"
                    : "bg-zinc-400 text-white border-zinc-400"
                  : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400",
                submitting ? "opacity-50 cursor-not-allowed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {level === "yes" ? "Yes" : level === "mostly" ? "Mostly" : "No"}
            </button>
          ))}
        </div>

        {streak > 0 && (
          <p className="text-sm text-zinc-600">
            You&apos;ve followed your routine{" "}
            <span className="font-bold text-skin-500">
              {streak} day{streak !== 1 ? "s" : ""} in a row
            </span>
            {streak >= 7 && <Flame className="inline-block w-4 h-4 ml-1 text-butter" />}
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-wide">Current streak</p>
          <p className="font-bold text-skin-500 text-xl">{streak}d</p>
        </div>
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-wide">Longest streak</p>
          <p className="font-bold text-zinc-700 text-xl">{longestStreak}d</p>
        </div>
        <div>
          <p className="text-zinc-400 text-xs uppercase tracking-wide">Total check-ins</p>
          <p className="font-bold text-zinc-700 text-xl">{totalCheckins}</p>
        </div>
      </div>

      {/* Heatmap grid */}
      {loading ? (
        <div className="h-28 rounded-xl bg-zinc-100 animate-pulse" />
      ) : (
        <div className="space-y-1 overflow-x-auto">
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) =>
                  day.date ? (
                    <HeatmapCell key={day.date} day={day} />
                  ) : (
                    <div key={`empty-${wi}-${di}`} className="w-3.5 h-3.5" />
                  )
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3.5 h-3.5 rounded-sm bg-zinc-100" />
              <div className="w-3.5 h-3.5 rounded-sm bg-zinc-200" />
              <div className="w-3.5 h-3.5 rounded-sm bg-cream-500" />
              <div className="w-3.5 h-3.5 rounded-sm bg-teal-500" />
            </div>
            <span>More</span>
          </div>
        </div>
      )}
    </div>
  );
}
