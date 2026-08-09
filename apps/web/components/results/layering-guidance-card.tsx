"use client";

import { Sun, Moon, Clock, Sparkles } from "lucide-react";
import type { LayeringPlan, LayerStep } from "@/lib/api/routine";

function StepRow({ step, index }: { step: LayerStep; index: number }) {
  return (
    <li className="flex gap-3 py-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-butter text-deep-brown text-[11px] font-extrabold border border-deep-brown/15 shadow-xs">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-serif font-extrabold text-deep-brown">{step.step_label}</span>
          {step.product_name && (
            <span className="truncate text-xs font-sans text-deep-brown/70">— {step.product_name}</span>
          )}
          {step.wait_minutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-olive bg-olive/10 border border-olive/20 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" aria-hidden /> wait {step.wait_minutes} min
            </span>
          )}
        </div>
        {step.note && (
          <p className="mt-1 text-xs text-deep-brown/80 leading-relaxed font-sans">{step.note}</p>
        )}
      </div>
    </li>
  );
}

function RoutineColumn({ label, icon, steps }: { label: string; icon: React.ReactNode; steps: LayerStep[] }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-2 text-sm font-serif font-bold text-deep-brown border-b border-deep-brown/10 pb-2">
        {icon}
        <span>{label}</span>
      </div>
      {steps.length === 0 ? (
        <p className="py-2 text-xs text-deep-brown/50">No steps in this routine yet.</p>
      ) : (
        <ol className="divide-y divide-deep-brown/10">
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
    <div className="bg-cream border border-deep-brown/15 rounded-3xl p-5 sm:p-6 shadow-xs font-sans text-deep-brown">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-olive shrink-0" />
        <h3 className="text-lg font-serif font-bold text-deep-brown">How to layer this routine</h3>
      </div>
      <p className="text-xs text-deep-brown/70 leading-relaxed">
        Thinnest to thickest, water before oil — the order that keeps actives working efficiently.
      </p>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:gap-8">
        <RoutineColumn label="Morning" icon={<Sun className="w-4 h-4 text-amber-600" aria-hidden />} steps={layering.am} />
        <div className="hidden w-px self-stretch bg-deep-brown/15 sm:block" aria-hidden />
        <RoutineColumn label="Night" icon={<Moon className="w-4 h-4 text-indigo-600" aria-hidden />} steps={layering.pm} />
      </div>
    </div>
  );
}
