"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ExternalLink, Leaf, ChevronDown, Check, X, Store, Wallet, Star,
  Layers, Sparkles, Tag, ArrowUpDown, AlertTriangle, Info, RotateCcw, MoreHorizontal,
  IndianRupee, Loader2,
} from "lucide-react";
import {
  listProducts,
  type Product,
  type ProductCategory,
  type ProductSort,
  type ListProductsParams,
} from "@/lib/api/products";
import {
  checkRoutine,
  optimiseRoutine,
  type RoutineCheckResponse,
  type OptimiseRoutineResponse,
} from "@/lib/api/routine";
import { LayeringGuidanceCard } from "./layering-guidance-card";
import { RoutineSafetyBanner } from "./routine-safety-banner";

// ─── Routine step definitions ──────────────────────────────────────────────
// Categories use the backend spelling (moisturiser). Steps mirror the 3/4/5
// grouping from the original design.

interface RoutineStep {
  stepNumber: number;
  label: string;
  emoji: string;
  category: ProductCategory;
  when: string;
}

const STEPS_BY_COMPLEXITY: Record<3 | 4 | 5, RoutineStep[]> = {
  3: [
    { stepNumber: 1, label: "Cleanse",        emoji: "🧴", category: "cleanser",    when: "AM + PM" },
    { stepNumber: 2, label: "Moisturize",     emoji: "💧", category: "moisturiser", when: "AM + PM" },
    { stepNumber: 3, label: "Sun Protection", emoji: "☀️", category: "sunscreen",   when: "AM only" },
  ],
  4: [
    { stepNumber: 1, label: "Cleanse",        emoji: "🧴", category: "cleanser",    when: "AM + PM" },
    { stepNumber: 2, label: "Tone",           emoji: "✨", category: "toner",       when: "AM + PM" },
    { stepNumber: 3, label: "Moisturize",     emoji: "💧", category: "moisturiser", when: "AM + PM" },
    { stepNumber: 4, label: "Sun Protection", emoji: "☀️", category: "sunscreen",   when: "AM only" },
  ],
  5: [
    { stepNumber: 1, label: "Cleanse",        emoji: "🧴", category: "cleanser",    when: "AM + PM" },
    { stepNumber: 2, label: "Tone",           emoji: "✨", category: "toner",       when: "AM + PM" },
    { stepNumber: 3, label: "Treat (Serum)",  emoji: "💊", category: "serum",       when: "AM or PM" },
    { stepNumber: 4, label: "Moisturize",     emoji: "💧", category: "moisturiser", when: "AM + PM" },
    { stepNumber: 5, label: "Sun Protection", emoji: "☀️", category: "sunscreen",   when: "AM only" },
  ],
};

const COMPLEXITY_INFO: Record<3 | 4 | 5, { label: string; description: string; timeEstimate: string }> = {
  3: {
    label: "3-Step Essentials",
    description: "Perfect for beginners or busy schedules. Covers the three steps every dermatologist recommends.",
    timeEstimate: "~3 min/day",
  },
  4: {
    label: "4-Step Balanced",
    description: "Adds a toner to prep skin for better absorption. Ideal for most skin types wanting noticeable results.",
    timeEstimate: "~5 min/day",
  },
  5: {
    label: "5-Step Complete",
    description: "Includes a targeted serum for your specific skin concerns. Maximum results for committed skincare.",
    timeEstimate: "~8 min/day",
  },
};

const PRODUCTS_PER_STEP = 3;
const VISIBLE_STORE_LINKS = 4;

// ─── Filter model ───────────────────────────────────────────────────────────

type Discount = "10" | "20" | "sale" | null;

interface Filters {
  maxPrice: number | null;
  brands: string[];
  minRating: number | null;
  packSize: number | null;
  isNew: boolean;
  discount: Discount;
  sort: ProductSort;
}

const DEFAULT_FILTERS: Filters = {
  maxPrice: null,
  brands: [],
  minRating: null,
  packSize: null,
  isNew: false,
  discount: null,
  sort: "match_score",
};

type OptionValue = string | number | null;
interface FilterOption { label: string; value: OptionValue }

const BUDGET_OPTIONS: FilterOption[] = [
  { label: "Under ₹200", value: 200 },
  { label: "Under ₹300", value: 300 },
  { label: "Under ₹500", value: 500 },
  { label: "Under ₹1000", value: 1000 },
  { label: "All", value: null },
];

