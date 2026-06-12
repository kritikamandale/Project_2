"use client";

import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import {
  dermApi,
  QueueFilters,
  ReviewQueueItem,
  ReviewQueueResponse,
} from "@/lib/api/dermatologist";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"];
const STATUSES = ["pending", "in_review", "approved", "rejected", "escalated"];
const PRIORITIES = ["high", "normal", "low"];

function PriorityBadge({ p }: { p: string }) {
  const cls: Record<string, string> = {
    high: "bg-red-100 text-red-700 border border-red-200",
    normal: "bg-blue-100 text-blue-700 border border-blue-200",
    low: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls[p] ?? cls.normal}`}>
      {p}
    </span>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    in_review: "bg-purple-100 text-purple-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    escalated: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls[s] ?? "bg-gray-100 text-gray-600"}`}>
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
  if (sort.key !== colKey) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />;
  return sort.dir === "asc"
    ? <ArrowUp className="w-3.5 h-3.5 text-teal-600" />
    : <ArrowDown className="w-3.5 h-3.5 text-teal-600" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReviewQueuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters — initialised from URL search params
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review Queue</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {data ? `${data.total} cases` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                showFilters || hasFilters
                  ? "bg-teal-50 border-teal-300 text-teal-700"
                  : "bg-white border-gray-200 text-gray-600 hover:border-teal-300"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasFilters && (
                <span className="bg-teal-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  !
                </span>
              )}
            </button>
            <button
              onClick={fetchQueue}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-teal-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link
              href="/derm-dashboard"
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-white border-b border-gray-100"
          >
            <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-teal-400"
                >
                  <option value="">All</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>

              {/* Skin type */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Skin Type</label>
                <select
                  value={skinTypeFilter}
                  onChange={(e) => { setSkinTypeFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-teal-400"
                >
                  <option value="">All</option>
                  {SKIN_TYPES.map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-teal-400"
                >
                  <option value="">All</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Clear */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  disabled={!hasFilters}
                  className="w-full text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex gap-3 items-center">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1fr_1fr] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <span>Patient</span>
              <button
                className="flex items-center gap-1 hover:text-gray-700"
                onClick={() => handleSort("submission_date")}
              >
                Submitted <SortIcon colKey="submission_date" sort={sort} />
              </button>
              <span>Conditions</span>
              <button
                className="flex items-center gap-1 hover:text-gray-700"
                onClick={() => handleSort("priority")}
              >
                Priority <SortIcon colKey="priority" sort={sort} />
              </button>
              <button
                className="flex items-center gap-1 hover:text-gray-700"
                onClick={() => handleSort("status")}
              >
                Status <SortIcon colKey="status" sort={sort} />
              </button>
              <span>Action</span>
            </div>

            {/* Rows */}
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-6 h-6 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading cases…</p>
              </div>
            ) : !data?.items.length ? (
              <div className="py-20 text-center">
                <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">No cases found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.items.map((item: ReviewQueueItem) => (
                  <motion.div
                    key={item.queue_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
                  >
                    {/* Patient */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-teal-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.patient_id}
                        </p>
                        <p className="text-xs text-gray-400">
                          {[item.age_group, item.skin_type && `${item.skin_type} skin`]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>

                    {/* Submitted */}
                    <span className="text-sm text-gray-500">
                      {new Date(item.submission_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>

                    {/* Conditions */}
                    <div className="flex flex-wrap gap-1">
                      {item.top_conditions.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        item.top_conditions.map((c) => (
                          <span
                            key={c}
                            className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md capitalize"
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
                      className="inline-flex items-center justify-center text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 px-3 py-1.5 rounded-lg transition-colors"
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
              <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Page {data.page} of {data.total_pages} · {data.total} cases
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-teal-300 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                    const pg = i + 1;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          pg === page
                            ? "bg-teal-600 text-white"
                            : "border border-gray-200 text-gray-600 hover:border-teal-300"
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    disabled={page >= data.total_pages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-teal-300 disabled:opacity-40 transition-colors"
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
