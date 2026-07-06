"use client";

import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";

interface Props {
  lastScanDate: string | null;
  daysUntilRescan: number | null;
  isOverdue: boolean;
}

export function RescanCTA({ lastScanDate, daysUntilRescan, isOverdue }: Props) {
  const router = useRouter();

  // No scan yet
  if (!lastScanDate) {
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-teal-800">Start your skin journey</p>
          <p className="text-sm text-teal-700 mt-0.5">
            Take your first scan to begin tracking your progress.
          </p>
        </div>
        <button
          onClick={() => router.push("/scan")}
          className="shrink-0 px-5 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors"
        >
          Scan now
        </button>
      </div>
    );
  }

  // Overdue
  if (isOverdue) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-rose-700">Your 30-day scan is overdue</p>
          <p className="text-sm text-rose-600 mt-0.5">
            Last scanned: {format(parseISO(lastScanDate), "MMMM d, yyyy")}. Re-scan now to track
            your progress.
          </p>
        </div>
        <button
          onClick={() => router.push("/scan")}
          className="shrink-0 px-5 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors"
        >
          Re-scan now
        </button>
      </div>
    );
  }

  // Upcoming
  const totalDays = 30;
  const elapsed = totalDays - (daysUntilRescan ?? 0);
  const pct = Math.min((elapsed / totalDays) * 100, 100);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-800">Next recommended re-scan</p>
          <p className="text-sm text-zinc-500 mt-0.5">
            {daysUntilRescan != null ? (
              <>
                Your next skin scan is in{" "}
                <span className="font-bold text-teal-600">{daysUntilRescan} days</span>.
                Continue your routine for best results.
              </>
            ) : (
              "Continue your routine for best results."
            )}
          </p>
        </div>
        <button
          onClick={() => router.push("/scan")}
          className="shrink-0 px-5 py-2.5 rounded-lg border border-teal-300 text-teal-700 bg-teal-50 text-sm font-semibold hover:bg-teal-100 transition-colors"
        >
          Re-scan early
        </button>
      </div>

      {/* Countdown progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-400">
          <span>Last scan: {format(parseISO(lastScanDate), "MMM d")}</span>
          <span>Next scan: {format(parseISO(lastScanDate), "MMM d, yyyy").replace(
            /\d{4}$/,
            new Date(new Date(lastScanDate).getTime() + 30 * 864e5).getFullYear().toString()
          )}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-400 text-right">{elapsed} / {totalDays} days</p>
      </div>
    </div>
  );
}
