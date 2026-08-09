"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

interface StrengthResult {
  score: StrengthLevel;
  label: string;
  color: string;
  textColor: string;
  suggestions: string[];
}

function scorePassword(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: "", color: "", textColor: "", suggestions: [] };
  }

  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length < 8) suggestions.push("Use at least 8 characters");
  else if (password.length < 12) suggestions.push("12+ characters recommended");

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (hasUpper && hasLower) score++;
  else suggestions.push("Mix uppercase and lowercase letters");

  if (hasDigit) score++;
  else suggestions.push("Add at least one number");

  if (hasSpecial) score++;
  else suggestions.push("Add a special character (@, #, !)");

  const capped = Math.min(score, 4) as StrengthLevel;

  // In-palette color mapping (olive → butter → deep-brown)
  const LEVELS: Record<StrengthLevel, { label: string; color: string; textColor: string }> = {
    0: { label: "Too weak", color: "bg-olive/40", textColor: "text-olive/80" },
    1: { label: "Weak", color: "bg-olive/60", textColor: "text-olive" },
    2: { label: "Fair", color: "bg-olive", textColor: "text-olive font-bold" },
    3: { label: "Good", color: "bg-butter", textColor: "text-deep-brown font-bold" },
    4: { label: "Strong", color: "bg-deep-brown", textColor: "text-deep-brown font-bold" },
  };

  return {
    score: capped,
    label: LEVELS[capped].label,
    color: LEVELS[capped].color,
    textColor: LEVELS[capped].textColor,
    suggestions: suggestions.slice(0, 2),
  };
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const result = useMemo(() => scorePassword(password), [password]);

  if (!password) return null;

  const filledBars = result.score;

  return (
    <div className={cn("space-y-1.5 mt-2", className)}>
      {/* Thin Segmented Bar Indicators — In-palette (olive -> butter -> deep-brown) */}
      <div className="flex gap-1.5 p-0.5 bg-cream border border-deep-brown/15 rounded-full">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i <= filledBars ? result.color : "bg-nude/30"
            )}
          />
        ))}
      </div>

      {/* Label + hint */}
      <div className="flex items-center justify-between text-xs font-sans">
        <span className={cn("text-[11px] font-mono uppercase tracking-wider", result.textColor)}>
          {result.label}
        </span>
        {result.suggestions[0] && (
          <span className="text-deep-brown/60 text-[11px]">{result.suggestions[0]}</span>
        )}
      </div>
    </div>
  );
}
