"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldX,
  UserX,
  UserCheck,
  Trash2,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  adminApi,
  type AdminUserListItem,
  type DermVerificationItem,
  type UserRole,
  type UserStatusAction,
} from "@/lib/api/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, string> = {
    ADMIN: "bg-red-100 text-red-700",
    DERMATOLOGIST: "bg-violet-100 text-violet-700",
    USER: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[role]}`}>
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ active, verified }: { active: boolean; verified: boolean }) {
  if (!active)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Suspended</span>;
  if (!verified)
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Unverified</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>;
}

// ---------------------------------------------------------------------------
// Action dropdown
// ---------------------------------------------------------------------------

function UserActionMenu({
  user,
  onAction,
}: {
  user: AdminUserListItem;
  onAction: (uid: string, action: string, extra?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isSelf = false; // resolved via session in a real app

  const actions: { label: string; icon: React.ReactNode; value: string; danger?: boolean }[] = [
    ...(user.is_active
      ? [{ label: "Suspend", icon: <UserX size={13} />, value: "suspend", danger: true }]
      : [{ label: "Activate", icon: <UserCheck size={13} />, value: "activate" }]),
    { label: "Delete (GDPR)", icon: <Trash2 size={13} />, value: "delete", danger: true },
    { label: "Make Admin", icon: <ShieldCheck size={13} />, value: "role:ADMIN" },
    { label: "Make Derm", icon: <ShieldCheck size={13} />, value: "role:DERMATOLOGIST" },
    { label: "Make User", icon: <ShieldCheck size={13} />, value: "role:USER" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        Actions <ChevronDown size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-9 z-20 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1"
            >
              {actions.map((a) => (
                <button
                  key={a.value}
                  onClick={() => {
                    setOpen(false);
                    onAction(user.id, a.value);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${
                    a.danger ? "text-red-600" : "text-slate-700"
                  }`}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derm Verification Queue
// ---------------------------------------------------------------------------

function DermQueue() {
  const [items, setItems] = useState<DermVerificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getDermVerificationQueue()
      .then(setItems)
      .catch(() => toast.error("Failed to load verification queue"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handle = async (userId: string, action: "approve" | "reject", reason?: string) => {
    try {
      await adminApi.verifyDermatologist(userId, action, reason);
      toast.success(`Dermatologist ${action === "approve" ? "approved" : "rejected"}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm text-center py-6">Loading queue…</p>;
  if (!items.length)
    return (
      <div className="text-center py-8 text-slate-400">
        <CheckCircle2 size={28} className="mx-auto mb-2" />
        <p className="text-sm">No pending verifications</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.user_id}
          className="flex items-start justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 text-sm">{item.full_name}</p>
            <p className="text-xs text-slate-500">{item.email}</p>
            <p className="text-xs text-slate-600 mt-1">
              License: <span className="font-mono">{item.medical_license_number}</span>
              {item.hospital_affiliation && ` · ${item.hospital_affiliation}`}
            </p>
            {item.specialization && (
              <p className="text-xs text-slate-500">{item.specialization}</p>
            )}
            {item.verification_document_url && (
              <a
                href={item.verification_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 underline mt-0.5 inline-block"
              >
                View document
              </a>
            )}
          </div>
          <div className="flex gap-2 ml-4 shrink-0">
            <button
              onClick={() => handle(item.user_id, "approve")}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 size={12} /> Approve
            </button>
            <button
              onClick={() => {
                const reason = window.prompt("Rejection reason (optional):");
                handle(item.user_id, "reject", reason || undefined);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <XCircle size={12} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"users" | "verification">("users");

  const PAGE_SIZE = 20;

  const loadUsers = useCallback(() => {
    setLoading(true);
    adminApi
      .getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
        page,
        page_size: PAGE_SIZE,
      })
      .then((data) => {
        setUsers(data.items);
        setTotal(data.total);
        setTotalPages(data.total_pages);
      })
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAction = async (userId: string, action: string) => {
    try {
      if (action.startsWith("role:")) {
        const role = action.replace("role:", "") as UserRole;
        await adminApi.changeUserRole(userId, role);
        toast.success(`Role changed to ${role}`);
      } else {
        await adminApi.changeUserStatus(userId, action as UserStatusAction);
        toast.success(`User ${action}d`);
      }
      loadUsers();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 text-sm mt-1">
          {total.toLocaleString()} total users
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-8">
        <div className="flex gap-0">
          {(["users", "verification"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "users" ? "All Users" : "Derm Verification Queue"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 max-w-screen-2xl mx-auto">

        {activeTab === "verification" ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Pending Dermatologist Approvals
            </h2>
            <DermQueue />
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-5">
              <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 min-w-56">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or email…"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Search
                </button>
              </form>

              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">All Roles</option>
                <option value="USER">User</option>
                <option value="DERMATOLOGIST">Dermatologist</option>
                <option value="ADMIN">Admin</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>

              <button
                onClick={loadUsers}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className="text-slate-500" />
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        User
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        Role
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        Scans
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        City
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        Last Login
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        2FA
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 bg-slate-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                          <AlertTriangle size={24} className="mx-auto mb-2" />
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{user.full_name}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge active={user.is_active} verified={user.is_verified} />
                          </td>
                          <td className="px-4 py-3 text-slate-600">{user.scan_count}</td>
                          <td className="px-4 py-3 text-slate-500">{user.city ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {user.last_login
                              ? new Date(user.last_login).toLocaleDateString("en-IN")
                              : "Never"}
                          </td>
                          <td className="px-4 py-3">
                            {user.totp_enabled ? (
                              <ShieldCheck size={14} className="text-emerald-500" />
                            ) : (
                              <ShieldX size={14} className="text-slate-300" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <UserActionMenu user={user} onAction={handleAction} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Page {page} of {totalPages} · {total.toLocaleString()} users
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronLeft size={14} className="text-slate-600" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronRight size={14} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
