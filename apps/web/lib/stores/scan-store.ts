/**
 * Zustand store — tracks the active scan session across
 * the camera → questionnaire → results flow.
 */

import { create } from "zustand";
import type { Scan, TFJSResult, QuestionnaireAnswers } from "@skin-analysis/shared-types";

interface ScanState {
  currentScan: Scan | null;
  tfjsResult: TFJSResult | null;
  questionnaire: Partial<QuestionnaireAnswers> | null;

  setScan: (scan: Scan) => void;
  setTFJSResult: (result: TFJSResult) => void;
  setQuestionnaire: (q: Partial<QuestionnaireAnswers>) => void;
  reset: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
  currentScan: null,
  tfjsResult: null,
  questionnaire: null,

  setScan: (scan) => set({ currentScan: scan }),
  setTFJSResult: (result) => set({ tfjsResult: result }),
  setQuestionnaire: (q) => set({ questionnaire: q }),
  reset: () => set({ currentScan: null, tfjsResult: null, questionnaire: null }),
}));
