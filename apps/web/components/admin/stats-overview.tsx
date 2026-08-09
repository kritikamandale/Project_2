"use client";

import { useEffect, useState } from "react";
import { Users, Camera, Stethoscope, CheckCircle } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import type { AnalyticsOverview } from "@/lib/api/admin";

type IconName = "users" | "camera" | "stethoscope" | "check";
const ICON_MAP: Record<IconName, React.ElementType> = {
  users: Users,
  camera: Camera,
  stethoscope: Stethoscope,
  check: CheckCircle,
};

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: IconName;
}) {
  const Icon = ICON_MAP[icon];
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shrink-0 shadow-lg text-white">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">{label}</p>
          <p className="font-number text-2xl font-bold text-zinc-900 leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-xs text-zinc-400 mt-1 truncate">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 animate-pulse" />
      ))}
    </div>
  );
}

export function StatsOverview() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminApi
      .getAnalyticsOverview()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  if (error || !data) {
    return (
      <p className="text-sm text-rose-600">Could not load platform analytics. Please try again.</p>
    );
  }

  const growthSign = data.users_mom_growth_pct > 0 ? "+" : "";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon="users"
        label="Total Users"
        value={data.total_users.toLocaleString()}
        sub={`${growthSign}${data.users_mom_growth_pct.toFixed(1)}% MoM`}
      />
      <KpiCard
        icon="camera"
        label="Scans Today"
        value={data.scans_today.toLocaleString()}
        sub={`${data.scans_this_week} this week`}
      />
      <KpiCard
        icon="stethoscope"
        label="Derm Queue"
        value={data.pending_derm_reviews.toLocaleString()}
        sub="pending review"
      />
      <KpiCard
        icon="check"
        label="Recommendation Acceptance"
        value={`${data.recommendation_acceptance_rate.toFixed(1)}%`}
        sub={`${data.active_products.toLocaleString()} active products`}
      />
    </div>
  );
}
