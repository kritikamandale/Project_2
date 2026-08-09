"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clock,
  ChevronRight,
  Sparkles,
  Calendar,
  ArrowRight,
  Camera,
  ShoppingBag,
  ExternalLink,
  Sun,
  Moon,
  Leaf,
  Star,
  Check,
  Shield,
  Activity,
  Layers,
} from "lucide-react";
import {
  getLatestRecommendation,
  type RecommendationDetail,
  type RoadmapPhase,
  type RecommendedProductEntry,
} from "@/lib/api/recommendations";
import { useCart } from "@/lib/context/cart-context";
import { LayeringGuidanceCard } from "@/components/results/layering-guidance-card";

function currentWeek(generatedAt: string): number {
  const elapsedMs = Date.now() - new Date(generatedAt).getTime();
  const weeks = Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, weeks);
}

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

function PhaseCard({
  phase,
  week,
  index,
  products,
}: {
  phase: RoadmapPhase;
  week: number;
  index: number;
  products: RecommendedProductEntry[];
}) {
  const { addToCart, removeFromCart, isInCart } = useCart();
  const isActive = week >= phase.weeks_start && week <= phase.weeks_end;
  const isDone = week > phase.weeks_end;

  // Filter recommended products belonging to this phase
  const phaseProducts = products.filter((p) => p.phase === phase.phase);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
      className="relative rounded-3xl border border-deep-brown/15 p-6 shadow-sm bg-cream text-deep-brown font-sans space-y-4"
    >
      {isActive && (
        <span className="absolute -top-3 left-6 font-mono text-[11px] font-bold uppercase tracking-wider bg-butter text-deep-brown border border-deep-brown/15 px-3 py-1 rounded-full shadow-xs">
          You are here
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full border border-deep-brown/20 flex items-center justify-center font-bold text-sm shrink-0 ${
            isDone ? "bg-olive text-cream" : "bg-butter text-deep-brown"
          }`}
        >
          {isDone ? "✓" : phase.phase}
        </div>
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-olive">
            Phase {phase.phase} · Weeks {phase.weeks_start}–{phase.weeks_end}
          </p>
          <p className="font-serif text-2xl font-bold text-deep-brown">{phase.title}</p>
        </div>
      </div>
      <p className="font-sans text-sm text-deep-brown/80 leading-relaxed">{phase.goal}</p>

      {/* Complete Recommended Product Cards for this Phase */}
      <div className="pt-3 border-t border-deep-brown/10 space-y-3">
        <p className="text-xs font-mono font-bold uppercase tracking-wider text-olive flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-olive" /> Recommended Products for Phase {phase.phase}:
        </p>

        <div className="grid grid-cols-1 gap-3">
          {phaseProducts.length === 0 ? (
            <p className="text-xs text-deep-brown/60 italic">No specific products assigned for this phase.</p>
          ) : (
            phaseProducts.map((entry) => {
              const p = entry.product;
              const inCart = isInCart(p.id);

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl bg-white border border-deep-brown/10 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.product_name}
                          className="w-14 h-14 object-cover rounded-xl border border-deep-brown/10 bg-gray-50 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-butter/40 border border-deep-brown/10 flex items-center justify-center text-olive font-bold text-xs shrink-0">
                          {p.category.slice(0, 3).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-olive/10 text-olive">
                            {p.brand_display || p.brand}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-butter text-deep-brown border border-deep-brown/10">
                            {p.category}
                          </span>
                          {p.is_dermatologist_approved && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 flex items-center gap-1">
                              <Shield className="w-3 h-3" /> Derm approved
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif font-bold text-deep-brown text-base leading-tight">{p.product_name}</h4>
                        {entry.highlighted_ingredient && (
                          <p className="text-xs text-deep-brown/70 mt-1 flex items-center gap-1">
                            <Leaf className="w-3 h-3 text-olive shrink-0" />
                            Key active: <strong>{entry.highlighted_ingredient}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {p.price_inr && (
                        <p className="font-serif text-base font-bold text-deep-brown">₹{p.price_inr.toLocaleString("en-IN")}</p>
                      )}
                      {p.rating_avg > 0 && (
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-xs text-deep-brown/70">{p.rating_avg.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Usage & Why */}
                  <div className="text-xs space-y-1.5 pt-2 border-t border-deep-brown/10">
                    {entry.reason_text && (
                      <p className="text-deep-brown/80 bg-butter/20 p-2.5 rounded-xl border border-deep-brown/10 leading-relaxed">
                        <strong>Why this phase:</strong> {entry.reason_text}
                      </p>
                    )}
                    {entry.usage_instruction && (
                      <p className="text-deep-brown/80 bg-cream p-2.5 rounded-xl border border-deep-brown/10 leading-relaxed">
                        <strong>How to use:</strong> {entry.usage_instruction}
                      </p>
                    )}
                  </div>

                  {/* Timing & Action buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-3 text-xs text-deep-brown/70">
                      <span className="flex items-center gap-1 font-mono font-semibold">
                        <Clock className="w-3.5 h-3.5 text-olive" /> Week {entry.start_week}+
                      </span>
                      {entry.time_of_day && (
                        <span className="flex items-center gap-1 font-mono font-semibold capitalize">
                          {entry.time_of_day === "morning" ? <Sun className="w-3.5 h-3.5 text-amber-600" /> :
                           entry.time_of_day === "night" ? <Moon className="w-3.5 h-3.5 text-indigo-600" /> :
                           <Activity className="w-3.5 h-3.5 text-olive" />}
                          {entry.time_of_day}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {p.product_url && (
                        <a
                          href={p.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-deep-brown text-cream text-xs font-bold rounded-lg hover:bg-deep-brown/90 transition-all shadow-xs"
                        >
                          Buy Store <ExternalLink className="w-3 h-3 text-cream" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          if (inCart) {
                            removeFromCart(p.id);
                          } else {
                            addToCart({
                              id: p.id,
                              product_name: p.product_name,
                              brand: p.brand_display || p.brand || "Skincare",
                              category: p.category,
                              price_inr: p.price_inr,
                              image_url: p.image_url,
                              store_links: p.product_url ? [{ store: p.brand_display || "Buy Now", url: p.product_url }] : [],
                            });
                          }
                        }}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer",
                          inCart
                            ? "bg-butter text-deep-brown border border-deep-brown/15 font-extrabold"
                            : "bg-olive text-cream hover:bg-olive/90",
                        ].join(" ")}
                      >
                        {inCart ? "In Routine ✓" : "+ Add to Routine"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-cream text-deep-brown relative overflow-hidden font-sans">
      <div className="max-w-md w-full bg-cream border border-deep-brown/15 rounded-3xl p-8 shadow-sm relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-butter border border-deep-brown/15 flex items-center justify-center mb-5 shadow-xs">
          <Calendar className="w-7 h-7 text-deep-brown" />
        </div>
        <h2 className="font-serif text-3xl font-bold text-deep-brown mb-2">No roadmap yet</h2>
        <p className="font-sans text-deep-brown/80 text-sm mb-6 max-w-xs leading-relaxed">
          Complete a skin scan and questionnaire to get your personalised week-by-week skincare roadmap.
        </p>
        <button
          onClick={() => router.push("/scan")}
          className="inline-flex items-center gap-2 rounded-xl bg-olive hover:bg-olive/90 text-cream px-6 py-3 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          Start a Scan &rarr;
        </button>
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const router = useRouter();
  const { cart, toggleCart } = useCart();
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [rec, setRec] = useState<RecommendationDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLatestRecommendation()
      .then((detail) => {
        if (cancelled) return;
        setRec(detail);
        setState(detail.roadmap ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) setState("empty");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream text-deep-brown font-mono text-xs uppercase font-bold tracking-wider">
        Loading Roadmap…
      </div>
    );
  }

  if (state === "empty" || !rec?.roadmap) {
    return <EmptyState />;
  }

  const week = currentWeek(rec.generated_at);
  const totalWeeks = rec.roadmap.total_weeks;
  const progressPct = Math.min(100, Math.round((week / totalWeeks) * 100));

  return (
    <div className="pb-12 bg-cream text-deep-brown min-h-screen relative font-sans">
      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-8 relative z-10">
        {/* Top Header & View Cart button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-deep-brown/10 pb-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-deep-brown">Skincare Roadmap</h1>
            <p className="text-xs sm:text-sm text-deep-brown/70 mt-0.5">Your 20-week progressive skin health transformation plan.</p>
          </div>
          <button
            onClick={toggleCart}
            className="inline-flex items-center gap-2 rounded-xl bg-butter px-4 py-2.5 text-xs font-bold text-deep-brown border border-deep-brown/15 shadow-xs hover:bg-butter/80 transition-all shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-deep-brown" />
            <span>View My Routine Cart</span>
            <span className="ml-1 rounded-full bg-olive text-cream px-2 py-0.5 text-[11px] font-extrabold">
              {cart.length}
            </span>
          </button>
        </div>

        {/* Hero progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-deep-brown text-cream border border-deep-brown/20 rounded-3xl p-6 sm:p-8 shadow-sm"
        >
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-butter mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-butter" /> Your 20-Week Skincare Roadmap
          </p>
          <p className="font-serif text-3xl md:text-4xl font-bold mb-4">
            Week {Math.min(week, totalWeeks)} of {totalWeeks}
          </p>
          <div className="h-3 bg-cream/20 border border-cream/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-butter rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <p className="font-mono text-xs text-cream/80 mt-2.5">{progressPct}% through your personalised plan</p>
        </motion.div>

        {/* Phase Timeline with Full Product Details */}
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold text-deep-brown flex items-center gap-2 border-b border-deep-brown/15 pb-2">
            <Clock className="w-5 h-5 text-olive" />
            Phase Timeline & Prescribed Products
          </h2>
          <div className="space-y-6">
            {rec.roadmap.phases.map((phase, i) => (
              <PhaseCard key={phase.phase} phase={phase} week={week} index={i} products={rec.products} />
            ))}
          </div>
        </section>

        {/* Complete Layering & Application Guide (AM vs PM) */}
        {rec.products.length > 0 && (
          <section className="space-y-4">
            <LayeringGuidanceCard layering={buildLayeringFromProducts(rec.products)} />
          </section>
        )}

        {/* Week-by-Week Action Schedule */}
        {rec.roadmap.week_entries && rec.roadmap.week_entries.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-deep-brown flex items-center gap-2 border-b border-deep-brown/15 pb-2">
              <Calendar className="w-5 h-5 text-olive" />
              Week-by-Week Action Schedule
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rec.roadmap.week_entries.map((we) => (
                <div key={`${we.week}-${we.action}`} className="bg-white rounded-2xl border border-deep-brown/15 p-4 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-deep-brown bg-butter px-2.5 py-0.5 rounded-full border border-deep-brown/15">
                      Week {we.week}
                    </span>
                    <span className="text-[11px] font-semibold text-olive">Phase {we.phase}</span>
                  </div>
                  <p className="font-serif text-base font-bold text-deep-brown">{we.action}</p>
                  {we.product_name && (
                    <p className="text-xs font-semibold text-olive">Product: {we.product_name}</p>
                  )}
                  <p className="text-xs text-deep-brown/80 leading-relaxed">{we.instruction}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Expected results timeline */}
        {rec.roadmap.condition_timelines.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-serif text-2xl font-bold text-deep-brown flex items-center gap-2 border-b border-deep-brown/15 pb-2">Expected Results Timeline</h2>
            <div className="space-y-3">
              {rec.roadmap.condition_timelines.map((ct) => (
                <div key={ct.condition} className="bg-white rounded-2xl border border-deep-brown/15 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-serif text-base font-bold capitalize text-deep-brown">
                      {ct.condition.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-xs font-bold uppercase text-deep-brown bg-butter px-2.5 py-0.5 rounded-full border border-deep-brown/15">
                      ~{ct.expected_improvement_pct}% by week {ct.expected_improvement_week}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-deep-brown/80 leading-relaxed">{ct.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
