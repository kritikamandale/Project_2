"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  RefreshCw,
  AlertTriangle,
  Stethoscope,
} from "lucide-react";
import {
  dermApi,
  QueueFilters,
  ReviewQueueItem,
  ReviewQueueResponse,
} from "@/lib/api/dermatologist";

const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"];
const STATUSES = ["pending", "in_review", "approved", "rejected", "escalated"];
const PRIORITIES = ["high", "normal", "low"];

function PriorityBadge({ p }: { p: string }) {
  const cls: Record<string, string> = {
    high: "bg-deep-brown/15 text-deep-brown border border-deep-brown/20 font-bold",
    normal: "bg-olive/10 text-olive border border-deep-brown/10 font-bold",
    low: "bg-cream text-deep-brown/60 border border-deep-brown/10",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-sans font-bold capitalize tracking-wider ${cls[p] ?? cls.normal}`}>
      {p}
    </span>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls: Record<string, string> = {
    pending: "bg-butter/40 text-deep-brown border border-deep-brown/10 font-bold",
    in_review: "bg-cream text-deep-brown border border-deep-brown/10 font-medium",
    approved: "bg-olive/15 text-olive border border-deep-brown/10 font-bold",
    rejected: "bg-deep-brown/10 text-deep-brown border border-deep-brown/15",
    escalated: "bg-deep-brown/15 text-deep-brown border border-deep-brown/20 font-bold",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-sans uppercase tracking-wider ${cls[s] ?? "bg-cream text-deep-brown"}`}>
      {s.replace("_", " ")}
    </span>
  );
}

type SortKey = "submission_date" | "priority" | "status";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

function SortIcon({ colKey, sort }: { colKey: SortKey; sort: SortState }) {
  if (sort.key !== colKey) return <ArrowUpDown className="w-3.5 h-3.5 text-deep-brown/40" />;
  return sort.dir === "asc"
    ? <ArrowUp className="w-3.5 h-3.5 text-olive" />
    : <ArrowDown className="w-3.5 h-3.5 text-olive" />;
}