const RATING_OPTIONS: FilterOption[] = [
  { label: "4★ & up", value: 4 },
  { label: "4.5★ & up", value: 4.5 },
  { label: "All", value: null },
];

const COMBO_OPTIONS: FilterOption[] = [
  { label: "Single", value: 1 },
  { label: "Pack of 2", value: 2 },
  { label: "Pack of 3", value: 3 },
  { label: "All", value: null },
];

const DISCOUNT_OPTIONS: FilterOption[] = [
  { label: "10% + off", value: "10" },
  { label: "20% + off", value: "20" },
  { label: "On sale", value: "sale" },
  { label: "All deals", value: null },
];

const SORT_OPTIONS: FilterOption[] = [
  { label: "Best match", value: "match_score" },
  { label: "Price: Low → High", value: "price_asc" },
  { label: "Price: High → Low", value: "price_desc" },
  { label: "Rating", value: "rating" },
  { label: "Biggest discount", value: "discount" },
  { label: "Newest", value: "newest" },
];

function labelFor(options: FilterOption[], value: OptionValue): string {
  return options.find((o) => o.value === value)?.label ?? "";
}

function filtersToParams(filters: Filters): Partial<ListProductsParams> {
  return {
    max_price: filters.maxPrice ?? undefined,
    brand: filters.brands.length ? filters.brands : undefined,
    min_rating: filters.minRating ?? undefined,
    pack_size: filters.packSize ?? undefined,
    is_new: filters.isNew || undefined,
    min_discount_pct: filters.discount === "10" ? 10 : filters.discount === "20" ? 20 : undefined,
    on_sale: filters.discount === "sale" ? true : undefined,
    sort: filters.sort,
  };
}

// ─── Loading messages (contextual, reused AI-loading pattern) ───────────────

const LOADING_MESSAGES = [
  "Scoring products for your skin type…",
  "Checking your climate and concerns…",
  "Ranking your best matches…",
  "Fetching honest store links…",
];

// ─── Small style helpers ────────────────────────────────────────────────────

function chipClass(active: boolean): string {
  return [
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5",
    "text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-skin-400",
    active
      ? "border-skin-300 bg-skin-50 text-skin-700"
      : "border-gray-200 bg-white text-gray-600 hover:border-skin-200 hover:bg-gray-50",
  ].join(" ");
}

const MENU_CONTENT =
  "z-40 min-w-[11rem] rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg " +
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95";

const MENU_ITEM =
  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs " +
  "font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50";

// ─── Filter controls ────────────────────────────────────────────────────────

