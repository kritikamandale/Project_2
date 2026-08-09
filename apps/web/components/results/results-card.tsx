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

export function ResultsCard({
  product: p,
  phase,
  startWeek,
  highlightedIngredient,
  reasonText,
  index = 0,
}: ResultsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-cream border border-deep-brown/15 rounded-xl overflow-hidden shadow-sm font-sans"
    >
      <div className="p-4 bg-cream border-b border-deep-brown/10 flex items-start gap-3">
        <div className="w-14 h-14 shrink-0 rounded-xl bg-cream border border-deep-brown/10 overflow-hidden flex items-center justify-center">
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
            <Leaf className="w-5 h-5 text-olive" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[11px] font-sans uppercase font-bold px-2 py-0.5 rounded-full bg-butter/50 text-deep-brown border border-deep-brown/10">
                Phase {phase}
              </span>
              {p.is_dermatologist_approved && (
                <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-olive/10 text-olive flex items-center gap-1">
                  <Shield className="w-3 h-3 text-olive" /> Approved
                </span>
              )}
            </div>
            <h3 className="font-serif font-bold text-deep-brown text-base leading-tight">{p.product_name}</h3>
            <p className="text-xs text-deep-brown/70 capitalize mt-0.5">{p.brand} · {p.category}</p>
          </div>
          <div className="text-right shrink-0">
            {p.price_inr && (
              <p className="text-base font-serif font-bold text-deep-brown">₹{p.price_inr.toLocaleString("en-IN")}</p>
            )}
            {p.rating_avg != null && p.rating_avg > 0 && (
              <div className="flex items-center gap-1 justify-end mt-0.5">
                <Star className="w-3 h-3 text-olive fill-olive" />
                <span className="text-xs text-deep-brown/70">{p.rating_avg.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 text-xs">
        {highlightedIngredient && (
          <div className="flex items-center gap-1.5 text-deep-brown/80">
            <Leaf className="w-3.5 h-3.5 text-olive shrink-0" />
            Key Ingredient: <strong className="font-bold text-deep-brown">{highlightedIngredient}</strong>
          </div>
        )}
        {startWeek && (
          <div className="flex items-center gap-1.5 text-deep-brown/70">
            <Clock className="w-3.5 h-3.5 text-olive shrink-0" />
            Start week {startWeek}
          </div>
        )}
        {reasonText && (
          <p className="text-xs text-deep-brown/70 leading-relaxed">{reasonText}</p>
        )}
        {p.product_url && (
          <a
            href={p.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full mt-2 px-4 py-2.5 bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold text-xs rounded-xl border border-deep-brown/10 shadow-xs transition-colors"
          >
            Buy Now <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