function ReviewQueuePageInner() {
  const searchParams = useSearchParams();

  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [skinTypeFilter, setSkinTypeFilter] = useState(searchParams.get("skin_type") ?? "");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") ?? "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [sort, setSort] = useState<SortState>({ key: "submission_date", dir: "asc" });
  const [showFilters, setShowFilters] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: QueueFilters = {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        skin_type: skinTypeFilter || undefined,
        priority: priorityFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sort.key,
        sort_dir: sort.dir,
      };
      const res = await dermApi.getQueue(filters);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, skinTypeFilter, priorityFilter, dateFrom, dateTo, sort]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1);
  }

  function clearFilters() {
    setStatusFilter("");
    setSkinTypeFilter("");
    setPriorityFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const hasFilters = !!(statusFilter || skinTypeFilter || priorityFilter || dateFrom || dateTo);

  return (
    <div className="min-h-screen bg-cream text-deep-brown font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-deep-brown/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-olive/10 text-olive rounded-full px-3 py-1 text-xs font-sans font-bold uppercase tracking-widest mb-2 border border-deep-brown/10">
              <Stethoscope className="w-3.5 h-3.5" /> Clinical Queue
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown">Review Queue</h1>
            <p className="text-xs font-sans text-deep-brown/70 mt-0.5">
              {data ? `${data.total} cases registered` : "Loading cases…"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border transition-colors ${
                showFilters || hasFilters
                  ? "bg-butter text-deep-brown border-deep-brown/15 shadow-sm"
                  : "bg-cream border-deep-brown/15 text-deep-brown hover:bg-nude/20"
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-olive" />
              Filters
            </button>
            <button
              onClick={fetchQueue}
              disabled={loading}
              className="inline-flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl border border-deep-brown/15 bg-cream text-deep-brown hover:bg-nude/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-olive ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/derm-dashboard"
              className="text-xs font-sans font-bold text-olive hover:underline px-3 py-2 uppercase tracking-wider"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-cream border border-deep-brown/15 rounded-xl p-4 shadow-sm"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs font-bold text-olive uppercase tracking-widest mb-1 block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="w-full text-xs font-sans border border-deep-brown/15 rounded-xl px-2.5 py-2 bg-cream text-deep-brown focus:outline-none focus:border-olive"
                  >
                    <option value="">All</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-olive uppercase tracking-widest mb-1 block">Skin Type</label>
                  <select
                    value={skinTypeFilter}
                    onChange={(e) => { setSkinTypeFilter(e.target.value); setPage(1); }}
                    className="w-full text-xs font-sans border border-deep-brown/15 rounded-xl px-2.5 py-2 bg-cream text-deep-brown focus:outline-none focus:border-olive"
                  >
                    <option value="">All</option>
                    {SKIN_TYPES.map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-olive uppercase tracking-widest mb-1 block">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                    className="w-full text-xs font-sans border border-deep-brown/15 rounded-xl px-2.5 py-2 bg-cream text-deep-brown focus:outline-none focus:border-olive"
                  >
                    <option value="">All</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-olive uppercase tracking-widest mb-1 block">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full text-xs font-sans border border-deep-brown/15 rounded-xl px-2.5 py-2 bg-cream text-deep-brown focus:outline-none focus:border-olive"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-olive uppercase tracking-widest mb-1 block">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full text-xs font-sans border border-deep-brown/15 rounded-xl px-2.5 py-2 bg-cream text-deep-brown focus:outline-none focus:border-olive"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    disabled={!hasFilters}
                    className="w-full text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl border border-deep-brown/15 text-deep-brown hover:bg-nude/20 transition-colors disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Queue Table Card */}
        {error ? (
          <div className="bg-cream border border-deep-brown/15 rounded-xl p-6 flex gap-3 items-center text-xs text-deep-brown">
            <AlertTriangle className="w-5 h-5 text-olive shrink-0" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="bg-cream border border-deep-brown/15 rounded-xl shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1fr_1fr] gap-4 px-6 py-3 bg-nude/20 border-b border-deep-brown/10 text-xs font-sans font-bold uppercase tracking-widest text-deep-brown/70">
              <span>Patient</span>
              <button
                className="flex items-center gap-1 hover:text-deep-brown text-left"
                onClick={() => handleSort("submission_date")}
              >
                Submitted <SortIcon colKey="submission_date" sort={sort} />
              </button>
              <span>Conditions</span>
              <button
                className="flex items-center gap-1 hover:text-deep-brown text-left"
                onClick={() => handleSort("priority")}
              >
                Priority <SortIcon colKey="priority" sort={sort} />
              </button>
              <button
                className="flex items-center gap-1 hover:text-deep-brown text-left"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon colKey="status" sort={sort} />
              </button>
              <span>Action</span>
            </div>

            {/* Table Rows */}
            {loading ? (
              <div className="py-20 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-olive animate-pulse">Loading cases…</p>
              </div>
            ) : !data?.items.length ? (
              <div className="py-20 text-center">
                <Search className="w-8 h-8 text-olive/40 mx-auto mb-2" />
                <p className="font-serif font-bold text-deep-brown text-lg">No cases found</p>
                <p className="text-xs text-deep-brown/60 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="divide-y divide-deep-brown/10">
                {data.items.map((item: ReviewQueueItem) => (
                  <motion.div
                    key={item.queue_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-nude/10 transition-colors"
                  >
                    {/* Patient */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-olive/10 text-olive border border-deep-brown/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-deep-brown truncate">
                          {item.patient_id}
                        </p>
                        <p className="text-[11px] text-deep-brown/60">
                          {[item.age_group, item.skin_type && `${item.skin_type} skin`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    {/* Submitted */}
                    <span className="text-xs text-deep-brown/70 font-sans">
                      {new Date(item.submission_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>

                    {/* Conditions */}
                    <div className="flex flex-wrap gap-1">
                      {item.top_conditions.length === 0 ? (
                        <span className="text-xs text-deep-brown/50">—</span>
                      ) : (
                        item.top_conditions.map((c) => (
                          <span
                            key={c}
                            className="text-[11px] bg-cream border border-deep-brown/10 text-deep-brown px-2 py-0.5 rounded-full capitalize"
                          >
                            {c.replace("_", " ")}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Priority */}
                    <PriorityBadge p={item.priority} />

                    {/* Status */}
                    <StatusBadge s={item.status} />

                    {/* Action */}
                    <Link
                      href={`/case/${item.recommendation_id}`}
                      className="inline-flex items-center justify-center text-xs font-sans font-bold uppercase tracking-wider text-deep-brown bg-butter hover:bg-butter/90 border border-deep-brown/10 shadow-xs px-3.5 py-1.5 rounded-xl transition-colors"
                    >
                      {item.status === "pending" || item.status === "in_review"
                        ? "Review"
                        : "View"}
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data && data.total_pages > 1 && (
              <div className="px-6 py-4 border-t border-deep-brown/10 flex items-center justify-between font-sans">
                <p className="text-xs text-deep-brown/60">
                  Page {data.page} of {data.total_pages} · {data.total} cases total
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-xl border border-deep-brown/15 bg-cream text-deep-brown hover:bg-nude/20 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                    const pg = i + 1;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-7 h-7 rounded-xl text-xs font-bold transition-colors ${
                          pg === page
                            ? "bg-butter text-deep-brown border border-deep-brown/10"
                            : "border border-deep-brown/15 text-deep-brown hover:bg-nude/20"
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    disabled={page >= data.total_pages}
                    className="p-1.5 rounded-xl border border-deep-brown/15 bg-cream text-deep-brown hover:bg-nude/20 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  return (
    <Suspense fallback={null}>
      <ReviewQueuePageInner />
    </Suspense>
  );
}
