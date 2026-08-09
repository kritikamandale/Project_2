"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  X,
  Trash2,
  ExternalLink,
  IndianRupee,
  CheckCircle2,
  Sparkles,
  Share2,
  ArrowRight,
} from "lucide-react";
import { useCart } from "@/lib/context/cart-context";
import { Button } from "@/components/ui/button";

export function CartDrawer() {
  const { cart, isOpen, setIsOpen, removeFromCart, clearCart, totalCost } = useCart();

  if (!isOpen) return null;

  function handleShare() {
    if (typeof window === "undefined") return;
    const names = cart.map((c) => `- ${c.product_name} (${c.brand}): ₹${c.price_inr ?? 0}`).join("\n");
    const text = `My Skinest Personalised Routine:\n${names}\nTotal: ₹${totalCost}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      alert("Copied your routine list to clipboard!");
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 bg-deep-brown/50 backdrop-blur-sm"
        />

        {/* Drawer Panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-screen max-w-md bg-cream text-deep-brown border-l border-deep-brown/15 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-5 border-b border-deep-brown/10 flex items-center justify-between bg-olive text-cream">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-butter text-deep-brown flex items-center justify-center font-bold text-xs shadow-xs">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-cream">My Routine Cart</h2>
                  <p className="text-[11px] font-sans text-cream/70 font-medium">
                    {cart.length} {cart.length === 1 ? "product" : "products"} selected
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-cream/10 text-cream transition-colors"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-olive/10 text-olive mx-auto flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-deep-brown">Your cart is empty</h3>
                  <p className="text-xs text-deep-brown/70 max-w-xs mx-auto leading-relaxed">
                    Add products from your Recommendations or Skincare Roadmap to keep track of your daily routine.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white border border-deep-brown/10 shadow-xs flex gap-3 relative group"
                  >
                    {/* Image / Fallback */}
                    <div className="w-14 h-14 rounded-xl bg-cream border border-deep-brown/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <Sparkles className="w-6 h-6 text-olive" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-olive bg-olive/10 px-2 py-0.5 rounded-full mb-1">
                        {item.category}
                      </span>
                      <h4 className="font-serif text-sm font-bold text-deep-brown truncate">
                        {item.product_name}
                      </h4>
                      <p className="text-xs text-deep-brown/60 font-medium">{item.brand}</p>
                      <p className="text-xs font-bold text-deep-brown mt-1">
                        ₹{(item.price_inr ?? 0).toLocaleString("en-IN")}
                      </p>

                      {/* Store buttons */}
                      {item.store_links && item.store_links.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {item.store_links.slice(0, 2).map((s) => (
                            <a
                              key={s.store}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-deep-brown text-cream px-2 py-1 rounded-md text-[10px] font-bold hover:bg-olive transition-colors"
                            >
                              {s.store} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-deep-brown/40 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-deep-brown/15 bg-white space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-deep-brown/70">Estimated Monthly Cost:</span>
                  <span className="font-serif text-xl font-bold text-deep-brown flex items-center">
                    <IndianRupee className="w-4 h-4" />
                    {totalCost.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleShare}
                    className="border-deep-brown/20 text-deep-brown hover:bg-cream font-bold text-xs rounded-xl"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Copy List
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs rounded-xl"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear All
                  </Button>
                </div>

                {cart[0]?.store_links?.[0]?.url && (
                  <Button
                    className="w-full bg-olive hover:bg-olive/90 text-cream font-bold text-xs rounded-xl py-3 shadow-md flex items-center justify-center gap-2"
                    asChild
                  >
                    <a href={cart[0].store_links[0].url} target="_blank" rel="noopener noreferrer">
                      Buy Selected Products <ArrowRight className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
