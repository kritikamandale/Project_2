"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { TimelinePoint } from "@/lib/api/progress";

interface Props {
  points: TimelinePoint[];
  baselineScore: number | null;
  latestScore: number | null;
  totalImprovement: number | null;
  improvementPct: number | null;
}

const HEALTHY_BASELINE = 80;

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TimelinePoint & { label: string };
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-zinc-800">{d.label}</p>
      <p className="text-zinc-600">
        Score: <span className="font-bold text-teal-600">{d.overall_skin_score?.toFixed(1)}</span>
      </p>
      {d.delta_from_baseline != null && d.delta_from_baseline !== 0 && (
        <p className={d.delta_from_baseline > 0 ? "text-teal-600" : "text-rose-500"}>
          {d.delta_from_baseline > 0 ? "+" : ""}
          {d.delta_from_baseline.toFixed(1)} from baseline
        </p>
      )}
    </div>
  );
}

export function ProgressTimeline({
  points,
  baselineScore,
  latestScore,
  totalImprovement,
  improvementPct,
}: Props) {
  if (!points.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-12 text-center">
        <p className="text-zinc-500 text-sm">No scan data yet.</p>
        <p className="text-zinc-400 text-xs mt-1">Complete your first scan to start tracking.</p>
      </div>
    );
  }

  const chartData = points.map((p) => ({
    ...p,
    label: `Scan ${p.scan_number} — ${format(parseISO(p.scanned_at), "MMM d")}`,
    score: p.overall_skin_score ?? 0,
  }));

  const pctToHealthy = improvementPct ?? 0;

  return (
    <div className="space-y-5">
      {/* Headline numbers */}
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Starting score</span>
          <span className="text-3xl font-bold text-zinc-800">{baselineScore?.toFixed(0) ?? "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Current score</span>
          <span className="text-3xl font-bold text-teal-600">{latestScore?.toFixed(0) ?? "—"}</span>
        </div>
        {totalImprovement != null && totalImprovement !== 0 && (
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Improvement</span>
            <span
              className={`text-3xl font-bold ${totalImprovement > 0 ? "text-teal-600" : "text-rose-500"}`}
            >
              {totalImprovement > 0 ? "+" : ""}
              {totalImprovement.toFixed(1)} pts
            </span>
          </div>
        )}
      </div>

      {/* Recharts line chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="skinScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6e9783" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6e9783" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e8" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#9ea0ad" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#9ea0ad" }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={HEALTHY_BASELINE}
              stroke="#c5c6ce"
              strokeDasharray="4 4"
              label={{ value: "Healthy baseline (80)", position: "insideTopRight", fontSize: 10, fill: "#9ea0ad" }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#6e9783"
              strokeWidth={2.5}
              fill="url(#skinScoreGradient)"
              dot={{ fill: "#6e9783", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#587969" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Progress toward healthy baseline */}
      {baselineScore != null && (baselineScore < HEALTHY_BASELINE || pctToHealthy > 0) && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Progress toward healthy skin (80/100)</span>
            <span className="font-semibold text-zinc-700">{pctToHealthy.toFixed(0)}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-700"
              style={{ width: `${Math.min(pctToHealthy, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
