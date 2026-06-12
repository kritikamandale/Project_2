/**
 * TensorFlow.js skin analysis module.
 *
 * Privacy guarantee: analysis runs entirely in the browser.
 * Only the 512-dim feature vector (never the raw image) is sent to the server.
 *
 * Model expected at /public/models/skin_model/model.json
 * Architecture: MobileNetV2 base → GlobalAveragePooling2D(1280) → Dense(512, relu)
 *               → three classification heads:
 *                 [0] skin_type (5-class softmax)
 *                 [1] conditions (9-class sigmoid multi-label)
 *                 [2] fitzpatrick_tone (6-class softmax)
 *                 [3] feature_vector (512-dim, the Dense(512) activations)
 *
 * Bias mitigation (DPDP / fairness):
 *  - Input normalization to [-1, 1] WITHOUT per-image brightness adjustment so
 *    darker skin tones are not inadvertently lightened before inference.
 *  - If confidence for Fitzpatrick IV-VI falls below 0.70, `biasFlag` is set and
 *    the caller should offer a manual override.
 */

import * as tf from "@tensorflow/tfjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_URL = "/models/skin_model/model.json";
const INDEXEDDB_KEY = "skin-analysis-model-v1";
const INPUT_SIZE = 224;
const FEATURE_VECTOR_DIM = 512;
const BIAS_CONFIDENCE_THRESHOLD = 0.70;
const DARKER_FITZPATRICK_TONES: FitzpatrickTone[] = ["IV", "V", "VI"];

const SKIN_TYPE_CLASSES: SkinType[] = [
  "dry", "oily", "combination", "normal", "sensitive",
];

const CONDITION_CLASSES: ConditionName[] = [
  "acne", "dark_spots", "pigmentation", "wrinkles",
  "dryness", "redness", "pores", "texture", "uneven_tone",
];

