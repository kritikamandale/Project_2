"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, CheckCircle2, Leaf } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SampleProduct {
  id: string;
  name: string;
  brand: string;
  stores: { name: string; url: string }[];
  priceInr: number;
  keyIngredient: string;
  suitableFor: string[];
  category: "cleanser" | "toner" | "serum" | "moisturizer" | "sunscreen";
}

interface RoutineStep {
  stepNumber: number;
  label: string;
  emoji: string;
  category: SampleProduct["category"];
  when: string;
}

// ─── Sample Product Catalog ───────────────────────────────────────────────────
// Replace with real products once the company/product list is provided.

const SAMPLE_PRODUCTS: SampleProduct[] = [
  // Cleansers
  {
    id: "c1",
    name: "2% Salicylic Acid Face Wash",
    brand: "Minimalist",
    stores: [
      { name: "Minimalist", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 349,
    keyIngredient: "Salicylic Acid 2%",
    suitableFor: ["oily", "combination"],
    category: "cleanser",
  },
  {
    id: "c2",
    name: "Hydrating Facial Cleanser",
    brand: "CeraVe",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 899,
    keyIngredient: "Ceramides, Hyaluronic Acid",
    suitableFor: ["dry", "sensitive", "normal"],
    category: "cleanser",
  },
  {
    id: "c3",
    name: "Green Tea Pore Cleansing Face Wash",
    brand: "Plum",
    stores: [
      { name: "Plum", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 299,
    keyIngredient: "Green Tea Extract, AHA",
    suitableFor: ["oily", "combination"],
    category: "cleanser",
  },
  {
    id: "c4",
    name: "Gentle Skin Cleanser",
    brand: "Cetaphil",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 599,
    keyIngredient: "Niacinamide, Panthenol",
    suitableFor: ["sensitive", "normal", "dry"],
    category: "cleanser",
  },

  // Toners
  {
    id: "t1",
    name: "Hyaluronic Acid + PGA 02% Toner",
    brand: "Minimalist",
    stores: [
      { name: "Minimalist", url: "#" },
      { name: "Amazon", url: "#" },
    ],
    priceInr: 499,
    keyIngredient: "Hyaluronic Acid, PGA",
    suitableFor: ["dry", "normal", "sensitive"],
    category: "toner",
  },
  {
    id: "t2",
    name: "Green Tea Alcohol-Free Toner",
    brand: "Plum",
    stores: [
      { name: "Plum", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 299,
    keyIngredient: "Green Tea Extract, Witch Hazel",
    suitableFor: ["oily", "combination"],
    category: "toner",
  },
  {
    id: "t3",
    name: "2% Kojic Acid Face Toner",
    brand: "The Derma Co",
    stores: [
      { name: "Nykaa", url: "#" },
      { name: "The Derma Co", url: "#" },
    ],
    priceInr: 595,
    keyIngredient: "Kojic Acid 2%, Niacinamide",
    suitableFor: ["oily", "combination", "normal"],
    category: "toner",
  },
  {
    id: "t4",
    name: "Watermelon Hyaluronic Toner",
    brand: "Dot & Key",
    stores: [
      { name: "Nykaa", url: "#" },
      { name: "Dot & Key", url: "#" },
    ],
    priceInr: 595,
    keyIngredient: "Watermelon Extract, Hyaluronic Acid",
    suitableFor: ["dry", "sensitive", "normal"],
    category: "toner",
  },

  // Serums
  {
    id: "s1",
    name: "10% Niacinamide + Zinc Serum",
    brand: "Minimalist",
    stores: [
      { name: "Minimalist", url: "#" },
      { name: "Amazon", url: "#" },
    ],
    priceInr: 599,
    keyIngredient: "Niacinamide 10%, Zinc",
    suitableFor: ["oily", "combination"],
    category: "serum",
  },
  {
    id: "s2",
    name: "Alpha Arbutin 2% + HA Serum",
    brand: "Minimalist",
    stores: [
      { name: "Minimalist", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 599,
    keyIngredient: "Alpha Arbutin 2%, Hyaluronic Acid",
    suitableFor: ["dry", "normal", "sensitive"],
    category: "serum",
  },
  {
    id: "s3",
    name: "10% Vitamin C Face Serum",
    brand: "The Derma Co",
    stores: [
      { name: "Nykaa", url: "#" },
      { name: "Amazon", url: "#" },
    ],
    priceInr: 799,
    keyIngredient: "Vitamin C 10%, Ferulic Acid",
    suitableFor: ["oily", "combination", "normal", "dry"],
    category: "serum",
  },
  {
    id: "s4",
    name: "Cica & Ceramide Barrier Serum",
    brand: "Dot & Key",
    stores: [
      { name: "Nykaa", url: "#" },
      { name: "Dot & Key", url: "#" },
    ],
    priceInr: 695,
    keyIngredient: "Centella Asiatica, Ceramides",
    suitableFor: ["sensitive", "dry"],
    category: "serum",
  },

  // Moisturizers
  {
    id: "m1",
    name: "Hydro Boost Water Gel",
    brand: "Neutrogena",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 899,
    keyIngredient: "Hyaluronic Acid, Glycerin",
    suitableFor: ["oily", "combination"],
    category: "moisturizer",
  },
  {
    id: "m2",
    name: "Moisturising Cream",
    brand: "CeraVe",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 1199,
    keyIngredient: "Ceramides, Hyaluronic Acid, Niacinamide",
    suitableFor: ["dry", "sensitive"],
    category: "moisturizer",
  },
  {
    id: "m3",
    name: "Multi-Peptide + HA Moisturizer",
    brand: "Minimalist",
    stores: [
      { name: "Minimalist", url: "#" },
      { name: "Amazon", url: "#" },
    ],
    priceInr: 699,
    keyIngredient: "5 Peptide Complex, Hyaluronic Acid",
    suitableFor: ["normal", "oily", "combination", "dry"],
    category: "moisturizer",
  },
  {
    id: "m4",
    name: "Moisturising Lotion",
    brand: "Cetaphil",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 499,
    keyIngredient: "Glycerin, Panthenol",
    suitableFor: ["sensitive", "normal"],
    category: "moisturizer",
  },

  // Sunscreens
  {
    id: "sp1",
    name: "SPF 50 PA++++ Sunscreen",
    brand: "Minimalist",
    stores: [
      { name: "Minimalist", url: "#" },
      { name: "Amazon", url: "#" },
    ],
    priceInr: 399,
    keyIngredient: "Avobenzone, Octisalate",
    suitableFor: ["oily", "combination"],
    category: "sunscreen",
  },
  {
    id: "sp2",
    name: "Ultra Matte SPF 50 PA++++",
    brand: "Re'equil",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 595,
    keyIngredient: "Tinosorb M, Zinc Oxide",
    suitableFor: ["oily", "combination"],
    category: "sunscreen",
  },
  {
    id: "sp3",
    name: "Ultra Sheer Dry-Touch SPF 50+",
    brand: "Neutrogena",
    stores: [
      { name: "Amazon", url: "#" },
      { name: "Nykaa", url: "#" },
    ],
    priceInr: 499,
    keyIngredient: "Helioplex Technology",
    suitableFor: ["dry", "normal", "sensitive"],
    category: "sunscreen",
  },
  {
    id: "sp4",
    name: "Aqua Ultra Light SPF 50 PA++++",
    brand: "The Derma Co",
    stores: [
      { name: "Nykaa", url: "#" },
      { name: "The Derma Co", url: "#" },
    ],
    priceInr: 849,
    keyIngredient: "Niacinamide, Hyaluronic Acid",
    suitableFor: ["combination", "normal", "dry"],
    category: "sunscreen",
  },
];

// ─── Routine Step Definitions ─────────────────────────────────────────────────

const STEPS_BY_COMPLEXITY: Record<3 | 4 | 5, RoutineStep[]> = {
  3: [
    { stepNumber: 1, label: "Cleanse",        emoji: "🧴", category: "cleanser",    when: "AM + PM" },
    { stepNumber: 2, label: "Moisturize",     emoji: "💧", category: "moisturizer", when: "AM + PM" },
    { stepNumber: 3, label: "Sun Protection", emoji: "☀️", category: "sunscreen",   when: "AM only" },
  ],
  4: [
    { stepNumber: 1, label: "Cleanse",        emoji: "🧴", category: "cleanser",    when: "AM + PM" },
    { stepNumber: 2, label: "Tone",           emoji: "✨", category: "toner",       when: "AM + PM" },
    { stepNumber: 3, label: "Moisturize",     emoji: "💧", category: "moisturizer", when: "AM + PM" },
    { stepNumber: 4, label: "Sun Protection", emoji: "☀️", category: "sunscreen",   when: "AM only" },
  ],
  5: [
    { stepNumber: 1, label: "Cleanse",        emoji: "🧴", category: "cleanser",    when: "AM + PM" },
    { stepNumber: 2, label: "Tone",           emoji: "✨", category: "toner",       when: "AM + PM" },
    { stepNumber: 3, label: "Treat (Serum)",  emoji: "💊", category: "serum",       when: "AM or PM" },
    { stepNumber: 4, label: "Moisturize",     emoji: "💧", category: "moisturizer", when: "AM + PM" },
    { stepNumber: 5, label: "Sun Protection", emoji: "☀️", category: "sunscreen",   when: "AM only" },
  ],
};

const COMPLEXITY_INFO: Record<3 | 4 | 5, { label: string; description: string; timeEstimate: string; color: string }> = {
  3: {
    label: "3-Step Essentials",
    description: "Perfect for beginners or busy schedules. Covers the three steps every dermatologist recommends.",
    timeEstimate: "~3 min/day",
    color: "indigo",
  },
  4: {
    label: "4-Step Balanced",
    description: "Adds a toner to prep skin for better absorption. Ideal for most skin types wanting noticeable results.",
    timeEstimate: "~5 min/day",
    color: "violet",
  },
  5: {
    label: "5-Step Complete",
    description: "Includes a targeted serum for your specific skin concerns. Maximum results for committed skincare.",
    timeEstimate: "~8 min/day",
    color: "purple",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProductsForStep(category: SampleProduct["category"], skinType: string | null): SampleProduct[] {
  const all = SAMPLE_PRODUCTS.filter((p) => p.category === category);
  if (!skinType) return all.slice(0, 2);
  const matching = all.filter((p) => p.suitableFor.includes(skinType));
  const rest = all.filter((p) => !p.suitableFor.includes(skinType));
  return [...matching, ...rest].slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SampleProductCard({ product, skinType }: { product: SampleProduct; skinType: string | null }) {
  const isMatch = skinType ? product.suitableFor.includes(skinType) : false;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isMatch && (
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full mb-1.5">
              <CheckCircle2 className="w-3 h-3" /> Best for your skin
            </span>
          )}
          <p className="text-sm font-bold text-gray-900 leading-tight">{product.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">{product.brand}</p>
        </div>
        <p className="text-sm font-bold text-gray-800 shrink-0">
          ₹{product.priceInr.toLocaleString("en-IN")}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Leaf className="w-3.5 h-3.5 text-green-500 shrink-0" />
        <span>
          <span className="font-medium text-gray-700">Key: </span>
          {product.keyIngredient}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 pt-0.5">
        {product.stores.map((store) => (
          <a
            key={store.name}
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-900 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {store.name}
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RoutineSelectorProps {
  skinType?: string | null;
}

export function RoutineSelector({ skinType }: RoutineSelectorProps) {
  const [steps, setSteps] = useState<3 | 4 | 5>(3);

  const currentSteps = STEPS_BY_COMPLEXITY[steps];
  const info = COMPLEXITY_INFO[steps];

  return (
    <section className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🛍️</span> Product Recommendations
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Choose a routine based on your lifestyle and how much time you can commit.
        </p>
      </div>

      {/* Complexity Picker */}
      <div className="grid grid-cols-3 gap-3">
        {([3, 4, 5] as const).map((n) => {
          const active = steps === n;
          return (
            <button
              key={n}
              onClick={() => setSteps(n)}
              className={[
                "rounded-2xl p-4 border-2 text-left transition-all duration-200",
                active
                  ? "border-indigo-500 bg-indigo-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50",
              ].join(" ")}
            >
              <p className={`text-3xl font-black leading-none ${active ? "text-indigo-600" : "text-gray-300"}`}>
                {n}
              </p>
              <p className={`text-xs font-bold mt-1 ${active ? "text-indigo-700" : "text-gray-500"}`}>
                steps
              </p>
              <p className={`text-xs mt-1.5 ${active ? "text-indigo-500" : "text-gray-400"}`}>
                {COMPLEXITY_INFO[n].timeEstimate}
              </p>
            </button>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-indigo-800">{info.label}</p>
        <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">{info.description}</p>
      </div>

      {/* Steps & Products */}
      <AnimatePresence mode="wait">
        <motion.div
          key={steps}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {currentSteps.map((step) => {
            const products = getProductsForStep(step.category, skinType ?? null);
            return (
              <div key={step.stepNumber}>
                {/* Step Header */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {step.stepNumber}
                  </div>
                  <span className="font-semibold text-gray-800 text-sm">
                    {step.emoji} {step.label}
                  </span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {step.when}
                  </span>
                </div>

                {/* Product Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {products.map((product, i) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <SampleProductCard product={product} skinType={skinType ?? null} />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Note */}
      <p className="text-xs text-gray-400 text-center pt-1">
        Sample catalog · Full personalized list coming soon once product database is configured.
      </p>
    </section>
  );
}
