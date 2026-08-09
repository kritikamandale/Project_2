"use client";

import { useState } from "react";
import { toast } from "sonner";
import { progressApi } from "@/lib/api/progress";
import type { ProductEffectivenessItem, ProductRating } from "@/lib/api/progress";

import { ThumbsUp, HelpCircle, ThumbsDown } from "lucide-react";

interface Props {
  products: ProductEffectivenessItem[];
  onRated?: (productId: string, rating: ProductRating) => void;
}

const RATING_OPTIONS: { value: ProductRating; icon: React.ElementType; label: string }[] = [
  { value: "working", icon: ThumbsUp, label: "Working" },
  { value: "unsure", icon: HelpCircle, label: "Unsure" },
  { value: "not_working", icon: ThumbsDown, label: "Not working" },
];

const RATING_COLORS: Record<ProductRating, string> = {
  working: "bg-butter/20 border-olive text-deep-brown",
  unsure: "bg-nude/20 border-deep-brown/20 text-deep-brown",
  not_working: "bg-deep-brown/10 border-deep-brown/30 text-deep-brown",
};

function ProductCard({
  item,
  onRated,
}: {
  item: ProductEffectivenessItem;
  onRated?: (productId: string, rating: ProductRating) => void;
}) {
  const [rating, setRating] = useState<ProductRating | null>(item.user_rating ?? null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRate(r: ProductRating) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await progressApi.submitProductFeedback({
        product_id: item.product_id,
        rating: r,
      });
      setRating(r);
      onRated?.(item.product_id, r);
      toast.success("Feedback saved — thanks for helping improve recommendations.");
    } catch {
      toast.error("Could not save feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  const conditionLabel = item.targets_condition?.replace(/_/g, " ") ?? null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-800 text-sm leading-snug">{item.product_name}</p>
          <p className="text-xs text-zinc-400">{item.brand}</p>
        </div>
        {item.weeks_used != null && (
          <span className="shrink-0 text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
            {item.weeks_used}w used
          </span>
        )}
      </div>

      {/* Effectiveness insight */}
      {conditionLabel && item.condition_improvement_pct != null && (
        <p className="text-xs text-zinc-600 leading-relaxed">
          {item.highlighted_ingredient && (
            <span className="font-medium">{item.highlighted_ingredient}: </span>
          )}
          Your <span className="font-medium">{conditionLabel}</span>{" "}
          {item.condition_improvement_pct >= 0 ? "improved" : "changed"}{" "}
          <span
            className={
              item.condition_improvement_pct > 0 ? "text-teal-600 font-semibold" : "text-rose-500 font-semibold"
            }
          >
            {item.condition_improvement_pct > 0 ? "+" : ""}
            {item.condition_improvement_pct.toFixed(0)}%
          </span>{" "}
          in {item.weeks_used ?? "?"} weeks.
        </p>
      )}

      {/* Rating buttons */}
      <div className="flex gap-2 flex-wrap">
        {RATING_OPTIONS.map((opt) => {
          const IconComp = opt.icon;
          return (
            <button
              key={opt.value}
              disabled={submitting}
              onClick={() => handleRate(opt.value)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                rating === opt.value
                  ? RATING_COLORS[opt.value]
                  : "bg-cream border-deep-brown/15 text-deep-brown/70 hover:border-deep-brown/30",
                submitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProductFeedbackPanel({ products, onRated }: Props) {
  if (!products.length) {
    return (
      <p className="text-sm text-zinc-500 italic">
        Product data will appear after your first recommendation.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {products.map((p) => (
        <ProductCard key={p.product_id} item={p} onRated={onRated} />
      ))}
    </div>
  );
}