function SelectFilter({
  label, icon, options, value, defaultValue, onSelect,
}: {
  label: string;
  icon: ReactNode;
  options: FilterOption[];
  value: OptionValue;
  defaultValue: OptionValue;
  onSelect: (v: OptionValue) => void;
}) {
  const active = value !== defaultValue;
  const display = active ? labelFor(options, value) : label;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={chipClass(active)} aria-label={`${label} filter`}>
          {icon}
          <span>{display}</span>
          <ChevronDown className="w-3 h-3 opacity-60" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" className={MENU_CONTENT}>
          {options.map((o) => (
            <Popover.Close asChild key={String(o.value)}>
              <button className={MENU_ITEM} onClick={() => onSelect(o.value)}>
                <span>{o.label}</span>
                {o.value === value && <Check className="w-3.5 h-3.5 text-skin-600" aria-hidden />}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BrandFilter({
  brands, selected, onToggle,
}: {
  brands: string[];
  selected: string[];
  onToggle: (brand: string) => void;
}) {
  const active = selected.length > 0;
  const display = active
    ? `Brand · ${selected.length}`
    : "Brand";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className={chipClass(active)} aria-label="Brand filter">
          <Store className="w-3.5 h-3.5" aria-hidden />
          <span>{display}</span>
          <ChevronDown className="w-3 h-3 opacity-60" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} align="start" className={`${MENU_CONTENT} max-h-72 overflow-y-auto`}>
          {brands.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No brands available</p>
          ) : (
            brands.map((b) => {
              const checked = selected.includes(b);
              return (
                <button
                  key={b}
                  role="checkbox"
                  aria-checked={checked}
                  className={MENU_ITEM}
                  onClick={() => onToggle(b)}
                >
                  <span className="truncate">{b}</span>
                  <span
                    className={[
                      "grid h-4 w-4 shrink-0 place-items-center rounded border",
                      checked ? "border-skin-500 bg-skin-500 text-white" : "border-gray-300 bg-white",
                    ].join(" ")}
                    aria-hidden
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ToggleChip({
  label, icon, active, onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={chipClass(active)} aria-pressed={active} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Match Score + safety flags ─────────────────────────────────────────────

function matchTone(score: number): { badge: string; dot: string } {
  if (score >= 80) return { badge: "bg-teal-100 text-teal-700", dot: "bg-teal-500" };
  if (score >= 60) return { badge: "bg-cream-200 text-cream-800", dot: "bg-cream-500" };
  return { badge: "bg-skin-100 text-skin-700", dot: "bg-skin-500" };
}

function MatchScoreBadge({ score }: { score: number }) {
  const tone = matchTone(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${tone.badge}`}
      title={`${score}% match for your skin profile`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {score}% match
    </span>
  );
}

const FLAG_META: Record<string, { label: string; warn: boolean }> = {
  comedogenic:       { label: "May clog pores", warn: true },
  contains_allergen: { label: "Contains a listed allergen", warn: true },
  pregnancy_unsafe:  { label: "Not recommended in pregnancy", warn: true },
  fragrance:         { label: "Fragrance", warn: false },
};

function SafetyFlag({ code, message }: { code: string; message: string }) {
  const meta = FLAG_META[code] ?? { label: code, warn: true };
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          className={[
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            meta.warn
              ? "bg-cream-100 text-cream-800 focus-visible:ring-cream-400"
              : "bg-gray-100 text-gray-600 focus-visible:ring-gray-300",
          ].join(" ")}
          aria-label={`${meta.label}: ${message}`}
        >
          {meta.warn ? <AlertTriangle className="w-3 h-3" aria-hidden /> : <Info className="w-3 h-3" aria-hidden />}
          {meta.label}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={5}
          className="z-50 max-w-[15rem] rounded-lg bg-gray-800 px-3 py-2 text-xs leading-snug text-eggshell shadow-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {message}
          <Tooltip.Arrow className="fill-gray-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ─── Store links ────────────────────────────────────────────────────────────

function storeLinkClass() {
  return "inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-skin-400";
}

function StoreLinks({ links }: { links: Product["store_links"] }) {
  if (!links || links.length === 0) return null;
  const visible = links.slice(0, VISIBLE_STORE_LINKS);
  const overflow = links.slice(VISIBLE_STORE_LINKS);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((s) => (
        <a
          key={s.store}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className={storeLinkClass()}
        >
          {s.store}
          <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      ))}
      {overflow.length > 0 && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-skin-400"
              aria-label={`${overflow.length} more stores`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
              More
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content sideOffset={6} align="end" className={MENU_CONTENT}>
              {overflow.map((s) => (
                <a
                  key={s.store}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={MENU_ITEM}
                >
                  <span>{s.store}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" aria-hidden />
                </a>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}

// ─── Product card ───────────────────────────────────────────────────────────

function brandLabel(p: Product): string {
  if (p.brand_display) return p.brand_display;
  const map: Record<string, string> = {
    nykaa: "Nykaa", minimalist: "Minimalist", dermaco: "The Derma Co", others: "Other",
  };
  return map[p.brand] ?? p.brand;
}

function heroIngredient(p: Product): string | null {
  return p.key_actives?.[0] ?? p.key_ingredients?.[0] ?? null;
}

function ProductCard({ product }: { product: Product }) {
  const p = product;
  const hero = heroIngredient(p);
  const hasDiscount = p.mrp_inr != null && p.price_inr != null && p.mrp_inr > p.price_inr;

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl glass-card glass-shimmer p-4">
      {/* Match score + combo/new badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {p.match_score != null && <MatchScoreBadge score={p.match_score} />}
        {p.pack_size > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            <Layers className="w-3 h-3" aria-hidden /> Pack of {p.pack_size}
          </span>
        )}
        {p.is_new && (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
            <Sparkles className="w-3 h-3" aria-hidden /> New
          </span>
        )}
      </div>

      {/* Photo + Name + brand + price */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 gap-3">
          {/* Product photo — floats inside its own small glass frame. */}
          <div className="h-12 w-12 shrink-0 rounded-lg glass-card overflow-hidden flex items-center justify-center">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.product_name}
                className="h-full w-full object-contain p-1"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <Leaf className="h-4 w-4 text-teal-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-card text-sm font-bold leading-tight text-gray-900">{p.product_name}</p>
            <p className="font-card mt-0.5 text-xs font-medium text-gray-500">{brandLabel(p)}</p>
            {p.match_reason && (
              <p className="font-card mt-1.5 text-xs leading-relaxed text-gray-500">{p.match_reason}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {p.price_inr != null && (
            <p className="font-card text-sm font-bold text-gray-900">
              ₹{p.price_inr.toLocaleString("en-IN")}
            </p>
          )}
          {hasDiscount && (
            <div className="flex items-center justify-end gap-1">
              <span className="font-card text-[11px] text-gray-400 line-through">
                ₹{p.mrp_inr!.toLocaleString("en-IN")}
              </span>
              {p.discount_pct != null && (
                <span className="text-[11px] font-bold text-teal-600">{p.discount_pct}% off</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Key ingredient */}
      {hero && (
        <div className="font-card flex items-center gap-1.5 text-xs text-gray-500">
          <Leaf className="w-3.5 h-3.5 shrink-0 text-teal-500" aria-hidden />
          <span>
            <span className="font-medium text-gray-700">Key: </span>
            {hero}
          </span>
        </div>
      )}

      {/* Safety flags */}
      {p.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.flags.map((f) => (
            <SafetyFlag key={f.code} code={f.code} message={f.message} />
          ))}
        </div>
      )}

      {/* Store links */}
      <div className="mt-auto pt-0.5">
        <StoreLinks links={p.store_links} />
      </div>
    </div>
  );
}

// ─── Skeleton + empty states ────────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-xl border border-gray-100 bg-white p-4">
      <div className="h-4 w-24 rounded-full bg-gray-100" />
      <div className="space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-gray-100" />
        <div className="h-3 w-1/3 rounded bg-gray-100" />
      </div>
      <div className="h-3 w-2/3 rounded bg-gray-100" />
      <div className="flex gap-2 pt-1">
        <div className="h-7 w-16 rounded-lg bg-gray-100" />
        <div className="h-7 w-16 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}

function LoadingState() {
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMsg((m) => (m + 1) % LOADING_MESSAGES.length), 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="h-2 w-2 animate-ping rounded-full bg-skin-400" aria-hidden />
        <AnimatePresence mode="wait">
          <motion.span
            key={msg}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {LOADING_MESSAGES[msg]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
      </div>
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
      <p className="text-3xl">🔍</p>
      <p className="mt-2 text-sm font-semibold text-gray-700">
        No products match all filters
      </p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-gray-500">
        Try relaxing your budget or rating — or clear the filters to see every match for your skin.
      </p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-skin-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-skin-600"
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Clear all filters
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-400" aria-hidden />
      <p className="text-sm font-semibold text-red-800">Couldn&apos;t load products</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-red-600">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600"
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Try again
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface RoutineSelectorProps {
  skinType?: string | null;
  fitzpatrick?: string | null;
  condition?: string | null;
  climateZone?: string | null;
  scanId?: string | null;
  questionnaireId?: string | null;
  pregnant?: boolean;
}

export function RoutineSelector({
  skinType,
  fitzpatrick,
  condition,
  climateZone,
  scanId,
  questionnaireId,
  pregnant = false,
}: RoutineSelectorProps) {
  const [steps, setSteps] = useState<3 | 4 | 5>(3);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [products, setProducts] = useState<Product[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // "Fit my routine under ₹X" — the budget optimiser (Phase 3.2/3.3).
  const [budgetDraft, setBudgetDraft] = useState("");
  const [optimiseResult, setOptimiseResult] = useState<OptimiseRoutineResponse | null>(null);
  const [optimiseStatus, setOptimiseStatus] = useState<"idle" | "loading" | "error">("idle");
  const [optimiseError, setOptimiseError] = useState("");

  // Whole-routine reasoning (Phase 3.1) — conflicts, duplicate actives, gaps, layering.
  const [routineCheck, setRoutineCheck] = useState<RoutineCheckResponse | null>(null);

  const brandsKey = filters.brands.join(",");

  // A budget fit is only valid for the step-count it was computed against —
  // changing the 3/4/5 picker invalidates it rather than showing a mismatch.
  useEffect(() => {
    setOptimiseResult(null);
  }, [steps]);

  const runOptimiser = async () => {
    const budget = Number(budgetDraft);
    if (!budget || budget <= 0) return;
    setOptimiseStatus("loading");
    try {
      const res = await optimiseRoutine({
        budget_inr: budget,
        steps,
        skin_type: skinType ?? undefined,
        condition: condition ?? undefined,
        climate_zone: climateZone ?? undefined,
        fitzpatrick: fitzpatrick ?? undefined,
        scan_id: scanId ?? undefined,
        questionnaire_id: questionnaireId ?? undefined,
        pregnant,
      });
      setOptimiseResult(res);
      setOptimiseStatus("idle");
    } catch (e) {
      setOptimiseError(e instanceof Error ? e.message : "Couldn't fit a routine to that budget.");
      setOptimiseStatus("error");
    }
  };

  const clearOptimiser = () => {
    setOptimiseResult(null);
    setBudgetDraft("");
    setOptimiseStatus("idle");
  };

  // Debounced, race-safe fetch on any context/filter change.
  useEffect(() => {
    let cancelled = false;
    setStatus((s) => (s === "ready" ? "ready" : "loading"));

    const timer = setTimeout(async () => {
      const params: ListProductsParams = {
        skin_type: skinType ?? undefined,
        condition: condition ?? undefined,
        climate_zone: climateZone ?? undefined,
        fitzpatrick: fitzpatrick ?? undefined,
        scan_id: scanId ?? undefined,
        questionnaire_id: questionnaireId ?? undefined,
        pregnant,
        page_size: 100,
        ...filtersToParams(filters),
      };
      try {
        const res = await listProducts(params);
        if (cancelled) return;
        setProducts(res.items);
        // Keep the brand list stable — only refresh from an unfiltered-by-brand
        // response so selecting a brand never empties the dropdown.
        if (filters.brands.length === 0) {
          const distinct = Array.from(
            new Set(res.items.map((p) => brandLabel(p)).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));
          setAllBrands(distinct);
        }
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("error");
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    skinType, condition, climateZone, fitzpatrick, scanId, questionnaireId, pregnant,
    filters.maxPrice, brandsKey, filters.minRating, filters.packSize,
    filters.isNew, filters.discount, filters.sort, retryKey,
  ]);

  const currentSteps = STEPS_BY_COMPLEXITY[steps];
  const info = COMPLEXITY_INFO[steps];

  // Group the scored catalogue into routine steps (top N per category). When
  // a budget fit is active, each step shows only the optimiser's single pick
  // (or nothing, if that step was dropped to stay under budget) instead of
  // the normal top-3 browse.
  const grouped = useMemo(() => {
    if (optimiseResult) {
      return currentSteps.map((step) => {
        const picked = optimiseResult.steps.find((s) => s.category === step.category)?.product;
        return { step, items: picked ? [picked] : [] };
      });
    }
    const byCategory = new Map<ProductCategory, Product[]>();
    for (const p of products) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }
    return currentSteps.map((step) => ({
      step,
      items: (byCategory.get(step.category) ?? []).slice(0, PRODUCTS_PER_STEP),
    }));
  }, [products, currentSteps, optimiseResult]);

  const visibleCount = grouped.reduce((sum, g) => sum + g.items.length, 0);

  // The routine currently "on screen" — the optimiser's picks, or otherwise
  // the top match per step — drives the whole-routine safety reasoning
  // (conflicts / duplicate actives / gaps / AM-PM layering).
  const activeProductIds = useMemo(
    () => grouped.map((g) => g.items[0]?.id).filter((id): id is string => Boolean(id)),
    [grouped]
  );
  const activeIdsKey = activeProductIds.join(",");

  useEffect(() => {
    if (activeProductIds.length === 0) {
      setRoutineCheck(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await checkRoutine(activeProductIds);
        if (!cancelled) setRoutineCheck(res);
      } catch {
        if (!cancelled) setRoutineCheck(null);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsKey]);
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const clearAll = () => setFilters(DEFAULT_FILTERS);

  // Active-filter descriptors for the summary row.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.maxPrice != null)
    activeChips.push({ key: "budget", label: labelFor(BUDGET_OPTIONS, filters.maxPrice), clear: () => setFilters((f) => ({ ...f, maxPrice: null })) });
  for (const b of filters.brands)
    activeChips.push({ key: `brand-${b}`, label: b, clear: () => setFilters((f) => ({ ...f, brands: f.brands.filter((x) => x !== b) })) });
  if (filters.minRating != null)
    activeChips.push({ key: "rating", label: labelFor(RATING_OPTIONS, filters.minRating), clear: () => setFilters((f) => ({ ...f, minRating: null })) });
  if (filters.packSize != null)
    activeChips.push({ key: "combo", label: labelFor(COMBO_OPTIONS, filters.packSize), clear: () => setFilters((f) => ({ ...f, packSize: null })) });
  if (filters.isNew)
    activeChips.push({ key: "new", label: "Newly added", clear: () => setFilters((f) => ({ ...f, isNew: false })) });
  if (filters.discount != null)
    activeChips.push({ key: "discount", label: labelFor(DISCOUNT_OPTIONS, filters.discount), clear: () => setFilters((f) => ({ ...f, discount: null })) });
  if (filters.sort !== "match_score")
    activeChips.push({ key: "sort", label: labelFor(SORT_OPTIONS, filters.sort), clear: () => setFilters((f) => ({ ...f, sort: "match_score" })) });

  return (
    <Tooltip.Provider delayDuration={120}>
      <section className="space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>🛍️</span> Product Recommendations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Personalised for your skin — choose a routine depth that fits your lifestyle.
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
                aria-pressed={active}
                className={[
                  "rounded-2xl p-4 border-2 text-left transition-all duration-200",
                  active
                    ? "border-skin-500 bg-skin-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-skin-200 hover:bg-gray-50",
                ].join(" ")}
              >
                <p className={`text-3xl font-black leading-none ${active ? "text-skin-600" : "text-gray-300"}`}>{n}</p>
                <p className={`text-xs font-bold mt-1 ${active ? "text-skin-700" : "text-gray-500"}`}>steps</p>
                <p className={`text-xs mt-1.5 ${active ? "text-skin-500" : "text-gray-400"}`}>
                  {COMPLEXITY_INFO[n].timeEstimate}
                </p>
              </button>
            );
          })}
        </div>

        {/* Info Banner */}
        <div className="bg-skin-50 border border-skin-100 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-skin-800">{info.label}</p>
          <p className="text-xs text-skin-600 mt-0.5 leading-relaxed">{info.description}</p>
        </div>

        {/* ── "Fit my routine under ₹X" — budget optimiser (Phase 3.3) ── */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <IndianRupee className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden />
            <span className="shrink-0 text-xs font-semibold text-gray-700">Fit my routine under</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="e.g. 800"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runOptimiser()}
              className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-skin-400"
              aria-label="Budget in rupees"
            />
            <button
              onClick={runOptimiser}
              disabled={optimiseStatus === "loading" || !budgetDraft}
              className="inline-flex items-center gap-1.5 rounded-lg bg-skin-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-skin-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {optimiseStatus === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
              Fit it
            </button>
            {optimiseResult && (
              <button
                onClick={clearOptimiser}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
              >
                <RotateCcw className="w-3 h-3" aria-hidden /> Reset
              </button>
            )}
          </div>
          {optimiseStatus === "error" && (
            <p className="text-xs font-medium text-red-600">{optimiseError}</p>
          )}
          <AnimatePresence>
            {optimiseResult && (
              <motion.div
                key="optimise-summary"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden rounded-xl border border-teal-200 bg-teal-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-teal-800">
                    Routine total ₹{optimiseResult.total_cost_inr.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs font-semibold text-teal-600">
                    ₹{optimiseResult.cost_per_day_inr.toFixed(2)}/day
                  </p>
                </div>
                {optimiseResult.drop_suggestion && (
                  <p className="mt-1 text-xs font-medium text-teal-700">{optimiseResult.drop_suggestion}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Sticky filter bar ── */}
        <div className="sticky top-14 z-10 -mx-4 border-y border-gray-100 bg-eggshell/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-eggshell/80">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Product filters"
          >
            <SelectFilter
              label="Budget" icon={<Wallet className="w-3.5 h-3.5" aria-hidden />}
              options={BUDGET_OPTIONS} value={filters.maxPrice} defaultValue={null}
              onSelect={(v) => setFilters((f) => ({ ...f, maxPrice: v as number | null }))}
            />
            <BrandFilter
              brands={allBrands} selected={filters.brands}
              onToggle={(b) => setFilters((f) => ({
                ...f,
                brands: f.brands.includes(b) ? f.brands.filter((x) => x !== b) : [...f.brands, b],
              }))}
            />
            <SelectFilter
              label="Rating" icon={<Star className="w-3.5 h-3.5" aria-hidden />}
              options={RATING_OPTIONS} value={filters.minRating} defaultValue={null}
              onSelect={(v) => setFilters((f) => ({ ...f, minRating: v as number | null }))}
            />
            <SelectFilter
              label="Combos" icon={<Layers className="w-3.5 h-3.5" aria-hidden />}
              options={COMBO_OPTIONS} value={filters.packSize} defaultValue={null}
              onSelect={(v) => setFilters((f) => ({ ...f, packSize: v as number | null }))}
            />
            <ToggleChip
              label="Newly added" icon={<Sparkles className="w-3.5 h-3.5" aria-hidden />}
              active={filters.isNew}
              onClick={() => setFilters((f) => ({ ...f, isNew: !f.isNew }))}
            />
            <SelectFilter
              label="Discount" icon={<Tag className="w-3.5 h-3.5" aria-hidden />}
              options={DISCOUNT_OPTIONS} value={filters.discount} defaultValue={null}
              onSelect={(v) => setFilters((f) => ({ ...f, discount: v as Discount }))}
            />
            <span className="mx-0.5 h-5 w-px shrink-0 bg-gray-200" aria-hidden />
            <SelectFilter
              label="Sort" icon={<ArrowUpDown className="w-3.5 h-3.5" aria-hidden />}
              options={SORT_OPTIONS} value={filters.sort} defaultValue="match_score"
              onSelect={(v) => setFilters((f) => ({ ...f, sort: v as ProductSort }))}
            />
          </div>

          {/* Active filters summary */}
          {activeChips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  onClick={c.clear}
                  className="inline-flex items-center gap-1 rounded-full bg-skin-100 px-2 py-0.5 text-[11px] font-medium text-skin-700 hover:bg-skin-200"
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <X className="w-3 h-3" aria-hidden />
                </button>
              ))}
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── Whole-routine safety banner (Phase 3.5) ── */}
        {routineCheck && (
          <RoutineSafetyBanner
            conflicts={routineCheck.conflicts}
            duplicateActives={routineCheck.duplicate_actives}
            gaps={routineCheck.gaps}
          />
        )}

        {/* ── Content ── */}
        {status === "error" ? (
          <ErrorState message={errorMsg} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : status === "loading" ? (
          <LoadingState />
        ) : visibleCount === 0 ? (
          <EmptyState onClear={clearAll} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${steps}-${optimiseResult ? "optimised" : "browse"}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {grouped.map(({ step, items }) => (
                <div key={step.stepNumber}>
                  {/* Step Header */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-full bg-skin-100 text-skin-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {step.stepNumber}
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">
                      {step.emoji} {step.label}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {step.when}
                    </span>
                  </div>

                  {/* Product cards */}
                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3 text-xs text-gray-400">
                      {optimiseResult?.drop_suggestion?.includes(step.category)
                        ? `Skipped to stay under budget — ${step.label.toLowerCase()} was the most optional step.`
                        : optimiseResult
                        ? `No ${step.label.toLowerCase()} products are available to fit this routine.`
                        : `No ${step.label.toLowerCase()} products match your filters — try relaxing budget or rating.`}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AnimatePresence mode="popLayout">
                        {items.map((product, i) => (
                          <motion.div
                            key={product.id}
                            layout
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ delay: i * 0.07 }}
                          >
                            <ProductCard product={product} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── AM/PM layering guidance (Phase 3.4) ── */}
        {routineCheck && <LayeringGuidanceCard layering={routineCheck.layering} />}
      </section>
    </Tooltip.Provider>
  );
}
