"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "@/lib/api/products";

export interface CartItem {
  id: string;
  product_name: string;
  brand: string;
  brand_display?: string | null;
  category: string;
  price_inr?: number | null;
  mrp_inr?: number | null;
  image_url?: string | null;
  match_score?: number | null;
  store_links?: Array<{ store: string; url: string }>;
  affiliate_url?: string | null;
}

interface CartContextType {
  cart: CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleCart: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  isInCart: (id: string) => boolean;
  clearCart: () => void;
  totalCost: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "skinest_routine_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch {
      /* ignore storage read error */
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      /* ignore storage write error */
    }
  }, [cart, mounted]);

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const isInCart = (id: string) => {
    return cart.some((i) => i.id === id);
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleCart = () => setIsOpen((prev) => !prev);

  const totalCost = cart.reduce((sum, item) => sum + (item.price_inr ?? 0), 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        setIsOpen,
        toggleCart,
        addToCart,
        removeFromCart,
        isInCart,
        clearCart,
        totalCost,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
