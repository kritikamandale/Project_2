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
    <div className="h-dvh overflow-hidden bg-gray-50 flex flex-col">
      {/* Fixed progress bar sits above the fullscreen scan UI (z-60 > camera z-50) */}
      <header className="fixed top-0 inset-x-0 z-[60] bg-white/95 backdrop-blur border-b border-skin-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <p className="text-xs font-medium text-skin-600 mb-2">
            Step {current + 1} of 3: {STEPS[current].label}
          </p>
          <ol className="flex items-center gap-2">
            {STEPS.map((step, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <li key={step.key} className="flex items-center gap-2 flex-1 last:flex-none">
                  <div
                    className={[
                      "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors",
                      done
                        ? "bg-skin-500 text-white"
                        : active
                        ? "bg-gradient-to-br from-skin-400 to-skin-600 text-white ring-2 ring-skin-200"
                        : "bg-gray-100 text-gray-400",
                    ].join(" ")}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span
                    className={[
                      "text-xs hidden sm:inline truncate",
                      active ? "text-skin-800 font-medium" : "text-gray-400",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span
                      className={[
                        "h-0.5 flex-1 rounded-full transition-colors",
                        done ? "bg-skin-500" : "bg-gray-200",
                      ].join(" ")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {/* pt-[88px] offsets the fixed header (py-3 + text line + ol ≈ 88px) */}
      <main className="flex-1 overflow-hidden pt-[88px]">{children}</main>
    </div>
  );
}
