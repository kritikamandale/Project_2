"use client";

import { useEffect, useState } from "react";
import { X, ShieldAlert } from "lucide-react";
import type { ConflictPair, DuplicateActive, RoutineGap } from "@/lib/api/routine";

// ─── Whole-routine safety banner ───────────────────────────────────────────
// Surfaces duplicate actives, ingredient conflicts, and essential gaps in one
// non-alarming, dismissible-per-session banner — the reasoning layer no
// marketplace offers, sitting just above the routine.

const SESSION_KEY = "routine-safety-banner-dismissed";

interface Props {
  conflicts: ConflictPair[];
  duplicateActives: DuplicateActive[];
  gaps: RoutineGap[];
}

function buildMessages(conflicts: ConflictPair[], duplicateActives: DuplicateActive[], gaps: RoutineGap[]): string[] {
  const messages: string[] = [];
  for (const g of gaps) messages.push(g.message);
  for (const d of duplicateActives) messages.push(`You're stacking ${d.product_names.length} ${d.active} products — one is enough.`);
  for (const c of conflicts) messages.push(`Don't layer ${c.active_a} and ${c.active_b} the same time — ${c.reason.replace(/\.$/, "").toLowerCase()}.`);
  return messages;
}

export function RoutineSafetyBanner({ conflicts, duplicateActives, gaps }: Props) {
  const [dismissed, setDismissed] = useState(true); // default hidden until we check sessionStorage (avoids SSR flash)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(SESSION_KEY) === "1");
  }, []);

  const messages = buildMessages(conflicts, duplicateActives, gaps);
  if (dismissed || messages.length === 0) return null;

  const hasUrgent = gaps.some((g) => g.code === "missing_sunscreen") || conflicts.length > 0;

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-xl border backdrop-blur-md px-4 py-3",
        hasUrgent ? "border-skin-200/60 bg-skin-50/70" : "border-teal-200/60 bg-teal-50/70",
      ].join(" ")}
      role="status"
    >
      <ShieldAlert
        className={`mt-0.5 h-4 w-4 shrink-0 ${hasUrgent ? "text-skin-600" : "text-teal-600"}`}
        aria-hidden
      />
      <ul className="min-w-0 flex-1 space-y-1">
        {messages.map((m, i) => (
          <li key={i} className={`text-xs leading-snug ${hasUrgent ? "text-skin-800" : "text-teal-800"}`}>
            {m}
          </li>
        ))}
      </ul>
      <button
        onClick={dismiss}
        className={`shrink-0 rounded-md p-1 hover:bg-white/60 focus:outline-none focus-visible:ring-2 ${
          hasUrgent ? "text-skin-500 focus-visible:ring-skin-400" : "text-teal-500 focus-visible:ring-teal-400"
        }`}
        aria-label="Dismiss safety notes"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
