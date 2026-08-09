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
    <div className="rounded-xl border border-deep-brown/15 bg-cream px-3 py-2 shadow-md text-xs font-sans text-deep-brown">
      <p className="font-serif font-bold text-deep-brown">{d.label}</p>
      <p className="text-deep-brown/80 mt-0.5">
        Score: <span className="font-serif font-bold text-olive">{d.overall_skin_score?.toFixed(1)}</span>
      </p>
      {d.delta_from_baseline != null && d.delta_from_baseline !== 0 && (
        <p className={d.delta_from_baseline > 0 ? "text-olive font-bold" : "text-deep-brown font-bold"}>
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-deep-brown/20 bg-cream py-12 text-center font-sans">
        <p className="text-deep-brown/70 text-xs">No scan data recorded yet.</p>
        <p className="text-deep-brown/50 text-[11px] mt-1">Complete your first scan to start tracking score trends.</p>
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
    <div className="space-y-6 font-sans">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-cream border border-deep-brown/10 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-olive">Starting score</span>
          <span className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown leading-none mt-1 block">
            {baselineScore?.toFixed(0) ?? "—"}
          </span>
        </div>
        <div className="bg-cream border border-deep-brown/10 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-olive">Current score</span>
          <span className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown leading-none mt-1 block">
            {latestScore?.toFixed(0) ?? "—"}
          </span>
        </div>
        {totalImprovement != null && totalImprovement !== 0 && (
          <div className="bg-cream border border-deep-brown/10 rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-olive">Improvement</span>
            <span className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown leading-none mt-1 block">
              {totalImprovement > 0 ? "+" : ""}
              {totalImprovement.toFixed(1)} pts
            </span>
          </div>
        )}
      </div>

      {/* Recharts line chart */}
      <div className="h-56 bg-cream border border-deep-brown/10 rounded-xl p-4 shadow-sm">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="skinScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5C6040" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#5C6040" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#28261E" strokeOpacity={0.1} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#28261E", opacity: 0.7 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#28261E", opacity: 0.7 }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={HEALTHY_BASELINE}
              stroke="#5C6040"
              strokeDasharray="4 4"
              label={{ value: "Healthy baseline (80)", position: "insideTopRight", fontSize: 10, fill: "#5C6040", fontWeight: "bold" }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#5C6040"
              strokeWidth={2.5}
              fill="url(#skinScoreGradient)"
              dot={{ fill: "#5C6040", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#28261E" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Progress toward healthy baseline */}
      {baselineScore != null && (baselineScore < HEALTHY_BASELINE || pctToHealthy > 0) && (
        <div className="space-y-1.5 bg-cream border border-deep-brown/10 rounded-xl p-4 shadow-sm">
          <div className="flex justify-between text-xs text-deep-brown font-sans">
            <span className="font-bold">Progress toward healthy baseline (80/100)</span>
            <span className="font-serif font-bold text-olive">{pctToHealthy.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-nude/30 overflow-hidden border border-deep-brown/10">
            <div
              className="h-full rounded-full bg-olive transition-all duration-700"
              style={{ width: `${Math.min(pctToHealthy, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
