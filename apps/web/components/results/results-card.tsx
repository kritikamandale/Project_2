"use client";

import { motion } from "framer-motion";
import { ExternalLink, Star, Shield, Clock, Leaf } from "lucide-react";

interface Product {
  id: string;
  brand: string;
  product_name: string;
  category: string;
  price_inr?: number;
  product_url?: string;
  image_url?: string | null;
  rating_avg?: number;
  is_dermatologist_approved?: boolean;
}

interface ResultsCardProps {
  product: Product;
  phase: number;
  startWeek?: number;
  highlightedIngredient?: string;
  reasonText?: string;
  index?: number;
}

const PHASE_STYLES: Record<number, { bg: string; badge: string }> = {
  1: { bg: "bg-teal-50/40",  badge: "bg-teal-100/80 text-teal-700" },
  2: { bg: "bg-skin-50/40",  badge: "bg-skin-100/80 text-skin-700" },
  3: { bg: "bg-cream-50/40", badge: "bg-cream-100/80 text-cream-800" },
};

export function ResultsCard({
  product: p,
  phase,
  startWeek,
  highlightedIngredient,
  reasonText,
  index = 0,
}: ResultsCardProps) {
  const style = PHASE_STYLES[phase] ?? PHASE_STYLES[1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="glass-card glass-shimmer rounded-2xl overflow-hidden"
    >
      <div className={`${style.bg} backdrop-blur-sm px-4 pt-4 pb-3 flex items-start gap-3`}>
        {/* Product photo — floats inside its own small glass frame so the
            gradient background peeks through around the packshot. */}
        <div className="w-14 h-14 shrink-0 rounded-xl glass-card overflow-hidden flex items-center justify-center">
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image_url}
              alt={p.product_name}
              className="w-full h-full object-contain p-1"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <Leaf className="w-5 h-5 text-teal-400" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                Phase {phase}
              </span>
              {p.is_dermatologist_approved && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Approved
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight">{p.product_name}</h3>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{p.brand} · {p.category}</p>
          </div>
          <div className="text-right shrink-0">
            {p.price_inr && (
              <p className="text-base font-bold text-gray-900">₹{p.price_inr.toLocaleString("en-IN")}</p>
            )}
            {p.rating_avg != null && p.rating_avg > 0 && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs text-gray-500">{p.rating_avg.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {highlightedIngredient && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Leaf className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            Key: <strong className="ml-0.5">{highlightedIngredient}</strong>
          </div>
        )}
        {startWeek && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Start week {startWeek}
          </div>
        )}
        {reasonText && (
          <p className="text-xs text-gray-500 leading-relaxed">{reasonText}</p>
        )}
        {p.product_url && (
          <a
            href={p.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full mt-1 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Buy now <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
