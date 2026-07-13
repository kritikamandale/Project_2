"use client";

import { Sun, Moon, Clock } from "lucide-react";
import type { LayeringPlan, LayerStep } from "@/lib/api/routine";

// ─── AM/PM layering guidance — the instructional layer marketplaces omit ───
// Compact, scannable rendering of the ordered application sequence returned
// by POST /products/routine-check, with wait-times and per-step notes.

function StepRow({ step, index }: { step: LayerStep; index: number }) {
  return (
    <li className="flex gap-3 py-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-xs font-bold text-gray-800">{step.step_label}</span>
          {step.product_name && (
            <span className="truncate text-xs text-gray-500">— {step.product_name}</span>
          )}
          {step.wait_minutes > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-400">
              <Clock className="w-2.5 h-2.5" aria-hidden /> wait {step.wait_minutes} min
            </span>
          )}
        </div>
        {step.note && <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{step.note}</p>}
      </div>
    </li>
  );
}

function RoutineColumn({ label, icon, steps }: { label: string; icon: React.ReactNode; steps: LayerStep[] }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-gray-700">
        {icon}
        {label}
      </div>
      {steps.length === 0 ? (
        <p className="py-2 text-xs text-gray-400">No steps in this routine yet.</p>
      ) : (
        <ol className="divide-y divide-gray-100">
          {steps.map((s, i) => (
            <StepRow key={`${s.step_label}-${i}`} step={s} index={i} />
          ))}
        </ol>
      )}
    </div>
  );
}

export function LayeringGuidanceCard({ layering }: { layering: LayeringPlan }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <h3 className="text-sm font-bold text-gray-900">How to layer this routine</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Thinnest to thickest, water before oil — the order that keeps actives working.
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <RoutineColumn label="Morning" icon={<Sun className="w-3.5 h-3.5 text-cream-600" aria-hidden />} steps={layering.am} />
        <div className="hidden w-px self-stretch bg-gray-100 sm:block" aria-hidden />
        <RoutineColumn label="Night" icon={<Moon className="w-3.5 h-3.5 text-skin-600" aria-hidden />} steps={layering.pm} />
      </div>
    </div>
  );
}
