"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Info,
  Shield,
  Droplets,
  Moon,
  Zap,
  ThumbsUp,
  Send,
} from "lucide-react";
import {
  dermApi,
  CaseDetailResponse,
  ProductForReview,
  ProductActionRequest,
  ReviewSubmitRequest,
} from "@/lib/api/dermatologist";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SeverityBar({ severity }: { severity: string }) {
  const map: Record<string, { w: string; color: string }> = {
    none: { w: "w-0", color: "bg-deep-brown/20" },
    mild: { w: "w-1/4", color: "bg-olive/60" },
    moderate: { w: "w-2/4", color: "bg-olive" },
    severe: { w: "w-full", color: "bg-deep-brown" },
  };
  const { w, color } = map[severity] ?? map.mild;
  return (
    <div className="w-16 h-1.5 bg-nude/30 rounded-full overflow-hidden border border-deep-brown/10">
      <div className={`h-full rounded-full ${w} ${color}`} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-700 text-right capitalize">
        {String(value).replace(/_/g, " ")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product action state
// ---------------------------------------------------------------------------

type ActionType = "approve" | "modify" | "remove" | null;

interface ProductState {
  action: ActionType;
  note: string;
  showNote: boolean;
}

// ---------------------------------------------------------------------------
// Product review card
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: ProductForReview;
  state: ProductState;
  onAction: (action: ActionType) => void;
  onNoteChange: (note: string) => void;
  onToggleNote: () => void;
  readonly: boolean;
}

function ProductCard({
  product,
  state,
  onAction,
  onNoteChange,
  onToggleNote,
  readonly,
}: ProductCardProps) {
  const phaseColors = [
    "",
    "bg-teal-50 border-teal-200",
    "bg-skin-50 border-skin-200",
    "bg-cream-50 border-cream-200",
  ];
  const phaseTextColors = ["", "text-teal-700", "text-skin-700", "text-cream-700"];

  const actionRing: Record<string, string> = {
    approve: "ring-2 ring-teal-400 bg-teal-50",
    modify: "ring-2 ring-cream-400 bg-cream-50",
    remove: "ring-2 ring-red-400 bg-red-50 opacity-75",
  };

  return (
    <motion.div
      layout
      className={`rounded-xl border p-4 transition-all ${
        state.action ? actionRing[state.action] : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs px-1.5 py-0.5 rounded border font-medium ${phaseColors[product.phase] ?? ""} ${phaseTextColors[product.phase] ?? ""}`}
            >
              Phase {product.phase}
            </span>
            <span className="text-xs text-gray-400 capitalize">{product.category}</span>
            {product.time_of_day && (
              <span className="text-xs text-gray-400 capitalize">{product.time_of_day}</span>
            )}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-gray-900">{product.product_name}</h4>
          <p className="text-xs text-gray-500">{product.brand}</p>
        </div>
        {product.price_inr && (
          <span className="text-xs font-medium text-gray-700 flex-shrink-0">
            ₹{product.price_inr.toFixed(0)}
          </span>
        )}
      </div>

      {product.key_ingredients.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {product.key_ingredients.slice(0, 4).map((ing) => (
            <span
              key={ing}
              className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md"
            >
              {ing}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-gray-600 leading-relaxed">
        <span className="font-medium text-gray-700">AI reasoning: </span>
        {product.ai_reasoning || "—"}
      </p>

      {state.showNote && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3"
        >
          <label className="text-xs font-medium text-cream-700 block mb-1">
            Your override note:
          </label>
          <textarea
            value={state.note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Enter your clinical reasoning or modified recommendation…"
            rows={3}
            disabled={readonly}
            className="w-full text-xs border border-cream-300 rounded-lg px-3 py-2 focus:outline-none focus:border-cream-500 bg-white resize-none disabled:opacity-60"
          />
        </motion.div>
      )}

      {!readonly && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onAction("approve")}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              state.action === "approve"
                ? "bg-teal-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approve
          </button>
          <button
            onClick={() => {
              onAction("modify");
              onToggleNote();
            }}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              state.action === "modify"
                ? "bg-cream-500 text-gray-900"
                : "bg-gray-100 text-gray-600 hover:bg-cream-50 hover:text-cream-700"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Modify
          </button>
          <button
            onClick={() => onAction("remove")}
            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              state.action === "remove"
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>
      )}

      {readonly && product.derm_action && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
              product.derm_action === "approve"
                ? "bg-teal-100 text-teal-700"
                : product.derm_action === "modify"
                ? "bg-cream-100 text-cream-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {product.derm_action === "approve"
              ? "✓ Approved"
              : product.derm_action === "modify"
              ? "✎ Modified"
              : "✗ Removed"}
          </span>
          {product.derm_override_note && (
            <span className="text-xs text-gray-500 italic">{product.derm_override_note}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
          {icon}
          {title}
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [caseData, setCaseData] = useState<CaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [productStates, setProductStates] = useState<Record<string, ProductState>>({});
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [patientNote, setPatientNote] = useState("");
  const [showPatientNote, setShowPatientNote] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("lifestyle");

  const savingRef = useRef<Record<string, boolean>>({});

  const isReadonly =
    caseData?.status === "approved" || caseData?.status === "rejected";

  useEffect(() => {
    if (!id) return;
    dermApi
      .getCase(id as string)
      .then((data) => {
        setCaseData(data);
        const initial: Record<string, ProductState> = {};
        for (const p of data.products) {
          initial[p.recommendation_product_id] = {
            action: p.derm_action ?? null,
            note: p.derm_override_note ?? "",
            showNote: p.derm_action === "modify",
          };
        }
        setProductStates(initial);
        if (data.patient_note) setPatientNote(data.patient_note);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load case"))
      .finally(() => setLoading(false));
  }, [id]);

  function updateProductAction(productId: string, action: ActionType) {
    setProductStates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        action,
        showNote:
          action === "modify" ? true : prev[productId]?.showNote ?? false,
      },
    }));
    if (!caseData || savingRef.current[productId]) return;
    savingRef.current[productId] = true;
    dermApi
      .overrideProduct(caseData.recommendation_id, productId, {
        action: action as "approve" | "modify" | "remove",
      })
      .finally(() => {
        savingRef.current[productId] = false;
      });
  }

  function updateProductNote(productId: string, note: string) {
    setProductStates((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], note },
    }));
  }

  function toggleNoteField(productId: string) {
    setProductStates((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        showNote: !prev[productId]?.showNote,
      },
    }));
  }

  async function handleSubmitReview(
    decision: "approved" | "rejected" | "request_info"
  ) {
    if (!caseData) return;
    setSubmitting(true);
    setError(null);
    try {
      const product_actions: Record<string, ProductActionRequest> = {};
      for (const [pid, state] of Object.entries(productStates)) {
        if (state.action) {
          product_actions[pid] = {
            action: state.action,
            override_note: state.note || undefined,
          };
        }
      }
      const payload: ReviewSubmitRequest = {
        decision,
        reviewer_notes: reviewerNotes || undefined,
        patient_note:
          showPatientNote && patientNote ? patientNote : undefined,
        product_actions:
          Object.keys(product_actions).length > 0 ? product_actions : undefined,
      };
      await dermApi.submitReview(caseData.recommendation_id, payload);
      setSubmitSuccess(true);
      setTimeout(() => router.push("/review-queue"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSection((prev) => (prev === section ? null : section));
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eggshell">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          <p className="text-sm text-gray-400">Loading case…</p>
        </div>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-eggshell">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-2" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-sm text-teal-600 underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!caseData) return null;
  const { patient } = caseData;

  return (
    <div className="min-h-screen bg-eggshell">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push("/review-queue")}
            className="text-gray-400 hover:text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-gray-900">
                Case: {patient.patient_id}
              </h1>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  caseData.priority === "high"
                    ? "bg-red-100 text-red-700"
                    : caseData.priority === "normal"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {caseData.priority} priority
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                  caseData.status === "approved"
                    ? "bg-teal-100 text-teal-700"
                    : caseData.status === "rejected"
                    ? "bg-red-100 text-red-700"
                    : caseData.status === "in_review"
                    ? "bg-skin-100 text-skin-700"
                    : "bg-cream-100 text-cream-700"
                }`}
              >
                {caseData.status.replace("_", " ")}
              </span>
              {caseData.requires_derm_review && (
                <span className="text-xs bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Review required
                </span>
              )}
            </div>
          </div>
          {caseData.skin_score != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">Skin score</p>
              <p className="text-lg font-bold text-teal-600">
                {caseData.skin_score.toFixed(0)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white text-sm font-medium px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Review submitted! Redirecting…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">

        {/* ============================================================= */}
        {/* LEFT COLUMN — patient data                                      */}
        {/* ============================================================= */}
        <div className="space-y-4">

          {/* Demographics */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-500" />
              Patient Profile
              <span className="text-xs text-gray-400 font-normal">(anonymised)</span>
            </h2>
            <div className="grid grid-cols-2 gap-x-4">
              <InfoRow label="ID" value={patient.patient_id} />
              <InfoRow label="Age group" value={patient.age_group} />
              <InfoRow label="Gender" value={patient.gender} />
              <InfoRow label="City" value={patient.city} />
              <InfoRow label="Skin type" value={patient.skin_type} />
              <InfoRow
                label="Skin Tone"
                value={
                  patient.fitzpatrick_tone
                    ? `Type ${patient.fitzpatrick_tone}`
                    : null
                }
              />
            </div>
            {caseData.confidence_score != null && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-400">AI confidence</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      caseData.confidence_score >= 0.75
                        ? "bg-teal-400"
                        : "bg-cream-400"
                    }`}
                    style={{
                      width: `${(caseData.confidence_score * 100).toFixed(0)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">
                  {(caseData.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Skin conditions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Skin Conditions
            </h2>
            {patient.conditions.length === 0 ? (
              <p className="text-xs text-gray-400">No conditions detected</p>
            ) : (
              <div className="space-y-2">
                {patient.conditions.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-700 capitalize w-28 flex-shrink-0">
                      {c.name.replace("_", " ")}
                    </span>
                    <SeverityBar severity={c.severity} />
                    <span className="text-xs text-gray-400 capitalize">
                      {c.severity}
                    </span>
                    {c.affected_zone && (
                      <span className="text-xs text-gray-400 capitalize ml-auto">
                        {c.affected_zone.replace("_", " ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {caseData.allergen_flags.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Allergen flags
                </p>
                <div className="flex flex-wrap gap-1">
                  {caseData.allergen_flags.map((f) => (
                    <span
                      key={f}
                      className="text-xs bg-red-50 border border-red-200 text-red-600 px-1.5 py-0.5 rounded-md"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lifestyle */}
          <CollapsibleSection
            title="Lifestyle"
            icon={<Zap className="w-4 h-4 text-skin-500" />}
            expanded={expandedSection === "lifestyle"}
            onToggle={() => toggleSection("lifestyle")}
          >
            <InfoRow
              label="Sleep (hrs/night)"
              value={patient.sleep_hours_avg}
            />
            <InfoRow
              label="Sleep quality"
              value={
                patient.sleep_quality ? `${patient.sleep_quality}/5` : null
              }
            />
            <InfoRow
              label="Stress level"
              value={
                patient.stress_level ? `${patient.stress_level}/5` : null
              }
            />
            <InfoRow
              label="Water intake"
              value={
                patient.water_intake_liters
                  ? `${patient.water_intake_liters} L/day`
                  : null
              }
            />
            <InfoRow label="Diet" value={patient.diet_type} />
            <InfoRow label="Exercise" value={patient.exercise_frequency} />
            <InfoRow label="Work env." value={patient.work_environment} />
            <InfoRow label="Pollution" value={patient.pollution_exposure} />
          </CollapsibleSection>

          {/* Climate */}
          <CollapsibleSection
            title="Climate Profile"
            icon={<Droplets className="w-4 h-4 text-teal-500" />}
            expanded={expandedSection === "climate"}
            onToggle={() => toggleSection("climate")}
          >
            <InfoRow label="Zone" value={patient.climate_zone} />
            <InfoRow
              label="Humidity"
              value={
                patient.avg_humidity_pct
                  ? `${patient.avg_humidity_pct.toFixed(0)}%`
                  : null
              }
            />
            <InfoRow label="UV index" value={patient.uv_index} />
            <InfoRow label="Water hardness" value={patient.water_hardness} />
          </CollapsibleSection>

          {/* Current routine */}
          <CollapsibleSection
            title="Current Routine"
            icon={<Moon className="w-4 h-4 text-gray-500" />}
            expanded={expandedSection === "routine"}
            onToggle={() => toggleSection("routine")}
          >
            {patient.current_routine_items.length === 0 ? (
              <p className="text-xs text-gray-400">No routine reported</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {patient.current_routine_items.map((item) => (
                  <span
                    key={item}
                    className="text-xs bg-gray-50 text-gray-700 px-2 py-0.5 rounded-md capitalize"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Medical */}
          <CollapsibleSection
            title="Medical Notes"
            icon={<Info className="w-4 h-4 text-red-500" />}
            expanded={expandedSection === "medical"}
            onToggle={() => toggleSection("medical")}
          >
            {patient.diagnosed_conditions.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">
                  Diagnosed conditions
                </p>
                <div className="flex flex-wrap gap-1">
                  {patient.diagnosed_conditions.map((d) => (
                    <span
                      key={d}
                      className="text-xs bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded-md capitalize"
                    >
                      {d.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {patient.medication_affects_skin && (
              <InfoRow
                label="Medication"
                value={patient.medication_name ?? "Yes (unspecified)"}
              />
            )}
            {!patient.medication_affects_skin &&
              patient.diagnosed_conditions.length === 0 && (
                <p className="text-xs text-gray-400">No medical flags</p>
              )}
          </CollapsibleSection>
        </div>

        {/* ============================================================= */}
        {/* RIGHT COLUMN — AI recommendation + review actions               */}
        {/* ============================================================= */}
        <div className="space-y-4">

          {/* AI summary */}
          {caseData.ai_summary && (
            <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-2xl border border-teal-200 p-5">
              <h2 className="text-sm font-semibold text-teal-800 mb-2 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" />
                AI Summary
              </h2>
              <p className="text-sm text-teal-900 leading-relaxed">
                {caseData.ai_summary}
              </p>
              {caseData.estimated_monthly_cost_inr != null && (
                <p className="mt-2 text-xs text-teal-700">
                  Est. monthly cost: ₹
                  {caseData.estimated_monthly_cost_inr.toFixed(0)}
                </p>
              )}
              {caseData.roadmap_total_weeks > 0 && (
                <p className="text-xs text-teal-700">
                  Roadmap: {caseData.roadmap_phase_count} phases ·{" "}
                  {caseData.roadmap_total_weeks} weeks
                </p>
              )}
            </div>
          )}

          {/* Product cards */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">
                AI Recommended Products ({caseData.products.length})
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Review each product — approve, modify, or remove before final
                submission.
              </p>
            </div>
            <div className="p-4 space-y-3">
              {caseData.products.map((product) => (
                <ProductCard
                  key={product.recommendation_product_id}
                  product={product}
                  state={
                    productStates[product.recommendation_product_id] ?? {
                      action: null,
                      note: "",
                      showNote: false,
                    }
                  }
                  onAction={(a) =>
                    updateProductAction(
                      product.recommendation_product_id,
                      a
                    )
                  }
                  onNoteChange={(n) =>
                    updateProductNote(product.recommendation_product_id, n)
                  }
                  onToggleNote={() =>
                    toggleNoteField(product.recommendation_product_id)
                  }
                  readonly={isReadonly}
                />
              ))}
            </div>
          </div>

          {/* Overall review panel */}
          {!isReadonly && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-500" />
                Overall Review
              </h2>

              {/* Reviewer notes */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Reviewer notes{" "}
                  <span className="text-gray-400 font-normal">
                    (internal — not shown to patient)
                  </span>
                </label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Clinical notes, observations, or reasoning for your decision…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400 resize-none"
                />
              </div>

              {/* Patient note toggle */}
              <div>
                <button
                  onClick={() => setShowPatientNote((v) => !v)}
                  className="flex items-center gap-2 text-xs font-medium text-teal-600 hover:text-teal-700"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {showPatientNote ? "Hide" : "Add"} note for patient
                  {showPatientNote ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                <AnimatePresence>
                  {showPatientNote && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 overflow-hidden"
                    >
                      <label className="text-xs text-gray-500 block mb-1">
                        Message to patient (encrypted — only visible to them)
                      </label>
                      <textarea
                        value={patientNote}
                        onChange={(e) => setPatientNote(e.target.value)}
                        placeholder="Write a personalised note or advice for the patient…"
                        rows={4}
                        className="w-full text-sm border border-teal-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-400 resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Encrypted with patient key before storage
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* Submit buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-deep-brown/10 font-sans">
                <button
                  onClick={() => handleSubmitReview("approved")}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-deep-brown bg-butter hover:bg-butter/90 border border-deep-brown/10 shadow-sm disabled:opacity-60 px-4 py-3 rounded-xl transition-colors"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-olive" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-olive" />
                  )}
                  Approve All &amp; Submit
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSubmitReview("request_info")}
                    disabled={submitting}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-deep-brown bg-cream hover:bg-nude/20 border border-deep-brown/15 disabled:opacity-60 px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-olive" />
                    Request Info
                  </button>

                  <button
                    onClick={() => handleSubmitReview("rejected")}
                    disabled={submitting}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-deep-brown bg-deep-brown/10 hover:bg-deep-brown/20 border border-deep-brown/15 disabled:opacity-60 px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5 text-deep-brown" />
                    Reject with Notes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Read-only outcome */}
          {isReadonly && (
            <div
              className={`rounded-2xl border p-5 ${
                caseData.status === "approved"
                  ? "bg-teal-50 border-teal-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {caseData.status === "approved" ? (
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <p
                  className={`text-sm font-semibold capitalize ${
                    caseData.status === "approved"
                      ? "text-teal-800"
                      : "text-red-800"
                  }`}
                >
                  Case {caseData.status}
                </p>
              </div>
              {caseData.patient_note && (
                <div className="mt-3 pt-3 border-t border-white/50">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Patient note sent
                  </p>
                  <p className="text-sm text-gray-700 italic">
                    &ldquo;{caseData.patient_note}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
