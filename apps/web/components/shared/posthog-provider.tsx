"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

// PostHog is initialised ONLY after the user accepts analytics cookies.
// Call initPostHog() from the cookie-consent acceptance handler.
export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (posthog.__loaded) return; // already initialised
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    capture_pageview: false,
    respect_dnt: true,
  });
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Respect previously stored consent decision so the page-load
    // after consent doesn't silently skip initialisation.
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cookie-consent");
        if (stored === "accepted") initPostHog();
      } catch {
        // localStorage may be unavailable (e.g. private mode in some browsers)
      }
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
