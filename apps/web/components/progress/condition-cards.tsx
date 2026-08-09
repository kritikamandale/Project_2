"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { ConditionProgressItem } from "@/lib/api/progress";
import {
  Circle,
  Sun,
  Sparkle,
  Droplet,
  Shield,
  CircleDot,
  Activity,
  Layers,
  Sparkles
} from "lucide-react";

interface Props {
  conditions: ConditionProgressItem[];
}

const SEVERITY_LABEL: Record<number, string> = {
  0: "None",
  1: "Mild",
  2: "Moderate",
  3: "Severe",
};

function renderConditionIcon(condition: string) {
  const props = { className: "w-4 h-4 text-olive" };
  switch (condition) {
    case "acne": return <Circle {...props} />;
    case "dark_spots": return <Sun {...props} />;
    case "pigmentation": return <Sun {...props} />;
    case "wrinkles": return <Activity {...props} />;
    case "dryness": return <Droplet {...props} />;
    case "redness": return <Shield {...props} />;
    case "pores": return <CircleDot {...props} />;
    case "texture": return <Sparkle {...props} />;
    case "uneven_tone": return <Layers {...props} />;
    default: return <Sparkles {...props} />;
  }
}

function statusColors(status: ConditionProgressItem["status"]) {
  if (status === "improved")
    return {
      badge: "bg-olive/10 text-olive",
      border: "border-olive/20",
      line: "#5C6040",
    };
  if (status === "worsened")
    return {
      badge: "bg-deep-brown/10 text-deep-brown",
      border: "border-deep-brown/20",
      line: "#28261E",
    };
  return {
    badge: "bg-cream text-deep-brown/60",
    border: "border-deep-brown/10",
    line: "#D6B59A",
  };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConditionCard({ item }: { item: ConditionProgressItem }) {
  const colors = statusColors(item.status);
  const baseSev = item.baseline_severity != null ? SEVERITY_LABEL[Math.round(item.baseline_severity)] ?? "—" : "—";
  const latSev = item.latest_severity != null ? SEVERITY_LABEL[Math.round(item.latest_severity)] ?? "—" : "—";
  const name = item.condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`rounded-xl border ${colors.border} bg-cream p-4 flex flex-col gap-3 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {renderConditionIcon(item.condition)}
          <span className="font-semibold text-deep-brown text-sm">{name}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
          {item.status}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-500 space-y-0.5">
          <p>
            <span className="text-zinc-400">Scan 1: </span>
            <span className="font-medium text-zinc-700">{baseSev}</span>
          </p>
          <p>
            <span className="text-zinc-400">Latest: </span>
            <span className="font-medium text-zinc-700">{latSev}</span>
          </p>
          {item.improvement_pct != null && (
            <p
              className={
                item.improvement_pct > 0
                  ? "text-teal-600 font-semibold"
                  : item.improvement_pct < 0
                  ? "text-rose-500 font-semibold"
                  : "text-zinc-500"
              }
            >
              {item.improvement_pct > 0 ? "+" : ""}
              {item.improvement_pct.toFixed(0)}%
            </p>
          )}
        </div>
        <Sparkline data={item.scan_history} color={colors.line} />
      </div>

      {item.status === "worsened" && (
        <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700">
          Your <strong>{name.toLowerCase()}</strong> has worsened. This may be due to seasonal
          changes or new products. Consider reviewing your routine.
        </div>
      )}
    </div>
  );
}

export function ConditionCards({ conditions }: Props) {
  if (!conditions.length) {
    return (
      <p className="text-sm text-zinc-500 italic">
        No condition data yet — complete a re-scan to see per-condition progress.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {conditions.map((c) => (
        <ConditionCard key={c.condition} item={c} />
      ))}
    </div>
  );
}