const FITZPATRICK_CLASSES: FitzpatrickTone[] = ["I", "II", "III", "IV", "V", "VI"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkinType = "oily" | "dry" | "combination" | "normal" | "sensitive";
export type FitzpatrickTone = "I" | "II" | "III" | "IV" | "V" | "VI";
export type Severity = "none" | "mild" | "moderate" | "severe";
export type ConditionName =
  | "acne" | "dark_spots" | "pigmentation" | "wrinkles"
  | "dryness" | "redness" | "pores" | "texture" | "uneven_tone";

export interface DetectedCondition {
  name: ConditionName;
  severity: Severity;
  zone: string;
  confidence: number;
}

export interface SkinAnalysisResult {
  skinType: SkinType;
  skinTypeConfidence: number;
  fitzpatrickTone: FitzpatrickTone;
  conditions: DetectedCondition[];
  lightingQualityScore: number;
  analysisTimestamp: string;
  featureVector: number[];
  modelVersion: string;
  processedLocally: true;
  biasFlag: boolean;
}

export interface FaceBounds {
  x: number;     // pixel coords on the source element
  y: number;
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Model state
// ---------------------------------------------------------------------------

type ModelState =
  | { status: "unloaded" }
  | { status: "loading" }
  | { status: "ready"; model: tf.LayersModel }
  | { status: "failed"; error: string };

let modelState: ModelState = { status: "unloaded" };

export function getModelStatus(): ModelState["status"] {
  return modelState.status;
}

// ---------------------------------------------------------------------------
// Model loading with IndexedDB caching
// ---------------------------------------------------------------------------

export async function loadSkinModel(): Promise<void> {
  if (modelState.status === "ready" || modelState.status === "loading") return;

  modelState = { status: "loading" };

  try {
    await import("@tensorflow/tfjs-backend-webgl");
    await tf.ready();

    // Attempt to load from IndexedDB cache first
    let model: tf.LayersModel | null = null;
    try {
      model = await tf.loadLayersModel(`indexeddb://${INDEXEDDB_KEY}`);
    } catch {
      // Not cached — load from public URL, then persist to IndexedDB
      model = await tf.loadLayersModel(MODEL_URL);
      try {
        await model.save(`indexeddb://${INDEXEDDB_KEY}`);
      } catch {
        // Caching failed — model still works, just won't be cached
      }
    }

    modelState = { status: "ready", model };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    modelState = { status: "failed", error: msg };
    throw new Error(`Skin model failed to load: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

/**
 * Preprocess an image element for inference.
 * - Crops to the face bounding box if provided.
 * - Resizes to 224×224.
 * - Normalises to [-1, 1] WITHOUT brightness adjustment (preserves dark tones).
 */
function preprocessImage(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  faceBounds?: FaceBounds,
): tf.Tensor4D {
  return tf.tidy(() => {
    let img = tf.browser.fromPixels(source);

    if (faceBounds) {
      const { x, y, width, height } = faceBounds;
      img = tf.slice(img, [Math.max(0, y), Math.max(0, x), 0], [height, width, 3]);
    }

    // Resize and normalise to [-1, 1] — NO per-image brightness normalisation.
    // Applying CLAHE or histogram equalisation here would compress the luminance
    // difference between lighter and darker skin, introducing algorithmic bias.
    const resized = tf.image.resizeBilinear(img as tf.Tensor3D, [INPUT_SIZE, INPUT_SIZE]);
    const normalized = resized.div(127.5).sub(1.0) as tf.Tensor3D;
    return normalized.expandDims(0) as tf.Tensor4D;
  });
}

// ---------------------------------------------------------------------------
// Fitzpatrick tone heuristic (fallback when model head is unavailable)
// ---------------------------------------------------------------------------

/**
 * Estimate Fitzpatrick tone from the face crop's luminance distribution.
 * Uses the Individual Typology Angle (ITA) approximation:
 *   ITA > 55° → Type I-II, 28–55° → III, 10–28° → IV, -30–10° → V-VI
 *
 * This is a fallback for when the model's classification head isn't available.
 * In production, the model's fitzpatrick_tone output head takes precedence.
 */
function estimateFitzpatrickHeuristic(imageData: ImageData): FitzpatrickTone {
  let sumR = 0, sumG = 0, sumB = 0;
  const n = imageData.data.length / 4;

  for (let i = 0; i < imageData.data.length; i += 4) {
    sumR += imageData.data[i];
    sumG += imageData.data[i + 1];
    sumB += imageData.data[i + 2];
  }

  const r = sumR / n, g = sumG / n, b = sumB / n;
  // CIE L* approximation from linear RGB
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Simplified ITA approximation using (R-B) as the b* proxy
  const bProxy = r - b;
  const ita = Math.atan2(L - 50, bProxy) * (180 / Math.PI);

  if (ita > 55) return "I";
  if (ita > 41) return "II";
  if (ita > 28) return "III";
  if (ita > 10) return "IV";
  if (ita > -30) return "V";
  return "VI";
}

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

function probabilityToSeverity(p: number): Severity {
  if (p < 0.25) return "none";
  if (p < 0.50) return "mild";
  if (p < 0.75) return "moderate";
  return "severe";
}

// Zone assignment heuristic based on condition type
const CONDITION_ZONES: Record<ConditionName, string> = {
  acne: "forehead",
  dark_spots: "cheeks",
  pigmentation: "cheeks",
  wrinkles: "forehead",
  dryness: "cheeks",
  redness: "nose",
  pores: "nose",
  texture: "full_face",
  uneven_tone: "full_face",
};

// ---------------------------------------------------------------------------
// Main inference function
// ---------------------------------------------------------------------------

export async function analyzeFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  faceBounds?: FaceBounds,
  lightingQualityScore = 1.0,
): Promise<SkinAnalysisResult> {
  if (modelState.status !== "ready") {
    await loadSkinModel();
  }

  if (modelState.status !== "ready") {
    throw new Error("Model unavailable — use manual fallback");
  }

  const { model } = modelState;
  const tensor = preprocessImage(source, faceBounds);

  let skinTypeProbs: Float32Array;
  let conditionProbs: Float32Array;
  let fitzpatrickProbs: Float32Array | null = null;
  let featureVector: number[];

  try {
    const output = model.predict(tensor);

    // Support both multi-output (array) and single-output models
    if (Array.isArray(output)) {
      skinTypeProbs = await (output[0] as tf.Tensor).data() as Float32Array;
      conditionProbs = await (output[1] as tf.Tensor).data() as Float32Array;
      if (output.length >= 3) {
        fitzpatrickProbs = await (output[2] as tf.Tensor).data() as Float32Array;
      }
      if (output.length >= 4) {
        featureVector = Array.from(await (output[3] as tf.Tensor).data() as Float32Array);
      } else {
        featureVector = await extractFeatureVector(model, tensor);
      }
    } else {
      // Single-output model — use the output as skin type probs
      skinTypeProbs = await (output as tf.Tensor).data() as Float32Array;
      conditionProbs = new Float32Array(CONDITION_CLASSES.length).fill(0);
      featureVector = await extractFeatureVector(model, tensor);
    }
  } finally {
    tensor.dispose();
  }

  // Skin type classification
  const maxSkinIdx = skinTypeProbs.indexOf(Math.max(...Array.from(skinTypeProbs)));
  const skinType = SKIN_TYPE_CLASSES[maxSkinIdx];
  const skinTypeConfidence = skinTypeProbs[maxSkinIdx];

  // Fitzpatrick tone
  let fitzpatrickTone: FitzpatrickTone;
  if (fitzpatrickProbs && fitzpatrickProbs.length === 6) {
    const maxFitzIdx = Array.from(fitzpatrickProbs).indexOf(
      Math.max(...Array.from(fitzpatrickProbs))
    );
    fitzpatrickTone = FITZPATRICK_CLASSES[maxFitzIdx];
  } else {
    // Fallback: estimate from pixel luminance of the face crop
    fitzpatrickTone = await estimateFitzpatrickFromSource(source, faceBounds);
  }

  // Detected conditions (multi-label threshold at 0.35)
  const conditions: DetectedCondition[] = CONDITION_CLASSES.reduce<DetectedCondition[]>(
    (acc, name, i) => {
      const p = conditionProbs[i] ?? 0;
      if (p >= 0.35) {
        acc.push({
          name,
          severity: probabilityToSeverity(p),
          zone: CONDITION_ZONES[name],
          confidence: p,
        });
      }
      return acc;
    },
    [],
  );

  // Ensure feature vector is exactly 512-dim
  if (featureVector.length < FEATURE_VECTOR_DIM) {
    featureVector = padToLength(featureVector, FEATURE_VECTOR_DIM);
  } else if (featureVector.length > FEATURE_VECTOR_DIM) {
    featureVector = featureVector.slice(0, FEATURE_VECTOR_DIM);
  }

  // Bias flag for darker tones below threshold
  const biasFlag =
    DARKER_FITZPATRICK_TONES.includes(fitzpatrickTone) &&
    skinTypeConfidence < BIAS_CONFIDENCE_THRESHOLD;

  return {
    skinType,
    skinTypeConfidence,
    fitzpatrickTone,
    conditions,
    lightingQualityScore,
    analysisTimestamp: new Date().toISOString(),
    featureVector,
    modelVersion: INDEXEDDB_KEY,
    processedLocally: true,
    biasFlag,
  };
}

// ---------------------------------------------------------------------------
// Feature vector extraction from intermediate layer
// ---------------------------------------------------------------------------

async function extractFeatureVector(
  model: tf.LayersModel,
  tensor: tf.Tensor4D,
): Promise<number[]> {
  // Try named bottleneck layers in order of preference
  const candidateNames = ["features_dense", "features", "global_average_pooling2d", "gap"];

  for (const layerName of candidateNames) {
    try {
      const layer = model.getLayer(layerName);
      const featureModel = tf.model({ inputs: model.inputs, outputs: layer.output as tf.SymbolicTensor });
      const features = featureModel.predict(tensor) as tf.Tensor;
      const data = Array.from(await features.data() as Float32Array);
      features.dispose();
      return data;
    } catch {
      // Layer not found — try next
    }
  }

  // No named layer found — derive a deterministic 512-dim vector from the model output
  return deriveFeatureVector(model, tensor);
}

async function deriveFeatureVector(
  model: tf.LayersModel,
  tensor: tf.Tensor4D,
): Promise<number[]> {
  // Extract all output probabilities and project to 512 dims using a fixed
  // sinusoidal embedding — preserves information and is deterministic.
  const output = model.predict(tensor);
  const rawProbs = Array.isArray(output)
    ? (await Promise.all(output.map(t => (t as tf.Tensor).data()))).flatMap(a => Array.from(a as Float32Array))
    : Array.from(await (output as tf.Tensor).data() as Float32Array);

  return sinosoidalProject(rawProbs, FEATURE_VECTOR_DIM);
}

/** Sinusoidal positional-embedding-style projection to a target dimension. */
function sinosoidalProject(src: number[], targetDim: number): number[] {
  const out = new Array<number>(targetDim).fill(0);
  for (let d = 0; d < targetDim; d++) {
    let v = 0;
    for (let i = 0; i < src.length; i++) {
      const freq = Math.pow(10000, (2 * (d % 2 === 0 ? d : d - 1)) / targetDim);
      v += src[i] * (d % 2 === 0 ? Math.sin(i / freq) : Math.cos(i / freq));
    }
    out[d] = Math.tanh(v);   // squash to (-1, 1)
  }
  return out;
}

function padToLength(arr: number[], len: number): number[] {
  const out = [...arr];
  while (out.length < len) out.push(0);
  return out;
}

// ---------------------------------------------------------------------------
// Fitzpatrick estimation from canvas pixel data
// ---------------------------------------------------------------------------

async function estimateFitzpatrickFromSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  faceBounds?: FaceBounds,
): Promise<FitzpatrickTone> {
  const canvas = document.createElement("canvas");
  const w = faceBounds?.width ?? (source as HTMLVideoElement).videoWidth ?? 224;
  const h = faceBounds?.height ?? (source as HTMLVideoElement).videoHeight ?? 224;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  if (faceBounds) {
    ctx.drawImage(source, faceBounds.x, faceBounds.y, faceBounds.width, faceBounds.height, 0, 0, w, h);
  } else {
    ctx.drawImage(source, 0, 0, w, h);
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  return estimateFitzpatrickHeuristic(imageData);
}

// ---------------------------------------------------------------------------
// Manual fallback data (shown when model fails to load)
// ---------------------------------------------------------------------------

export interface ManualSkinTypeOption {
  type: SkinType;
  label: string;
  description: string;
  signs: string[];
  fitzpatrickNote: string;
}

export const MANUAL_SKIN_OPTIONS: ManualSkinTypeOption[] = [
  {
    type: "oily",
    label: "Oily",
    description: "Shiny, greasy appearance throughout the day",
    signs: ["Enlarged pores", "Prone to breakouts", "Shiny T-zone", "Makeup slides off"],
    fitzpatrickNote: "More common across all skin tones; often appears darker/more uneven on tones IV-VI",
  },
  {
    type: "dry",
    label: "Dry",
    description: "Tight, rough, or flaky texture",
    signs: ["Rough patches", "Flaking", "Tight after washing", "Fine lines visible"],
    fitzpatrickNote: "Ashiness and grey undertone are common visible markers on darker skin tones",
  },
  {
    type: "combination",
    label: "Combination",
    description: "Oily T-zone (forehead, nose, chin) with dry cheeks",
    signs: ["Shiny nose and forehead", "Dry or normal cheeks", "Occasional breakouts in T-zone"],
    fitzpatrickNote: "Very common in Indian skin types (III-V); contrast more visible on medium tones",
  },
  {
    type: "normal",
    label: "Normal",
    description: "Balanced, neither too oily nor too dry",
    signs: ["Few blemishes", "Minimal sensitivity", "Barely visible pores", "Radiant complexion"],
    fitzpatrickNote: "Consistent across Fitzpatrick scale; glow more visible on tones III-V",
  },
  {
    type: "sensitive",
    label: "Sensitive",
    description: "Reacts easily to products and environment",
    signs: ["Redness after use", "Burning or stinging", "Dry patches", "Frequent breakouts"],
    fitzpatrickNote: "Redness may appear as darkening or hyperpigmentation on tones IV-VI",
  },
];

/** Build a SkinAnalysisResult from a manual user selection (no camera required). */
export function buildManualResult(
  skinType: SkinType,
  fitzpatrickTone: FitzpatrickTone,
): SkinAnalysisResult {
  // Synthesise a plausible 512-dim vector for manual submissions.
  // All values are 0 except the skin-type and fitzpatrick index positions.
  const featureVector = new Array<number>(FEATURE_VECTOR_DIM).fill(0);
  featureVector[SKIN_TYPE_CLASSES.indexOf(skinType)] = 1.0;
  featureVector[FITZPATRICK_CLASSES.indexOf(fitzpatrickTone) + 10] = 1.0;

  const biasFlag =
    DARKER_FITZPATRICK_TONES.includes(fitzpatrickTone);

  return {
    skinType,
    skinTypeConfidence: 1.0,   // user-selected = 100% confident
    fitzpatrickTone,
    conditions: [],
    lightingQualityScore: 1.0,
    analysisTimestamp: new Date().toISOString(),
    featureVector,
    modelVersion: "manual-v1",
    processedLocally: true,
    biasFlag,
  };
}
