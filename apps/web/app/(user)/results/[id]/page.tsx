"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import {
  Leaf, Droplets, Sun, Zap, ChevronDown, ExternalLink, Star,
  CheckCircle2, Clock, AlertTriangle, Shield, ThumbsUp, MapPin,
  Thermometer, Wind, Sparkles, Activity, ChevronRight, Moon, IndianRupee, Pill, Bandage, Tag, ShoppingBag
} from "lucide-react";
import {
  generateRecommendation,
  getRecommendation,
  getLatestRecommendation,
  submitRecommendationFeedback,
  type RecommendationDetail,
  type RecommendedProductEntry,
  type RoadmapPhase,
  type ConditionSummary,
} from "@/lib/api/recommendations";
import { RoutineSelector } from "@/components/results/routine-selector";
import { LayeringGuidanceCard } from "@/components/results/layering-guidance-card";
import { useCart } from "@/lib/context/cart-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BRAND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  nykaa:      { bg: "bg-skin-100",    text: "text-skin-700",   label: "Nykaa" },
  minimalist: { bg: "bg-gray-100",    text: "text-gray-800",   label: "Minimalist" },
  dermaco:    { bg: "bg-teal-100",    text: "text-teal-700",   label: "Dermaco" },
  others:     { bg: "bg-cream-100",   text: "text-cream-800",  label: "Others" },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; pct: number }> = {
  severe:   { color: "text-deep-brown font-bold", bg: "bg-deep-brown", pct: 100 },
  moderate: { color: "text-olive font-bold",      bg: "bg-olive",      pct: 66 },
  mild:     { color: "text-olive/80 font-bold",   bg: "bg-olive/80",   pct: 33 },
  none:     { color: "text-olive/50 font-bold",   bg: "bg-olive/40",   pct: 10 },
};

const PHASE_STYLES: Record<number, { border: string; bg: string; badge: string; text: string }> = {
  1: { border: "border-deep-brown/15", bg: "bg-cream", badge: "bg-butter/50 text-deep-brown font-bold border border-deep-brown/10", text: "text-deep-brown" },
  2: { border: "border-deep-brown/15", bg: "bg-cream", badge: "bg-olive/20 text-deep-brown font-bold border border-deep-brown/10", text: "text-deep-brown" },
  3: { border: "border-deep-brown/15", bg: "bg-cream", badge: "bg-nude/40 text-deep-brown font-bold border border-deep-brown/10", text: "text-deep-brown" },
};

const SKIN_TYPE_DESC: Record<string, string> = {
  oily:        "Your skin produces excess sebum. Focus on lightweight, non-comedogenic formulas.",
  dry:         "Your skin lacks moisture. Focus on repairing the barrier with ceramides and humectants.",
  combination: "You have both oily (T-zone) and dry zones. Use zone-targeted products.",
  normal:      "Your skin is well-balanced. Focus on maintenance and prevention.",
  sensitive:   "Your skin reacts easily. Patch-test everything and avoid fragrance.",
};

const GENERATING_STEPS = [
  "Analysing your skin scan results…",
  "Matching products from our catalog…",
  "Checking your local climate…",
  "Building your 20-week roadmap…",
  "Finalising personalised recommendations…",
];

