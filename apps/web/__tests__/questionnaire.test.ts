/**
 * Unit tests for questionnaire adaptive logic and localStorage save/resume.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Adaptive logic mirrors (from questionnaire-form.tsx business rules)
// ---------------------------------------------------------------------------

type RoutineStep =
  | "cleanser"
  | "toner"
  | "serum"
  | "moisturiser"
  | "sunscreen"
  | "nothing";

/** If "nothing" is selected, all other steps should be cleared. */
function applyNothingExclusivity(
  current: RoutineStep[],
  toggled: RoutineStep
): RoutineStep[] {
  if (toggled === "nothing") return ["nothing"];
  // Selecting a real step removes "nothing"
  const without = current.filter((s) => s !== "nothing");
  return without.includes(toggled)
    ? without.filter((s) => s !== toggled)
    : [...without, toggled];
}

/** If diagnosed_conditions includes "None", clear all other selections. */
function applyNoneExclusivity(
  current: string[],
  toggled: string
): string[] {
  if (toggled === "None" || toggled === "Prefer not to say") return [toggled];
  const without = current.filter((c) => c !== "None" && c !== "Prefer not to say");
  return without.includes(toggled)
    ? without.filter((c) => c !== toggled)
    : [...without, toggled];
}

/** When "nothing" is in routine steps, hide cleanse/sunscreen sub-questions. */
function shouldShowCleanseFrequency(routineSteps: RoutineStep[]): boolean {
  return (
    routineSteps.includes("cleanser") && !routineSteps.includes("nothing")
  );
}

function shouldShowSunscreenSection(routineSteps: RoutineStep[]): boolean {
  return (
    routineSteps.includes("sunscreen") && !routineSteps.includes("nothing")
  );
}

function shouldShowMedicationName(medicationAffectsSkin: boolean | null): boolean {
  return medicationAffectsSkin === true;
}

// ---------------------------------------------------------------------------
// localStorage save/resume mock
// ---------------------------------------------------------------------------

const STORAGE_KEY = "skinai_questionnaire_draft";

function saveDraft(data: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
}

function loadDraft(): Record<string, unknown> | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Routine step — nothing exclusivity", () => {
  it('selecting "nothing" clears all other steps', () => {
    const result = applyNothingExclusivity(
      ["cleanser", "moisturiser"],
      "nothing"
    );
    expect(result).toEqual(["nothing"]);
  });

  it('selecting a real step after "nothing" removes "nothing"', () => {
    const result = applyNothingExclusivity(["nothing"], "cleanser");
    expect(result).toContain("cleanser");
    expect(result).not.toContain("nothing");
  });

  it("toggling an active step removes it", () => {
    const result = applyNothingExclusivity(
      ["cleanser", "moisturiser"],
      "cleanser"
    );
    expect(result).not.toContain("cleanser");
    expect(result).toContain("moisturiser");
  });

  it("toggling an inactive step adds it", () => {
    const result = applyNothingExclusivity(["cleanser"], "moisturiser");
    expect(result).toContain("moisturiser");
  });
});

describe("Diagnosed conditions — None exclusivity", () => {
  it('selecting "None" clears all other conditions', () => {
    const result = applyNoneExclusivity(["acne", "eczema"], "None");
    expect(result).toEqual(["None"]);
  });

  it('selecting "Prefer not to say" clears all conditions', () => {
    const result = applyNoneExclusivity(["acne"], "Prefer not to say");
    expect(result).toEqual(["Prefer not to say"]);
  });

  it("selecting a real condition removes None", () => {
    const result = applyNoneExclusivity(["None"], "acne");
    expect(result).toContain("acne");
    expect(result).not.toContain("None");
  });

  it("can select multiple non-exclusive conditions", () => {
    const result = applyNoneExclusivity(["acne"], "rosacea");
    expect(result).toContain("acne");
    expect(result).toContain("rosacea");
  });
});

describe("Adaptive section visibility", () => {
  it("shows cleanser frequency when cleanser is selected", () => {
    expect(shouldShowCleanseFrequency(["cleanser", "moisturiser"])).toBe(true);
  });

  it("hides cleanser frequency when nothing is selected", () => {
    expect(shouldShowCleanseFrequency(["nothing"])).toBe(false);
  });

  it("hides cleanser frequency when cleanser not in routine", () => {
    expect(shouldShowCleanseFrequency(["moisturiser"])).toBe(false);
  });

  it("shows sunscreen section when sunscreen is selected", () => {
    expect(shouldShowSunscreenSection(["sunscreen"])).toBe(true);
  });

  it("hides sunscreen section when nothing selected", () => {
    expect(shouldShowSunscreenSection(["nothing"])).toBe(false);
  });

  it("shows medication name when medication_affects_skin is true", () => {
    expect(shouldShowMedicationName(true)).toBe(true);
  });

  it("hides medication name when medication_affects_skin is false", () => {
    expect(shouldShowMedicationName(false)).toBe(false);
  });

  it("hides medication name when medication_affects_skin is null (not answered)", () => {
    expect(shouldShowMedicationName(null)).toBe(false);
  });
});

describe("localStorage draft save/resume", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves draft data to localStorage", () => {
    saveDraft({ step: 2, city: "Mumbai" });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("loads saved draft correctly", () => {
    saveDraft({ step: 3, skin_type: "oily" });
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft?.step).toBe(3);
    expect(draft?.skin_type).toBe("oily");
  });

  it("returns null when no draft exists", () => {
    expect(loadDraft()).toBeNull();
  });

  it("returns null for corrupted draft data", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
    expect(loadDraft()).toBeNull();
  });

  it("clears draft correctly", () => {
    saveDraft({ step: 1 });
    clearDraft();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("persists savedAt timestamp", () => {
    const before = Date.now();
    saveDraft({ step: 1 });
    const draft = loadDraft();
    expect(draft?.savedAt).toBeGreaterThanOrEqual(before);
  });
});
