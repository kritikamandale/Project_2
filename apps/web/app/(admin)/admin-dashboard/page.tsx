"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Users,
  ScanLine,
  TrendingUp,
  Star,
  Activity,
  ShieldCheck,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  adminApi,
  type AnalyticsOverview,
  type ChartsData,
} from "@/lib/api/admin";

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  color: string;
  sparkline?: { date: string; value: number }[];
}

function KpiCard({ title, value, subtitle, trend, icon, color, sparkline }: KpiCardProps) {
  const trendUp = trend !== undefined && trend >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              trendUp ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {trendUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {sparkline && sparkline.length > 0 && (
        <div className="h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <defs>
                <linearGradient id={`sg-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6366f1"
                strokeWidth={1.5}
                fill={`url(#sg-${title})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const SKIN_COLORS = ["#f59e0b", "#10b981", "#6366f1", "#ec4899", "#14b8a6"];
const FITZ_COLORS = ["#fde68a", "#fcd34d", "#f59e0b", "#d97706", "#92400e", "#451a03"];
const CONDITION_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#4f46e5", "#3730a3", "#312e81"];

// ---------------------------------------------------------------------------
// Chart Section Header
// ---------------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminApi.getAnalyticsOverview(), adminApi.getChartsData()])
      .then(([ov, ch]) => {
        setOverview(ov);
        setCharts(ch);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertTriangle className="text-red-400" size={32} />
          <p className="text-slate-700 font-medium">Failed to load analytics</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const ov = overview!;
  const ch = charts!;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Platform health and analytics overview</p>
      </div>

      <div className="px-8 py-8 space-y-10 max-w-screen-2xl mx-auto">

        {/* ── KPI Cards ── */}
        <section>
          <SectionHeader title="Platform Overview" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard
              title="Total Users"
              value={ov.total_users.toLocaleString()}
              trend={ov.users_mom_growth_pct}
              subtitle="MoM growth"
              icon={<Users size={18} className="text-indigo-600" />}
              color="bg-indigo-50"
              sparkline={ov.user_growth_sparkline}
            />
            <KpiCard
              title="Scans Today"
              value={ov.scans_today.toLocaleString()}
              subtitle={`${ov.scans_this_week.toLocaleString()} this week`}
              icon={<ScanLine size={18} className="text-violet-600" />}
              color="bg-violet-50"
            />
            <KpiCard
              title="Scans This Month"
              value={ov.scans_this_month.toLocaleString()}
              icon={<Activity size={18} className="text-sky-600" />}
              color="bg-sky-50"
            />
            <KpiCard
              title="Avg Improvement"
              value={`${ov.avg_skin_improvement_score.toFixed(1)} pts`}
              subtitle="Skin score delta"
              icon={<TrendingUp size={18} className="text-emerald-600" />}
              color="bg-emerald-50"
            />
            <KpiCard
              title="Acceptance Rate"
              value={`${ov.recommendation_acceptance_rate.toFixed(1)}%`}
              subtitle="Rated ≥ 4/5"
              icon={<Star size={18} className="text-amber-500" />}
              color="bg-amber-50"
            />
          </div>

          {/* Second row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <KpiCard
              title="Pending Derm Reviews"
              value={ov.pending_derm_reviews.toLocaleString()}
              icon={<ShieldCheck size={18} className="text-rose-600" />}
              color="bg-rose-50"
            />
            <KpiCard
              title="Active Products"
              value={ov.active_products.toLocaleString()}
              icon={<Package size={18} className="text-teal-600" />}
              color="bg-teal-50"
            />
          </div>
        </section>

        {/* ── User Registration Trend ── */}
        <section>
          <SectionHeader
            title="User Registration Trend"
            subtitle="Daily new registrations — last 90 days"
          />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={ch.registration_trend} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(v: string) => v.slice(5)}
                  interval={13}
                />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  labelStyle={{ color: "#475569" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="New Users"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#regGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ── Row: Skin Type + Fitzpatrick ── */}
        <section className="grid md:grid-cols-2 gap-6">

          {/* Skin Type Pie */}
          <div>
            <SectionHeader title="Skin Type Distribution" />
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={ch.skin_type_distribution}
                    dataKey="count"
                    nameKey="skin_type"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {ch.skin_type_distribution.map((_, i) => (
                      <Cell key={i} fill={SKIN_COLORS[i % SKIN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v} users`, name]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {ch.skin_type_distribution.map((item, i) => (
                  <div key={item.skin_type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: SKIN_COLORS[i % SKIN_COLORS.length] }}
                      />
                      <span className="capitalize text-slate-700">{item.skin_type}</span>
                    </div>
                    <span className="text-slate-500">{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fitzpatrick Distribution */}
          <div>
            <SectionHeader title="Fitzpatrick Tone Distribution" subtitle="Bias monitoring signal" />
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ch.fitzpatrick_distribution} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tone" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [`${v} users`, `Tone ${name}`]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" name="tone" radius={[4, 4, 0, 0]}>
                    {ch.fitzpatrick_distribution.map((_, i) => (
                      <Cell key={i} fill={FITZ_COLORS[i % FITZ_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ── Row: Top Cities + Improvement by Condition ── */}
        <section className="grid md:grid-cols-2 gap-6">

          {/* Top Cities horizontal bar */}
          <div>
            <SectionHeader title="Top Cities by User Count" />
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={ch.top_cities}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis
                    dataKey="city"
                    type="category"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v} users`, "Count"]}
                  />
                  <Bar dataKey="user_count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Improvement by Condition */}
          <div>
            <SectionHeader
              title="Avg Improvement by Skin Condition"
              subtitle="% improvement over baseline"
            />
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              {ch.improvement_by_condition.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">
                  No improvement data yet — users need progress scans
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={ch.improvement_by_condition}
                    margin={{ top: 4, right: 16, bottom: 40, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="condition"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, "Avg improvement"]}
                    />
                    <Bar dataKey="avg_improvement_pct" radius={[4, 4, 0, 0]}>
                      {ch.improvement_by_condition.map((_, i) => (
                        <Cell key={i} fill={CONDITION_COLORS[i % CONDITION_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* ── Revenue placeholder ── */}
        <section>
          <SectionHeader title="Revenue Potential" subtitle="Monetization module (coming soon)" />
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
            <TrendingUp size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">
              Revenue analytics will appear here once the monetization module is enabled.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
