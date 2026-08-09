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
  Stethoscope,
} from "lucide-react";
import { dermApi, DermStatsResponse, ReviewQueueItem } from "@/lib/api/dermatologist";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  delay: number;
}

function StatCard({ icon, label, value, sub, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-cream border border-deep-brown/15 rounded-xl shadow-sm p-5 flex gap-4 items-start font-sans text-deep-brown"
    >
      <div className="p-2.5 rounded-lg bg-olive/10 text-olive border border-deep-brown/10 shrink-0">{icon}</div>
      <div>
        <p className="font-sans text-xs font-bold uppercase tracking-widest text-olive">{label}</p>
        <p className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown leading-none mt-1">{value}</p>
        {sub && <p className="font-sans text-xs text-deep-brown/60 mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-deep-brown/15 text-deep-brown border border-deep-brown/20",
    normal: "bg-olive/10 text-olive border border-deep-brown/10",
    low: "bg-cream text-deep-brown/60 border border-deep-brown/10",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-wider ${map[priority] ?? map.normal}`}
    >
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-butter/40 text-deep-brown border border-deep-brown/10 font-bold",
    in_review: "bg-cream text-deep-brown border border-deep-brown/10",
    approved: "bg-olive/15 text-olive border border-deep-brown/10 font-bold",
    rejected: "bg-deep-brown/10 text-deep-brown border border-deep-brown/15",
    escalated: "bg-deep-brown/15 text-deep-brown border border-deep-brown/20 font-bold",
  };
  const label = status.replace("_", " ");
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full font-sans text-[10px] font-bold uppercase tracking-wider ${map[status] ?? "bg-cream text-deep-brown"}`}
    >
      {label}
    </span>
  );
}

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
      <div className="min-h-screen flex items-center justify-center bg-cream text-deep-brown font-sans text-xs font-bold uppercase tracking-widest">
        Loading Clinical Dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream text-deep-brown p-6 font-sans">
        <div className="text-center bg-cream border border-deep-brown/15 rounded-xl p-8 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-olive mx-auto mb-2" />
          <p className="text-deep-brown font-bold text-sm">{error}</p>
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
    <div className="min-h-screen bg-cream text-deep-brown font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-deep-brown/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-olive/10 text-olive rounded-full px-3 py-1 text-xs font-sans font-bold uppercase tracking-widest mb-2 border border-deep-brown/10">
              <Stethoscope className="w-3.5 h-3.5" /> Clinical Portal
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown">Dermatologist Dashboard</h1>
            <p className="font-sans text-xs text-deep-brown/70 mt-1">{today}</p>
          </div>
          <Link
            href="/review-queue"
            className="bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold text-xs px-5 py-3 rounded-xl border border-deep-brown/10 shadow-sm inline-flex items-center gap-2 uppercase tracking-wider self-start sm:self-auto"
          >
            <ClipboardList className="w-4 h-4 text-olive" />
            Open Review Queue →
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<ClipboardList className="w-5 h-5 text-olive" />}
            label="Assigned This Month"
            value={stats?.total_assigned_this_month ?? 0}
            sub="cases assigned"
            delay={0}
          />
          <StatCard
            icon={<Clock className="w-5 h-5 text-olive" />}
            label="Pending Review"
            value={stats?.pending_review ?? 0}
            sub="awaiting action"
            delay={0.05}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-olive" />}
            label="Approved Today"
            value={stats?.approved_today ?? 0}
            sub="cases completed"
            delay={0.1}
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5 text-olive" />}
            label="Avg Review Time"
            value={
              stats?.avg_review_time_minutes != null
                ? `${stats.avg_review_time_minutes}m`
                : "—"
            }
            sub="per case"
            delay={0.15}
          />
        </div>

        {/* Priority Queue Table Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-cream rounded-xl border border-deep-brown/15 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-deep-brown/10 flex items-center justify-between">
            <div>
              <h2 className="font-serif font-bold text-deep-brown text-xl">
                Priority Cases
              </h2>
              <p className="text-xs text-deep-brown/70 mt-0.5">Top 5 by priority — awaiting clinical review</p>
            </div>
            <Link
              href="/review-queue"
              className="text-xs font-bold text-olive hover:underline flex items-center gap-1 uppercase tracking-wider"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {queue.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-olive mx-auto mb-2" />
              <p className="text-deep-brown font-bold text-sm">All caught up!</p>
              <p className="text-xs text-deep-brown/60 mt-1">No pending cases right now.</p>
            </div>
          ) : (
            <div className="divide-y divide-deep-brown/10">
              {queue.map((item) => (
                <Link
                  key={item.queue_id}
                  href={`/case/${item.recommendation_id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-nude/20 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-olive/10 text-olive border border-deep-brown/10 flex items-center justify-center shrink-0 font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-deep-brown font-sans">
                        {item.patient_id}
                      </span>
                      {item.age_group && (
                        <span className="text-xs text-deep-brown/60">{item.age_group}</span>
                      )}
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-deep-brown/70">
                      {item.skin_type && (
                        <span className="capitalize">{item.skin_type} skin</span>
                      )}
                      {item.top_conditions.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{item.top_conditions.slice(0, 3).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-deep-brown/60">
                      {new Date(item.submission_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    <ArrowRight className="w-4 h-4 text-olive group-hover:translate-x-1 transition-transform ml-auto mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/review-queue?status=pending"
            className="bg-cream rounded-xl border border-deep-brown/15 shadow-sm p-5 hover:border-olive transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-olive/10 text-olive flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-deep-brown group-hover:text-olive">
                  Pending Cases
                </p>
                <p className="text-xs text-deep-brown/60 mt-0.5">
                  {stats?.pending_review ?? 0} awaiting review
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-olive ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/review-queue?priority=high"
            className="bg-cream rounded-xl border border-deep-brown/15 shadow-sm p-5 hover:border-olive transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-butter/40 text-deep-brown border border-deep-brown/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-olive" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-deep-brown group-hover:text-olive">
                  High Priority
                </p>
                <p className="text-xs text-deep-brown/60 mt-0.5">
                  Severe conditions or low confidence
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-olive ml-auto group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
