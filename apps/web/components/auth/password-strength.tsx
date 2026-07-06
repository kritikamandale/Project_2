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
  suggestions: string[];
}

// Lightweight zxcvbn-style scorer without the library dependency.
// Uses heuristics that cover the most impactful password patterns.
function scorePassword(password: string): StrengthResult {
  if (!password) {
    return { score: 0, label: "", color: "", suggestions: [] };
  }

  const suggestions: string[] = [];
  let score = 0;

  // Length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length < 8) suggestions.push("Use at least 8 characters");
  else if (password.length < 12) suggestions.push("12+ characters is stronger");

  // Complexity checks
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (hasUpper && hasLower) score++;
  else suggestions.push("Mix uppercase and lowercase letters");

  if (hasDigit) score++;
  else suggestions.push("Add at least one number");

  if (hasSpecial) score++;
  else suggestions.push("Add a special character (e.g. @, #, !)");

  // Cap at 4
  const capped = Math.min(score, 4) as StrengthLevel;

  const LEVELS: Record<StrengthLevel, { label: string; color: string }> = {
    0: { label: "Too weak", color: "bg-red-500" },
    1: { label: "Weak", color: "bg-red-400" },
    2: { label: "Fair", color: "bg-cream-500" },
    3: { label: "Good", color: "bg-teal-400" },
    4: { label: "Strong", color: "bg-teal-600" },
  };

  return {
    score: capped,
    label: LEVELS[capped].label,
    color: LEVELS[capped].color,
    suggestions: suggestions.slice(0, 2), // Show max 2 hints
  };
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const result = useMemo(() => scorePassword(password), [password]);

  if (!password) return null;

  const filledBars = result.score;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Bar indicators */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i <= filledBars ? result.color : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Label + hint */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            filledBars <= 1 && "text-red-500",
            filledBars === 2 && "text-cream-700",
            filledBars === 3 && "text-teal-600",
            filledBars === 4 && "text-teal-700"
          )}
        >
          {result.label}
        </span>
        {result.suggestions[0] && (
          <span className="text-muted-foreground">{result.suggestions[0]}</span>
        )}
      </div>
    </div>
  );
}
