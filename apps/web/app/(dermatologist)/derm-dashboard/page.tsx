"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  User,
} from "lucide-react";
import { dermApi, DermStatsResponse, ReviewQueueItem } from "@/lib/api/dermatologist";

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  delay: number;
}

function StatCard({ icon, label, value, sub, accent, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex gap-4 items-start"
    >
      <div className={`p-3 rounded-xl ${accent} flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Priority badge
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-red-100 text-red-700",
    normal: "bg-teal-100 text-teal-700",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[priority] ?? map.normal}`}
    >
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-cream-100 text-cream-800",
    in_review: "bg-gray-100 text-gray-700",
    approved: "bg-teal-100 text-teal-700",
    rejected: "bg-red-100 text-red-700",
    escalated: "bg-skin-100 text-skin-700",
  };
  const label = status.replace("_", " ");
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DermDashboardPage() {
  const [stats, setStats] = useState<DermStatsResponse | null>(null);
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, queueData] = await Promise.all([
          dermApi.getStats(),
          dermApi.getQueue({ per_page: 5, sort_by: "priority", sort_dir: "desc" }),
        ]);
        setStats(statsData);
        setQueue(queueData.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eggshell">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eggshell">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-gray-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-eggshell">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dermatologist Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          </div>
          <Link
            href="/review-queue"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Open Queue
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<ClipboardList className="w-5 h-5 text-teal-600" />}
            label="Assigned This Month"
            value={stats?.total_assigned_this_month ?? 0}
            sub="cases"
            accent="bg-teal-50"
            delay={0}
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-cream-700" />}
            label="Pending Review"
            value={stats?.pending_review ?? 0}
            sub="awaiting action"
            accent="bg-cream-50"
            delay={0.05}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />}
            label="Approved Today"
            value={stats?.approved_today ?? 0}
            sub="cases"
            accent="bg-teal-50"
            delay={0.1}
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5 text-skin-600" />}
            label="Avg Review Time"
            value={
              stats?.avg_review_time_minutes != null
                ? `${stats.avg_review_time_minutes} min`
                : "—"
            }
            sub="per case"
            accent="bg-skin-50"
            delay={0.15}
          />
        </div>

        {/* Priority queue preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Priority Cases
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Top 5 by priority — needs your review</p>
            </div>
            <Link
              href="/review-queue"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {queue.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-teal-400 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">All caught up!</p>
              <p className="text-sm text-gray-400 mt-1">No pending cases right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {queue.map((item, i) => (
                <Link
                  key={item.queue_id}
                  href={`/case/${item.recommendation_id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-teal-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {item.patient_id}
                      </span>
                      {item.age_group && (
                        <span className="text-xs text-gray-400">{item.age_group}</span>
                      )}
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.skin_type && (
                        <span className="text-xs text-gray-500 capitalize">
                          {item.skin_type} skin
                        </span>
                      )}
                      {item.top_conditions.length > 0 && (
                        <>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-500">
                            {item.top_conditions.slice(0, 3).join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Date + arrow */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {new Date(item.submission_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors ml-auto mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Link
            href="/review-queue?status=pending"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-teal-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cream-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cream-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-teal-700">
                  Pending Cases
                </p>
                <p className="text-xs text-gray-400">
                  {stats?.pending_review ?? 0} awaiting review
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 ml-auto" />
            </div>
          </Link>

          <Link
            href="/review-queue?priority=high"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-red-300 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-red-700">
                  High Priority
                </p>
                <p className="text-xs text-gray-400">
                  Diagnosed conditions or low confidence
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 ml-auto" />
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
