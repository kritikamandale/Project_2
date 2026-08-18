"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Persistent 3-step onboarding progress indicator.
// Uses the existing `skin-*` Tailwind tokens — no new palette.
// ---------------------------------------------------------------------------

const STEPS = [
  { key: "questionnaire", label: "Lifestyle Questionnaire" },
  { key: "scan", label: "Face Scan" },
  { key: "recommendations", label: "Recommendations" },
] as const;

function activeIndex(pathname: string): number {
  if (pathname.includes("/onboarding/scan")) return 1;
  if (pathname.includes("/onboarding/recommendations")) return 2;
  return 0; // questionnaire (default / first step)
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = activeIndex(pathname);

  return (
    <div className="h-dvh overflow-hidden bg-cream text-deep-brown flex flex-col font-sans">
      {/* Fixed progress bar sits above the fullscreen scan UI */}
      <header className="fixed top-0 inset-x-0 z-[60] bg-cream/95 backdrop-blur-md border-b border-deep-brown/10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-sans font-bold uppercase tracking-widest text-olive">
              Step {current + 1} of 3: <span className="text-deep-brown font-serif normal-case font-bold text-sm ml-1">{STEPS[current].label}</span>
            </p>
            <span className="text-[11px] font-sans font-bold text-deep-brown/60 bg-butter/40 px-2.5 py-0.5 rounded-full border border-deep-brown/10">
              Skinest AI Onboarding
            </span>
          </div>
          <ol className="flex items-center gap-3">
            {STEPS.map((step, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <li key={step.key} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div
                    className={[
                      "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all",
                      done
                        ? "bg-olive text-butter shadow-xs"
                        : active
                        ? "bg-butter text-deep-brown ring-2 ring-olive/40 font-extrabold shadow-xs"
                        : "bg-deep-brown/10 text-deep-brown/50",
                    ].join(" ")}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? <Check className="w-4 h-4 text-butter" /> : i + 1}
                  </div>
                  <span
                    className={[
                      "text-xs font-sans truncate hidden sm:inline",
                      active ? "text-deep-brown font-bold" : done ? "text-olive font-medium" : "text-deep-brown/40",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      className={[
                        "h-0.5 flex-1 rounded-full transition-colors",
                        done ? "bg-olive" : "bg-deep-brown/10",
                      ].join(" ")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {/* pt-[88px] offsets the fixed header */}
      <main className="flex-1 overflow-auto pt-[88px]">{children}</main>
    </div>
  );
}
