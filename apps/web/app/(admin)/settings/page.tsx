"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Save,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Smartphone,
} from "lucide-react";
import {
  adminApi,
  type AuditLogItem,
  type FeatureFlagsUpdate,
  type TOTPSetupResponse,
} from "@/lib/api/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-1 ${
          checked ? "bg-indigo-600" : "bg-slate-200"
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Flags Panel
// ---------------------------------------------------------------------------

function FeatureFlagsPanel({ settings, onSave }: { settings: Record<string, unknown>; onSave: (v: FeatureFlagsUpdate) => Promise<void> }) {
  const [flags, setFlags] = useState<FeatureFlagsUpdate>({
    enable_camera_scan: Boolean(settings.enable_camera_scan ?? true),
    enable_auto_climate_fetch: Boolean(settings.enable_auto_climate_fetch ?? true),
    enable_dermatologist_review: Boolean(settings.enable_dermatologist_review ?? true),
    maintenance_mode: Boolean(settings.maintenance_mode ?? false),
    derm_review_confidence_threshold: Number(settings.derm_review_confidence_threshold ?? 0.75),
    recommendation_engine_version: (settings.recommendation_engine_version as "v1" | "v2") ?? "v1",
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FeatureFlagsUpdate>(k: K, v: FeatureFlagsUpdate[K]) =>
    setFlags((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(flags);
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Feature Flags</h2>
      <p className="text-sm text-slate-500 mb-4">Toggle platform features without redeploying.</p>

      <div className="divide-y divide-slate-50">
        <Toggle
          checked={flags.enable_camera_scan!}
          onChange={(v) => set("enable_camera_scan", v)}
          label="Camera Scan"
          description="Allow users to perform in-browser skin scans via webcam"
        />
        <Toggle
          checked={flags.enable_auto_climate_fetch!}
          onChange={(v) => set("enable_auto_climate_fetch", v)}
          label="Automatic Climate Fetch"
          description="Auto-fetch climate data from Open-Meteo when city is selected"
        />
        <Toggle
          checked={flags.enable_dermatologist_review!}
          onChange={(v) => set("enable_dermatologist_review", v)}
          label="Dermatologist Review"
          description="Send low-confidence recommendations to the dermatologist review queue"
        />
        <Toggle
          checked={flags.maintenance_mode!}
          onChange={(v) => set("maintenance_mode", v)}
          label="Maintenance Mode"
          description="Show maintenance banner to all users — admin access unaffected"
        />
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Derm Review Confidence Threshold
            <span className="text-slate-400 font-normal ml-1">
              (current: {((flags.derm_review_confidence_threshold ?? 0.75) * 100).toFixed(0)}%)
            </span>
          </label>
          <input
            type="range"
            min={0.5}
            max={0.99}
            step={0.01}
            value={flags.derm_review_confidence_threshold ?? 0.75}
            onChange={(e) => set("derm_review_confidence_threshold", parseFloat(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>50%</span>
            <span>99%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Recommendation Engine Version
          </label>
          <div className="flex gap-3">
            {(["v1", "v2"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => set("recommendation_engine_version", v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  flags.recommendation_engine_version === v
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        <Save size={14} />
        {saving ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TOTP Management Panel
// ---------------------------------------------------------------------------

function TOTPPanel() {
  const [step, setStep] = useState<"idle" | "setup" | "enabling" | "enabled">("idle");
  const [setupData, setSetupData] = useState<TOTPSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const data = await adminApi.setupTotp();
      setSetupData(data);
      setStep("setup");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) { toast.error("Enter a 6-digit code"); return; }
    setLoading(true);
    try {
      await adminApi.verifyTotp(code);
      setStep("enabled");
      toast.success("Two-factor authentication enabled!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!code || code.length < 6) { toast.error("Enter current 6-digit code to disable"); return; }
    setLoading(true);
    try {
      await adminApi.disableTotp(code);
      setStep("idle");
      setSetupData(null);
      setCode("");
      toast.success("Two-factor authentication disabled");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={18} className="text-indigo-600" />
        <h2 className="text-base font-semibold text-slate-800">Two-Factor Authentication (TOTP)</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Protect your admin account with a time-based one-time password (Google Authenticator, Authy, etc.)
      </p>

      {step === "idle" && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <XCircle size={16} className="text-slate-300" />
            2FA is not enabled
          </div>
          <button
            onClick={handleSetup}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            <Smartphone size={14} />
            {loading ? "Loading…" : "Set up 2FA"}
          </button>
        </div>
      )}

      {step === "setup" && setupData && (
        <div className="space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <QrCode size={16} className="text-indigo-500" />
              Scan this URI in your authenticator app
            </p>
            <code className="block text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 break-all text-slate-600">
              {setupData.otpauth_uri}
            </code>
            <p className="text-xs text-slate-500">
              Or enter secret manually:{" "}
              <code className="font-mono font-semibold text-slate-700">{setupData.secret}</code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Enter code from your app to confirm
            </label>
            <div className="flex gap-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-40 px-3 py-2 text-center text-lg font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 tracking-widest"
              />
              <button
                onClick={handleVerify}
                disabled={loading || code.length < 6}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {loading ? "Verifying…" : "Enable 2FA"}
              </button>
              <button
                onClick={() => { setStep("idle"); setSetupData(null); setCode(""); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "enabled" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl">
            <CheckCircle2 size={16} />
            2FA is active — TOTP code required for sensitive admin actions
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Enter current code to disable
            </label>
            <div className="flex gap-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-40 px-3 py-2 text-center text-lg font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 tracking-widest"
              />
              <button
                onClick={handleDisable}
                disabled={loading || code.length < 6}
                className="px-5 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-60 transition-colors"
              >
                {loading ? "Disabling…" : "Disable 2FA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit Log Viewer
// ---------------------------------------------------------------------------

function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .getAuditLogs({
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        page,
        page_size: 50,
      })
      .then((data) => { setLogs(data.items); setTotal(data.total); setTotalPages(data.total_pages); })
      .catch(() => toast.error("Failed to load audit logs"))
      .finally(() => setLoading(false));
  }, [actionFilter, entityFilter, page]);

  useEffect(() => { load(); }, [load]);

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("suspend") || action.includes("reject"))
      return "bg-red-100 text-red-700";
    if (action.includes("create") || action.includes("approve") || action.includes("verify"))
      return "bg-emerald-100 text-emerald-700";
    if (action.includes("update") || action.includes("change") || action.includes("role"))
      return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Audit Log</h2>
      <p className="text-sm text-slate-500 mb-4">All admin actions — {total.toLocaleString()} entries</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            placeholder="Filter by action…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white"
        >
          <option value="">All Entities</option>
          <option value="user">user</option>
          <option value="product">product</option>
          <option value="platform_settings">settings</option>
        </select>
        <button onClick={load} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw size={13} className="text-slate-500" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {["Timestamp", "Admin", "Action", "Entity", "IP", "Details"].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-3 py-2"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  <AlertTriangle size={20} className="mx-auto mb-1.5" />No logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono">
                    {new Date(log.timestamp).toLocaleString("en-IN", { hour12: false }).replace(",", "")}
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-32 truncate" title={log.user_email ?? undefined}>
                    {log.user_email ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${actionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{log.entity_type}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono">{log.ip_address ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400 max-w-48 truncate" title={JSON.stringify(log.metadata)}>
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
              <ChevronLeft size={12} className="text-slate-600" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
              <ChevronRight size={12} className="text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bias Report Panel
// ---------------------------------------------------------------------------

function BiasReportPanel() {
  const [report, setReport] = useState<Awaited<ReturnType<typeof adminApi.getBiasReport>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getBiasReport()
      .then(setReport)
      .catch(() => toast.error("Failed to load bias report"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Fitzpatrick Bias Report</h2>
      <p className="text-sm text-slate-500 mb-4">AI confidence by skin tone — identifies model bias.</p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !report || report.items.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-4">No data available yet</p>
      ) : (
        <>
          {report.tones_below_threshold.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Tones below confidence threshold:{" "}
                <strong>{report.tones_below_threshold.join(", ")}</strong>
                {" "}— consider collecting more training data for these groups.
              </p>
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Tone", "Users", "Avg Confidence", "Recommendations", "Avg Score"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.fitzpatrick_tone} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-semibold text-slate-700">Tone {item.fitzpatrick_tone}</td>
                  <td className="py-2 pr-4 text-slate-600">{item.user_count}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.avg_confidence >= 0.75 ? "bg-emerald-500" :
                            item.avg_confidence >= 0.65 ? "bg-amber-400" : "bg-red-400"
                          }`}
                          style={{ width: `${item.avg_confidence * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        item.avg_confidence >= 0.75 ? "text-emerald-700" :
                        item.avg_confidence >= 0.65 ? "text-amber-700" : "text-red-600"
                      }`}>
                        {(item.avg_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{item.recommendation_count}</td>
                  <td className="py-2 text-slate-600">{item.avg_skin_score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-slate-400 mt-3">
            Overall avg confidence: <strong>{(report.overall_avg_confidence * 100).toFixed(1)}%</strong>
            {" · "}Generated {new Date(report.generated_at).toLocaleString("en-IN")}
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IP Allowlist Panel
// ---------------------------------------------------------------------------

function IPAllowlistPanel({ settings, onSave }: { settings: Record<string, unknown>; onSave: (v: Record<string, unknown>) => Promise<void> }) {
  const current: string[] = Array.isArray(settings.admin_ip_allowlist)
    ? settings.admin_ip_allowlist as string[]
    : ["*"];
  const [input, setInput] = useState(current.join(", "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const ips = input.split(",").map((s) => s.trim()).filter(Boolean);
    if (ips.length === 0) { toast.error("Enter at least one IP or * for all"); return; }
    setSaving(true);
    try {
      await onSave({ admin_ip_allowlist: ips });
      toast.success("IP allowlist updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-slate-800 mb-1">Admin IP Allowlist</h2>
      <p className="text-sm text-slate-500 mb-4">
        Comma-separated list of allowed IP addresses. Use <code className="bg-slate-100 px-1 rounded">*</code> to allow all.
      </p>
      <div className="flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="192.168.1.1, 10.0.0.0/24, *"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Save size={13} />
          {saving ? "Saving…" : "Update"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type Tab = "flags" | "security" | "audit" | "bias";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("flags");
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    adminApi.getSettings()
      .then(setSettings)
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleFlagSave = async (flags: FeatureFlagsUpdate) => {
    const updated = await adminApi.updateSettings(flags);
    setSettings(updated);
  };

  const handleRawSave = async (data: Record<string, unknown>) => {
    const updated = await adminApi.updateSettings(data as FeatureFlagsUpdate);
    setSettings(updated);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "flags", label: "Feature Flags" },
    { id: "security", label: "Security & 2FA" },
    { id: "audit", label: "Audit Log" },
    { id: "bias", label: "Bias Report" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure feature flags, security, and monitor platform health</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-8">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl mx-auto space-y-6">
        {loadingSettings ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "flags" && (
              <FeatureFlagsPanel settings={settings} onSave={handleFlagSave} />
            )}

            {activeTab === "security" && (
              <div className="space-y-6">
                <TOTPPanel />
                <IPAllowlistPanel settings={settings} onSave={handleRawSave} />
              </div>
            )}

            {activeTab === "audit" && <AuditLogViewer />}

            {activeTab === "bias" && <BiasReportPanel />}
          </motion.div>
        )}
      </div>
    </div>
  );
}
