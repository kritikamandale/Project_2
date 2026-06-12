"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, ShieldCheck, ExternalLink } from "lucide-react";

const CONSENT_KEY = "skinai_cookie_consent";
const CONSENT_VERSION = "1";

type ConsentState = "pending" | "accepted" | "declined";

function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return "pending";
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return "pending";
    const { decision, version } = JSON.parse(stored);
    if (version !== CONSENT_VERSION) return "pending";
    return decision as ConsentState;
  } catch {
    return "pending";
  }
}

function storeConsent(decision: "accepted" | "declined") {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ decision, version: CONSENT_VERSION, timestamp: Date.now() })
  );
}

/** Sets non-essential tracking cookies (PostHog) only when consented. */
function applyConsent(decision: "accepted" | "declined") {
  if (typeof window === "undefined") return;
  if (decision === "accepted") {
    // PostHog opt-in
    if ((window as any).__posthog) {
      (window as any).__posthog.opt_in_capturing();
    }
  } else {
    // PostHog opt-out
    if ((window as any).__posthog) {
      (window as any).__posthog.opt_out_capturing();
    }
    // Remove any existing non-essential cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name.startsWith("ph_") || name.startsWith("_ga")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored === "pending") {
      // Delay 1s so it doesn't flash immediately on load
      const t = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(t);
    }
    applyConsent(stored === "accepted" ? "accepted" : "declined");
  }, []);

  function handleAccept() {
    storeConsent("accepted");
    applyConsent("accepted");
    setVisible(false);
  }

  function handleDecline() {
    storeConsent("declined");
    applyConsent("declined");
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-md"
          role="dialog"
          aria-label="Cookie consent"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-border bg-card shadow-2xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="rounded-xl bg-amber-100 dark:bg-amber-900/30 p-2 mt-0.5 shrink-0">
                <Cookie className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm mb-1">
                  We use cookies
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We use essential cookies for authentication and optional analytics
                  cookies (PostHog) to improve the platform. Biometric data from
                  your skin analysis is{" "}
                  <strong className="text-foreground">never</strong> tracked.
                </p>
              </div>
              <button
                onClick={handleDecline}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Decline and close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span>
                Your skin images are <strong>never stored</strong>. Read our{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Privacy Policy
                </a>
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDecline}
                className="flex-1 rounded-xl border border-border bg-background py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Essential only
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