// ---------------------------------------------------------------------------
// Animated skin score dial
// ---------------------------------------------------------------------------
function SkinScoreDial({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const count = useMotionValue(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const controls = animate(count, score, { duration: 1.8, ease: "easeOut" });
    const unsubscribe = count.on("change", (v) => setDisplayed(Math.round(v)));
    return () => { controls.stop(); unsubscribe(); };
  }, [score, count]);

  const color =
    score >= 70 ? "#5C6040" :
    score >= 50 ? "#F4D84A" :
    "#28261E";

  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center rounded-full bg-cream border-2 border-deep-brown/15 shadow-sm" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(40,38,30,0.12)" strokeWidth="10" />
        <motion.circle
          cx="70" cy="70" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-4xl font-bold text-deep-brown">{displayed}</span>
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-deep-brown/70">/ 100</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Condition card
// ---------------------------------------------------------------------------
function ConditionCard({ cond }: { cond: ConditionSummary }) {
  const sev = SEVERITY_CONFIG[cond.severity] ?? SEVERITY_CONFIG.none;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-cream border border-deep-brown/15 rounded-2xl p-4 flex gap-3 shadow-sm hover:border-olive/40 transition-all"
    >
      {/* Indicator tube */}
      <div className="relative w-3 h-16 shrink-0 rounded-full overflow-hidden bg-olive/10 border border-deep-brown/20">
        <motion.div
          className={`absolute bottom-0 left-0 right-0 rounded-full ${sev.bg}`}
          initial={{ height: 0 }}
          animate={{ height: `${sev.pct}%` }}
          transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-serif text-base font-bold text-deep-brown capitalize truncate">
            {cond.condition_name.replace(/_/g, " ")}
          </span>
          <span className={`font-mono text-xs font-bold uppercase shrink-0 ${sev.color}`}>
            {cond.severity}
          </span>
        </div>
        <p className="text-xs font-sans text-deep-brown/80 font-semibold capitalize">
          Zone: {cond.affected_zone.replace(/_/g, " ")}
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Layering helper
function buildLayeringFromProducts(products: RecommendedProductEntry[]) {
  const categoryOrder: Record<string, number> = {
    cleanser: 1, toner: 2, serum: 3, treatment: 3, moisturiser: 4, sunscreen: 5,
  };
  const categoryLabels: Record<string, string> = {
    cleanser: "Cleanse", toner: "Tone", serum: "Treat (Serum)", treatment: "Treat", moisturiser: "Moisturize", sunscreen: "Sun Protection",
  };
  const categoryNotes: Record<string, string> = {
    cleanser: "Start with a gentle cleanser to clear impurities.",
    toner: "Pat in gently; wait ~1 minute before next step.",
    serum: "Apply active treatment on dry skin to target core concerns.",
    treatment: "Target active spots or textured areas.",
    moisturiser: "Lock in hydration and support moisture barrier.",
    sunscreen: "Always the final AM step — reapply every 2-3 hours outdoors.",
  };

  const amSteps: any[] = [];
  const pmSteps: any[] = [];

  const sorted = [...products].sort(
    (a, b) => (categoryOrder[a.product.category] ?? 99) - (categoryOrder[b.product.category] ?? 99)
  );

  sorted.forEach((e) => {
    const timeOfDay = e.time_of_day || "both";
    const stepLabel = categoryLabels[e.product.category] ?? e.product.category;
    const note = e.usage_instruction || categoryNotes[e.product.category] || null;
    const wait = e.product.category === "toner" || e.product.category === "serum" ? 1 : 0;

    if (timeOfDay === "morning" || timeOfDay === "both") {
      amSteps.push({
        order: amSteps.length + 1,
        product_id: e.product.id,
        product_name: e.product.product_name,
        step_label: stepLabel,
        wait_minutes: wait,
        note,
      });
    }

    if (timeOfDay === "night" || timeOfDay === "both" || e.product.category !== "sunscreen") {
      if (e.product.category !== "sunscreen") {
        pmSteps.push({
          order: pmSteps.length + 1,
          product_id: e.product.id,
          product_name: e.product.product_name,
          step_label: stepLabel,
          wait_minutes: wait,
          note: e.product.category === "cleanser" ? "Double-cleanse first if you wore sunscreen or makeup during the day." : note,
        });
      }
    }
  });

  return { am: amSteps, pm: pmSteps };
}

// ---------------------------------------------------------------------------
// Product card
function ProductImage({ src, alt, category }: { src?: string | null; alt: string; category?: string }) {
  const [error, setError] = useState(false);
  const catIcons: Record<string, React.ElementType> = {
    cleanser: Droplets, moisturiser: Droplets, sunscreen: Sun, serum: Pill, toner: Sparkles, treatment: Bandage, mask: Sparkles
  };
  const IconComp = category ? (catIcons[category] ?? Leaf) : Leaf;

  if (!src || error) {
    return <IconComp className="w-6 h-6 text-skin-500" aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

// ---------------------------------------------------------------------------
function ProductCard({ entry, index }: { entry: RecommendedProductEntry; index: number }) {
  const p = entry.product;
  const brand = BRAND_STYLES[p.brand] ?? BRAND_STYLES.others;
  const phase = PHASE_STYLES[entry.phase] ?? PHASE_STYLES[1];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card glass-shimmer rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className={`${phase.bg}/40 backdrop-blur-sm px-5 pt-4 pb-3 flex items-start gap-3`}>
        {/* Product photo — floats inside its own small glass frame. */}
        <div className="w-16 h-16 shrink-0 rounded-xl glass-card overflow-hidden flex items-center justify-center bg-gray-50 border border-gray-100">
          <ProductImage src={p.image_url} alt={p.product_name} category={p.category} />
        </div>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${brand.bg} ${brand.text}`}>
                {brand.label}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${phase.badge}`}>
                Phase {entry.phase}
              </span>
              {p.is_dermatologist_approved && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Derm approved
                </span>
              )}
            </div>
            <h3 className="font-card font-bold text-gray-900 text-base leading-tight">{p.product_name}</h3>
            <p className="font-card text-xs text-gray-500 capitalize mt-0.5">{p.category}</p>
          </div>
          <div className="text-right shrink-0">
            {p.price_inr && (
              <p className="font-card text-lg font-bold text-gray-900">₹{p.price_inr.toLocaleString("en-IN")}</p>
            )}
            {p.rating_avg > 0 && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs text-gray-500">{p.rating_avg.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Key ingredient chip */}
        {entry.highlighted_ingredient && (
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="text-xs text-gray-600">
              Key ingredient: <strong>{entry.highlighted_ingredient}</strong>
            </span>
          </div>
        )}

        {/* Start week + time of day */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Start week {entry.start_week}
          </span>
          {entry.time_of_day && (
            <span className="flex items-center gap-1">
              {entry.time_of_day === "morning" ? <Sun className="w-3.5 h-3.5" /> :
               entry.time_of_day === "night" ? <Moon className="w-3.5 h-3.5" /> :
               <Activity className="w-3.5 h-3.5" />}
              {entry.time_of_day.charAt(0).toUpperCase() + entry.time_of_day.slice(1)}
            </span>
          )}
        </div>

        {/* Expandable reason */}
        {entry.reason_text && (
          <Accordion.Root type="single" collapsible>
            <Accordion.Item value="reason">
              <Accordion.Trigger className="group flex items-center gap-1.5 text-xs font-semibold text-skin-600 hover:text-skin-800 transition-colors">
                Why this for you?
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
              <Accordion.Content className="overflow-hidden data-[state=open]:animate-[slideDown_150ms_ease-out] data-[state=closed]:animate-[slideUp_150ms_ease-out]">
                <p className="pt-2 text-xs text-gray-600 leading-relaxed">{entry.reason_text}</p>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        )}

        {/* Usage instruction */}
        {entry.usage_instruction && (
          <div className="bg-white/40 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600 leading-relaxed border border-white/50">
            <strong>How to use:</strong> {entry.usage_instruction}
          </div>
        )}

        {/* Purchase link */}
        {p.product_url && (
          <a
            href={p.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full mt-1 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Buy on {brand.label}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Roadmap timeline
// ---------------------------------------------------------------------------
function RoadmapTimeline({ phases }: { phases: RoadmapPhase[] }) {
  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute top-5 left-6 right-6 h-0.5 bg-gradient-to-r from-teal-200 via-skin-200 to-cream-200 hidden sm:block" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
        {phases.map((phase, i) => {
          const style = PHASE_STYLES[phase.phase] ?? PHASE_STYLES[1];
          return (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className={`rounded-2xl border backdrop-blur-md ${style.border} ${style.bg} p-4`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${style.badge}`}>
                  {phase.phase}
                </div>
                <div>
                  <p className={`text-xs font-bold ${style.text}`}>Phase {phase.phase}</p>
                  <p className="text-sm font-bold text-gray-900">{phase.title}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Weeks {phase.weeks_start}–{phase.weeks_end}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">{phase.goal}</p>
              {phase.product_names.length > 0 && (
                <div className="space-y-1">
                  {phase.product_names.map((name) => (
                    <div key={name} className="flex items-center gap-1.5 text-xs text-gray-700">
                      <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback stars
// ---------------------------------------------------------------------------
function FeedbackSection({ recommendationId }: { recommendationId: string }) {
  const [selected, setSelected] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!selected) return;
    try {
      await submitRecommendationFeedback(recommendationId, selected);
      setSubmitted(true);
    } catch {
      // silent — feedback is optional
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-teal-600 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4" /> Thank you for your feedback!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">How helpful was this recommendation?</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                n <= (hover || selected)
                  ? "text-amber-400 fill-amber-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
      {selected > 0 && (
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 bg-skin-500 text-white text-xs font-semibold rounded-lg hover:bg-skin-600 transition-colors"
        >
          Submit
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generating state
// ---------------------------------------------------------------------------
function GeneratingState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, GENERATING_STEPS.length - 1)), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="w-16 h-16 rounded-full border-4 border-teal-200 border-t-teal-600 mb-8"
      />
      <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
        Building your skin roadmap
      </h2>
      <p className="text-gray-500 text-sm mb-8 text-center max-w-xs">
        Generating your personalised routine — this may take up to a minute.
        Hang tight, it&apos;s worth the wait.
      </p>
      <div className="w-full max-w-sm space-y-3">
        {GENERATING_STEPS.map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: i <= step ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 text-sm"
          >
            {i < step ? (
              <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />
            ) : i === step ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-4 h-4 rounded-full bg-teal-500 shrink-0"
              />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
            )}
            <span className={i <= step ? "text-gray-800 font-medium" : "text-gray-400"}>
              {label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const scanId = params.id;
  const questionnaireId = searchParams.get("questionnaire_id") ?? undefined;

  const [state, setState] = useState<"generating" | "ready" | "error">("generating");
  const [recommendation, setRecommendation] = useState<RecommendationDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      const storageKey = `rec_${scanId}_${questionnaireId ?? "none"}`;
      const cachedId = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;

      try {
        let detail: RecommendationDetail | null = null;

        if (cachedId) {
          try {
            detail = await getRecommendation(cachedId);
          } catch {
            /* cache miss — fallback below */
          }
        }

        if (!detail) {
          try {
            // First try fetching by ID directly (in case URL param is recommendation ID)
            detail = await getRecommendation(scanId);
          } catch {
            // Otherwise generate fresh for this scan_id
            const genRes = await generateRecommendation({
              scan_id: scanId,
              questionnaire_id: questionnaireId,
            });
            if (typeof window !== "undefined") {
              sessionStorage.setItem(storageKey, genRes.recommendation_id);
            }
            detail = await getRecommendation(genRes.recommendation_id);
          }
        }

        setRecommendation(detail);
        setState("ready");
      } catch {
        // Fallback: show latest recommendation if available
        try {
          const latest = await getLatestRecommendation();
          setRecommendation(latest);
          setState("ready");
        } catch (err2: unknown) {
          const msg = err2 instanceof Error ? err2.message : "Failed to load recommendation.";
          setErrorMsg(msg);
          setState("error");
        }
      }
    }

    init();
  }, [scanId, questionnaireId]);

  if (state === "generating") return <GeneratingState />;

  if (state === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-xs">{errorMsg}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Re-run generation from scratch (clears the one-shot init guard)
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="px-6 py-2 bg-skin-500 text-white text-sm font-semibold rounded-xl hover:bg-skin-600 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-300 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const rec = recommendation!;
  const meta = {
    lifestyle_tips: rec.lifestyle_tips ?? [],
    ingredients_to_use: rec.ingredients_to_use ?? [],
    ingredients_to_avoid: rec.ingredients_to_avoid ?? [],
    morning_routine: rec.morning_routine ?? [],
    night_routine: rec.night_routine ?? [],
    dermatologist_note: rec.dermatologist_note,
    climate_insight: rec.climate_insight,
  };

  const phase1Products = rec.products.filter((p) => p.phase === 1);
  const phase2Products = rec.products.filter((p) => p.phase === 2);
  const phase3Products = rec.products.filter((p) => p.phase === 3);

  // Primary concern = the most severe detected condition — drives the product
  // Match Score reason ("active <concern>") so the routine is personalised.
  const SEVERITY_RANK: Record<string, number> = { severe: 3, moderate: 2, mild: 1, none: 0 };
  const primaryCondition =
    [...rec.conditions_summary]
      .filter((c) => c.severity !== "none")
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))[0]
      ?.condition_name ?? null;

  return (
    <div className="pb-12">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-8">
        {/* ---- 1. Hero: Skin Score + Type ---- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 shadow-sm bg-cream border border-deep-brown/15"
        >
          <p className="text-olive text-xs font-bold uppercase tracking-widest mb-3">Your Skin Health Score</p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <SkinScoreDial score={rec.skin_score ?? 0} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown capitalize mb-1">
                {rec.skin_type ?? "—"} Skin
              </p>
              <p className="font-sans text-deep-brown/80 text-sm leading-relaxed">
                {SKIN_TYPE_DESC[rec.skin_type ?? ""] ?? ""}
              </p>
              {rec.fitzpatrick_tone && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-butter/40 border border-deep-brown/15 text-deep-brown px-3 py-1 rounded-full text-xs font-mono font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-olive" />
                  Skin Tone · {rec.fitzpatrick_tone}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ---- 2. Conditions ---- */}
        {rec.conditions_summary.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-bold text-deep-brown mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-olive" />
              Detected Conditions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rec.conditions_summary.map((c) => (
                <ConditionCard key={c.condition_name} cond={c} />
              ))}
            </div>
          </section>
        )}

        {/* ---- 3. YOUR PERSONALISED ROUTINE (AI / Derm Prescribed) ---- */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-deep-brown/15 pb-3">
            <div>
              <h2 className="text-2xl font-serif font-bold text-deep-brown flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-olive" />
                Your Personalised Routine
              </h2>
              <p className="text-xs text-deep-brown/70 mt-0.5 font-sans">
                {rec.products.length} products prescribed specifically for your skin profile and local climate.
              </p>
            </div>
          </div>

          {phase1Products.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono font-bold bg-butter text-deep-brown border border-deep-brown/15 px-3 py-1 rounded-full uppercase tracking-wider">
                  Phase 1 · Weeks 1–4
                </span>
                <span className="text-xs font-serif font-semibold text-olive">Foundations</span>
              </div>
              <div className="space-y-4">
                {phase1Products.map((e, i) => <ProductCard key={e.id} entry={e} index={i} />)}
              </div>
            </div>
          )}

          {phase2Products.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono font-bold bg-olive text-cream px-3 py-1 rounded-full uppercase tracking-wider">
                  Phase 2 · Weeks 5–12
                </span>
                <span className="text-xs font-serif font-semibold text-olive">Targeted Treatment</span>
              </div>
              <div className="space-y-4">
                {phase2Products.map((e, i) => <ProductCard key={e.id} entry={e} index={phase1Products.length + i} />)}
              </div>
            </div>
          )}

          {phase3Products.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono font-bold bg-cream border border-deep-brown/20 text-deep-brown px-3 py-1 rounded-full uppercase tracking-wider">
                  Phase 3 · Weeks 13–20
                </span>
                <span className="text-xs font-serif font-semibold text-olive">Optimise & Maintain</span>
              </div>
              <div className="space-y-4">
                {phase3Products.map((e, i) => (
                  <ProductCard key={e.id} entry={e} index={phase1Products.length + phase2Products.length + i} />
                ))}
              </div>
            </div>
          )}

          {/* Layering Guidance — Morning vs Night application order */}
          {rec.products.length > 0 && (
            <div className="pt-4 border-t border-deep-brown/15">
              <LayeringGuidanceCard layering={buildLayeringFromProducts(rec.products)} />
            </div>
          )}
        </section>

        {/* ---- 4. Climate insight ---- */}
        {meta.climate_insight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-butter/20 border border-deep-brown/15 rounded-2xl p-4 flex gap-3 text-deep-brown font-sans"
          >
            <MapPin className="w-5 h-5 text-olive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-deep-brown mb-1 font-serif">Climate Insight</p>
              <p className="text-sm text-deep-brown/80 leading-relaxed">{meta.climate_insight}</p>
            </div>
          </motion.div>
        )}

        {/* ---- 5. Monthly cost estimate ---- */}
        {rec.estimated_monthly_cost_inr && (
          <div className="bg-cream border border-deep-brown/15 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-butter text-deep-brown flex items-center justify-center shrink-0 border border-deep-brown/15 font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-deep-brown font-serif">
                Estimated Monthly Cost: ₹{rec.estimated_monthly_cost_inr.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-deep-brown/70">One-time purchase — products typically last 2–3 months</p>
            </div>
          </div>
        )}

        {/* ---- 6. Allergen / conflict flags ---- */}
        {rec.allergen_flags.length > 0 && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 mb-1">Allergen & Safety Alert</p>
              {rec.allergen_flags.map((flag) => (
                <p key={flag} className="text-xs text-amber-800 font-medium">{flag}</p>
              ))}
              <p className="text-xs text-amber-700 mt-1">
                Please consult your dermatologist before using flagged products.
              </p>
            </div>
          </div>
        )}

        {/* ---- 7. 20-Week Roadmap ---- */}
        {rec.roadmap && (
          <section className="space-y-4">
            <h2 className="text-xl font-serif font-bold text-deep-brown flex items-center gap-2 border-b border-deep-brown/15 pb-2">
              <Clock className="w-5 h-5 text-olive" />
              Your 20-Week Transformation Roadmap
            </h2>
            <RoadmapTimeline phases={rec.roadmap.phases} />

            {/* Condition timelines */}
            {rec.roadmap.condition_timelines.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-olive">Expected Results Timeline:</p>
                {rec.roadmap.condition_timelines.map((ct) => (
                  <div key={ct.condition} className="bg-cream rounded-2xl border border-deep-brown/15 p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-serif text-sm font-bold capitalize text-deep-brown">
                        {ct.condition.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono text-xs font-bold uppercase text-deep-brown bg-butter px-2.5 py-0.5 rounded-full border border-deep-brown/15">
                        ~{ct.expected_improvement_pct}% by week {ct.expected_improvement_week}
                      </span>
                    </div>
                    <p className="text-xs text-deep-brown/80 leading-relaxed">{ct.note}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---- 8. EXPLORE & CUSTOMISE EXTRA PRODUCTS ---- */}
        <section className="pt-8 border-t border-deep-brown/15">
          <div className="mb-4">
            <h2 className="text-2xl font-serif font-bold text-deep-brown flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-olive" />
              Explore & Customise Extra Products
            </h2>
            <p className="text-xs sm:text-sm text-deep-brown/70 mt-0.5 font-sans">
              Want to add extra steps or swap products? Browse our full catalogue below by category, brand, and budget.
            </p>
          </div>
          <RoutineSelector
            skinType={rec.skin_type}
            fitzpatrick={rec.fitzpatrick_tone}
            condition={primaryCondition}
            scanId={rec.scan_id}
            questionnaireId={rec.questionnaire_id}
          />
        </section>

        {/* ---- 7. 20-Week Roadmap ---- */}
        {rec.roadmap && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-500" />
              Your 20-Week Roadmap
            </h2>
            <RoadmapTimeline phases={rec.roadmap.phases} />

            {/* Condition timelines */}
            {rec.roadmap.condition_timelines.length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Expected Results Timeline</p>
                {rec.roadmap.condition_timelines.map((ct) => (
                  <div key={ct.condition} className="glass-card rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold capitalize text-gray-800">
                        {ct.condition.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-teal-600 font-medium">
                        ~{ct.expected_improvement_pct}% by week {ct.expected_improvement_week}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{ct.note}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---- 8. Morning + Night routine ---- */}
        {(meta.morning_routine.length > 0 || meta.night_routine.length > 0) && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sun className="w-5 h-5 text-skin-500" />
              Daily Routine Steps
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {meta.morning_routine.length > 0 && (
                <div className="bg-cream-50/50 backdrop-blur-md border border-cream-200/60 rounded-2xl p-4">
                  <p className="text-sm font-bold text-cream-800 mb-3 flex items-center gap-1.5">
                    <Sun className="w-4 h-4" /> Morning Routine
                  </p>
                  <ol className="space-y-2">
                    {meta.morning_routine.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-cream-900">
                        <span className="text-xs font-bold bg-cream-200 text-cream-800 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {meta.night_routine.length > 0 && (
                <div className="bg-gray-100/50 backdrop-blur-md border border-gray-200/60 rounded-2xl p-4">
                  <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                    <Moon className="w-4 h-4" /> Night Routine
                  </p>
                  <ol className="space-y-2">
                    {meta.night_routine.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-900">
                        <span className="text-xs font-bold bg-gray-200 text-gray-800 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- 9. Ingredients ---- */}
        {(meta.ingredients_to_use.length > 0 || meta.ingredients_to_avoid.length > 0) && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-teal-500" />
              Ingredients Guide
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {meta.ingredients_to_use.length > 0 && (
                <div className="bg-teal-50/50 backdrop-blur-md border border-teal-200/60 rounded-2xl p-4">
                  <p className="text-sm font-bold text-teal-800 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Look for
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.ingredients_to_use.map((ing) => (
                      <span key={ing} className="text-xs bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full font-medium">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {meta.ingredients_to_avoid.length > 0 && (
                <div className="bg-red-50/50 backdrop-blur-md border border-red-200/60 rounded-2xl p-4">
                  <p className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Avoid
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.ingredients_to_avoid.map((ing) => (
                      <span key={ing} className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- 10. Lifestyle tips ---- */}
        {meta.lifestyle_tips.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-teal-500" />
              Lifestyle Tips
            </h2>
            <div className="glass-card rounded-2xl divide-y divide-white/30">
              {meta.lifestyle_tips.map((tip, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 text-sm text-gray-700">
                  <Zap className="w-4 h-4 text-skin-500 shrink-0 mt-0.5" />
                  {tip}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- 11. Dermatologist note ---- */}
        {meta.dermatologist_note && (
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-teal-500" />
              <span className="text-sm font-bold text-gray-900">Dermatologist Note</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed italic">
              &ldquo;{meta.dermatologist_note}&rdquo;
            </p>
          </div>
        )}

        {/* ---- 12. Derm review badge ---- */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 backdrop-blur-md border ${
          rec.is_dermatologist_reviewed
            ? "bg-teal-50/50 border-teal-200/60"
            : rec.requires_derm_review
            ? "bg-cream-50/50 border-cream-200/60"
            : "bg-gray-50/50 border-gray-200/60"
        }`}>
          {rec.is_dermatologist_reviewed ? (
            <>
              <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-teal-800">Dermatologist Reviewed</p>
                <p className="text-xs text-teal-600">
                  Approved on {rec.reviewed_at ? new Date(rec.reviewed_at).toLocaleDateString("en-IN") : "—"}
                </p>
              </div>
            </>
          ) : rec.requires_derm_review ? (
            <>
              <Clock className="w-6 h-6 text-cream-700 shrink-0" />
              <div>
                <p className="text-sm font-bold text-cream-800">Pending Dermatologist Review</p>
                <p className="text-xs text-cream-700">
                  Our certified dermatologists will review this recommendation within 24–48 hours.
                </p>
              </div>
            </>
          ) : (
            <>
              <ThumbsUp className="w-6 h-6 text-gray-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-700">AI-Generated Recommendation</p>
                <p className="text-xs text-gray-500">
                  Powered by the Skinest Intelligence Engine. For diagnosed conditions, consult a dermatologist.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ---- 13. Feedback ---- */}
        <div className="glass-card rounded-2xl p-5">
          <FeedbackSection recommendationId={rec.id} />
        </div>

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
