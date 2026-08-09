"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { PostHogProvider } from "@/components/shared/posthog-provider";
import { CartProvider } from "@/lib/context/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <PostHogProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </PostHogProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
