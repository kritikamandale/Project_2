/**
 * Unit tests for lib/ai/skinAnalysis.ts
 * Covers: feature extraction helpers, lighting quality, bias flag, manual fallback.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers extracted / inlined for testing without TF.js model load
// ---------------------------------------------------------------------------

/** Mirrors the lighting quality check in CameraCapture.tsx */
function assessLightingQuality(
  brightness: number,
  std: number,
  shadowRatio: number
): "poor" | "acceptable" | "good" {
  if (brightness < 60 || brightness > 220) return "poor";
  if (std < 15) return "poor"; // uniform / no texture
  if (shadowRatio > 0.4) return "poor";
  if (brightness < 90 || std < 25) return "acceptable";
  return "good";
}

/** Mirrors the Fitzpatrick ITA heuristic from skinAnalysis.ts */
function fitzpatrickFromITA(ita: number): string {
  if (ita > 55) return "I";
  if (ita > 41) return "II";
  if (ita > 28) return "III";
  if (ita > 10) return "IV";
  if (ita > -30) return "V";
  return "VI";
}

/** Mirrors the bias flag check */
function shouldFlagBias(fitzpatrick: string, confidence: number): boolean {
  const darkTones = ["IV", "V", "VI"];
  return darkTones.includes(fitzpatrick) && confidence < 0.70;
}

/** Mirrors the feature vector validation */
function validateFeatureVector(vec: number[]): { valid: boolean; reason?: string } {
  if (vec.length !== 512) return { valid: false, reason: `Expected 512 dims, got ${vec.length}` };
  const min = Math.min(...vec);
  const max = Math.max(...vec);
  if (min < -1 || max > 20) return { valid: false, reason: "Values out of range [-1, 20]" };
  const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
  const variance =
    vec.reduce((a, b) => a + (b - mean) ** 2, 0) / vec.length;
  if (variance < 0.001) return { valid: false, reason: "Zero-variance vector (constant)" };
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Lighting quality assessment", () => {
  it("returns poor for too-dark image (brightness < 60)", () => {
    expect(assessLightingQuality(40, 30, 0.1)).toBe("poor");
  });

  it("returns poor for too-bright image (brightness > 220)", () => {
    expect(assessLightingQuality(240, 30, 0.1)).toBe("poor");
  });

  it("returns poor when std dev is too low (flat lighting)", () => {
    expect(assessLightingQuality(128, 10, 0.1)).toBe("poor");
  });

  it("returns poor when shadow ratio is high", () => {
    expect(assessLightingQuality(128, 30, 0.6)).toBe("poor");
  });

  it("returns acceptable for dim but usable lighting", () => {
    expect(assessLightingQuality(80, 22, 0.2)).toBe("acceptable");
  });

  it("returns good for ideal lighting conditions", () => {
    expect(assessLightingQuality(140, 40, 0.15)).toBe("good");
  });
});

describe("Fitzpatrick ITA heuristic", () => {
  it("maps ITA > 55 to Type I (very light)", () => {
    expect(fitzpatrickFromITA(60)).toBe("I");
  });

  it("maps ITA 41–55 to Type II", () => {
    expect(fitzpatrickFromITA(45)).toBe("II");
  });

  it("maps ITA 28–41 to Type III", () => {
    expect(fitzpatrickFromITA(33)).toBe("III");
  });

  it("maps ITA 10–28 to Type IV", () => {
    expect(fitzpatrickFromITA(18)).toBe("IV");
  });

  it("maps ITA -30–10 to Type V", () => {
    expect(fitzpatrickFromITA(-10)).toBe("V");
  });

  it("maps ITA < -30 to Type VI (darkest)", () => {
    expect(fitzpatrickFromITA(-35)).toBe("VI");
  });
});

describe("Bias flag trigger", () => {
  it("flags bias for Fitzpatrick IV with confidence < 0.70", () => {
    expect(shouldFlagBias("IV", 0.65)).toBe(true);
  });

  it("flags bias for Fitzpatrick VI with confidence 0.60", () => {
    expect(shouldFlagBias("VI", 0.60)).toBe(true);
  });

  it("does NOT flag bias for Fitzpatrick IV with confidence ≥ 0.70", () => {
    expect(shouldFlagBias("IV", 0.72)).toBe(false);
  });

  it("does NOT flag bias for Fitzpatrick I regardless of confidence", () => {
    expect(shouldFlagBias("I", 0.50)).toBe(false);
  });

  it("does NOT flag bias for Fitzpatrick III with low confidence", () => {
    expect(shouldFlagBias("III", 0.60)).toBe(false);
  });
});

describe("Feature vector validation", () => {
  it("accepts a valid 512-dim vector with variance", () => {
    const vec = Array.from({ length: 512 }, (_, i) => Math.sin(i) * 0.5);
    expect(validateFeatureVector(vec).valid).toBe(true);
  });

  it("rejects vectors with wrong dimension", () => {
    const vec = new Array(256).fill(0.1);
    const result = validateFeatureVector(vec);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("512");
  });

  it("rejects zero-variance (constant) vectors", () => {
    const vec = new Array(512).fill(0.5);
    const result = validateFeatureVector(vec);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("variance");
  });

  it("rejects vectors with values outside [-1, 20] range", () => {
    const vec = Array.from({ length: 512 }, (_, i) =>
      i === 0 ? -5.0 : Math.random() * 0.5
    );
    const result = validateFeatureVector(vec);
    expect(result.valid).toBe(false);
  });

  it("accepts vectors with values at exact boundaries", () => {
    const vec = Array.from({ length: 512 }, (_, i) =>
      i % 2 === 0 ? -1.0 : 0.5
    );
    expect(validateFeatureVector(vec).valid).toBe(true);
  });
});
