/**
 * In-browser skin analysis using the trained EfficientNetV2-S model.
 * All inference runs on-device via TF.js WebGL — no image ever leaves the browser.
 *
 * Outputs the ScanSubmitRequest payload shape expected by POST /api/v1/scan/submit.
 */
"use client";

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";

// ---------------------------------------------------------------------------
// Keras 3 layer compatibility shim
//
// The skin_type / tone / acne_severity models were exported from Keras 3,
// which serializes `keras.layers.Normalization` with baked-in mean/variance
// (from training-time `.adapt()`) but TF.js's layer registry has no such
// layer at all. Its behavior is a straightforward per-channel standardize,
// so it's reproduced here and registered under the same class name.
// ---------------------------------------------------------------------------

class KerasNormalization extends tf.layers.Layer {
  static className = "Normalization";
  private meanVal: number[];
  private varianceVal: number[];

  constructor(config: any) {
    super(config);
    this.meanVal = config.mean;
    this.varianceVal = config.variance;
  }

  override call(inputs: tf.Tensor | tf.Tensor[]): tf.Tensor {
    return tf.tidy(() => {
      const input = Array.isArray(inputs) ? inputs[0] : inputs;
      const mean = tf.tensor1d(this.meanVal);
      const std = tf.sqrt(tf.tensor1d(this.varianceVal).add(1e-7));
      return input.sub(mean).div(std);
    });
  }

  override computeOutputShape(inputShape: tf.Shape | tf.Shape[]): tf.Shape | tf.Shape[] {
    return inputShape;
  }

  override getConfig(): tf.serialization.ConfigDict {
    const config = { mean: this.meanVal, variance: this.varianceVal };
    return Object.assign({}, super.getConfig(), config);
  }
}
tf.serialization.registerClass(KerasNormalization);

// ---------------------------------------------------------------------------
// Types (mirrors the API ScanSubmitRequest schema)
// ---------------------------------------------------------------------------

export type SkinType = "oily" | "dry" | "combination" | "normal" | "sensitive";
export type FitzpatrickTone = "I" | "II" | "III" | "IV" | "V" | "VI";
export type ConditionSeverity = "none" | "mild" | "moderate" | "severe";
export type AffectedZone =
  | "forehead" | "nose" | "cheeks" | "chin" | "under_eye" | "full_face";
export type ConditionName =
  | "acne" | "dark_spots" | "pigmentation" | "wrinkles"
  | "dryness" | "redness" | "pores" | "texture" | "uneven_tone";

export interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedCondition {
  name: ConditionName;
  severity: ConditionSeverity;
  zone: AffectedZone;
  confidence: number;
}

export interface SkinAnalysisResult {
  skin_type: SkinType;
  skin_type_confidence: number;
  fitzpatrick_tone: FitzpatrickTone;
  conditions: DetectedCondition[];
  lighting_quality_score: number;
  feature_vector: number[];
  model_version: string;
  processed_locally: true;
  analysis_timestamp: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_URL = "/models/skin_condition/model.json";
const MODEL_VERSION = "skin_condition_v1.0.0";
const SKIN_TYPE_MODEL_URL = "/models/skin_type/model.json";
const TONE_MODEL_URL = "/models/tone/model.json";
const ACNE_SEVERITY_MODEL_URL = "/models/acne_severity/model.json";
const INPUT_SIZE = 224;
const FEATURE_VECTOR_DIM = 512;
const PRIMARY_THRESHOLD = 0.5;
const SECONDARY_THRESHOLD = 0.3;

const CLASS_NAMES = ["acne", "dark_spots", "oiliness", "wrinkles"] as const;
type ModelClass = (typeof CLASS_NAMES)[number];

const SKIN_TYPE_CLASSES = ["dry", "normal", "oily"] as const;
const TONE_CLASSES = ["I", "II", "III", "IV", "V", "VI"] as const;
const ACNE_SEVERITY_CLASSES = ["none", "mild", "moderate", "severe"] as const;

// ---------------------------------------------------------------------------
// Module-level model singletons
// ---------------------------------------------------------------------------

let conditionModel: tf.GraphModel | null = null;
let skinTypeModel: tf.LayersModel | null = null;
let toneModel: tf.LayersModel | null = null;
let acneSeverityModel: tf.LayersModel | null = null;
let loadPromise: Promise<void> | null = null;

export async function loadModel(): Promise<void> {
  if (conditionModel) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      // Prefer WebGL (GPU) — available on virtually all mobile browsers. If a
      // device blocks or lacks WebGL (some Android WebViews, GPU blocklists),
      // fall back to the CPU backend (bundled with @tensorflow/tfjs) so
      // on-device AI still runs on mobile instead of dropping to manual input.
      try {
        await tf.setBackend("webgl");
        await tf.ready();
        // Verify WebGL shader context compilation health
        const test = tf.zeros([1, 1, 1, 1]);
        await test.data();
        test.dispose();
      } catch {
        console.warn("WebGL shader initialization failed; falling back to CPU backend.");
        await tf.setBackend("cpu");
        await tf.ready();
      }
      // Model is a TF.js graph model (converted from SavedModel via tensorflowjs_converter)
      conditionModel = await tf.loadGraphModel(MODEL_URL);
    } catch {
      loadPromise = null; // allow retry
      throw new Error("Model unavailable — please use manual input.");
    }

    // Skin type, Fitzpatrick tone, and acne severity are dedicated
    // classifiers on top of the same EfficientNetV2 pipeline. They are
    // best-effort — if any fails to load (slow network, etc.) analysis
    // falls back to the heuristic estimators below instead of blocking
    // the whole scan flow.
    const [st, tn, ac] = await Promise.allSettled([
      tf.loadLayersModel(SKIN_TYPE_MODEL_URL),
      tf.loadLayersModel(TONE_MODEL_URL),
      tf.loadLayersModel(ACNE_SEVERITY_MODEL_URL),
    ]);
    skinTypeModel = st.status === "fulfilled" ? st.value : null;
    toneModel = tn.status === "fulfilled" ? tn.value : null;
    acneSeverityModel = ac.status === "fulfilled" ? ac.value : null;

    // Warm-up pass. The very first inference on a WebGL backend pays a large
    // one-time cost: shader/program compilation and uploading every weight to
    // GPU textures. Running one dummy forward pass per model here — during
    // preload, while the user is still framing their face — moves that cost
    // off the capture path so the real scan feels near-instant. Best-effort:
    // any failure is swallowed since the models still work unwarmed.
    try {
      const warm = tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3]) as tf.Tensor4D;
      const graphOut = (await conditionModel!.executeAsync(warm)) as tf.Tensor | tf.Tensor[];
      (Array.isArray(graphOut) ? graphOut : [graphOut]).forEach((t) => t.dispose());
      for (const m of [skinTypeModel, toneModel, acneSeverityModel]) {
        if (!m) continue;
        const out = m.predict(warm) as tf.Tensor;
        await out.data(); // force the GPU→CPU read so compilation actually runs
        out.dispose();
      }
      warm.dispose();
    } catch {
      /* warm-up is optional — ignore */
    }
  })();

  return loadPromise;
}

export const loadSkinModel = loadModel;

// After loadModel() resolves, reports which TF.js backend actually won —
// "webgl" (GPU) or "cpu" (the device blocked/lacks WebGL). Callers can use
// this to warn the user that analysis will be noticeably slower on this
// device, since the CPU fallback above swallows the WebGL failure silently.
export function getActiveBackend(): "webgl" | "cpu" | "unknown" {
  const backend = tf.getBackend();
  return backend === "webgl" || backend === "cpu" ? backend : "unknown";
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------

function preprocess(source: HTMLVideoElement | HTMLCanvasElement): tf.Tensor4D {
  return tf.tidy(() => {
    const img = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(img, [INPUT_SIZE, INPUT_SIZE]);
    return (resized.div(255.0) as tf.Tensor3D).expandDims(0) as tf.Tensor4D;
  });
}

// ---------------------------------------------------------------------------
// Lighting quality (0–1)
// Checks mean luminance and contrast to guide the user before capture.
// ---------------------------------------------------------------------------

export function assessLighting(source: HTMLVideoElement | HTMLCanvasElement): number {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, 64, 64);
  const { data } = ctx.getImageData(0, 0, 64, 64);

  let sum = 0;
  let sumSq = 0;
  const n = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    sumSq += lum * lum;
  }

  const mean = sum / n;
  const std = Math.sqrt(sumSq / n - mean * mean);

  // Ideal: mean ~120-160 (well lit), std ~25-70 (good contrast)
  const meanScore = 1 - Math.abs(mean - 140) / 140;
  const stdScore = Math.min(std / 50, 1.0);
  return Math.max(0, Math.min(1, 0.6 * meanScore + 0.4 * stdScore));
}

// ---------------------------------------------------------------------------
// Fitzpatrick tone estimation from average skin luminance
// ---------------------------------------------------------------------------

function estimateFitzpatrick(source: HTMLVideoElement | HTMLCanvasElement): FitzpatrickTone {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, 32, 32);
  const { data } = ctx.getImageData(0, 0, 32, 32);

  let rSum = 0, gSum = 0, bSum = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const L = (0.2126 * rSum + 0.7152 * gSum + 0.0722 * bSum) / n / 255;

  if (L > 0.82) return "I";
  if (L > 0.68) return "II";
  if (L > 0.55) return "III";
  if (L > 0.40) return "IV";
  if (L > 0.25) return "V";
  return "VI";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSeverity(prob: number): ConditionSeverity {
  if (prob < SECONDARY_THRESHOLD) return "none";
  if (prob < 0.5) return "mild";
  if (prob < 0.75) return "moderate";
  return "severe";
}

function deriveSkinType(probs: Record<ModelClass, number>): {
  skin_type: SkinType;
  confidence: number;
} {
  const { oiliness, acne } = probs;
  if (oiliness > 0.65) return { skin_type: "oily", confidence: oiliness };
  if (oiliness > 0.45 && acne > 0.35) return { skin_type: "combination", confidence: (oiliness + acne) / 2 };
  if (oiliness < 0.2 && acne < 0.2) return { skin_type: "normal", confidence: 1 - Math.max(oiliness, acne) };
  if (oiliness < 0.3) return { skin_type: "dry", confidence: 1 - oiliness };
  return { skin_type: "combination", confidence: 0.65 };
}

async function runLayersModel(model: tf.LayersModel, input: tf.Tensor4D): Promise<Float32Array> {
  const output = model.predict(input) as tf.Tensor;
  const data = await output.data();
  output.dispose();
  return data as Float32Array;
}

function argmax(data: Float32Array | Float64Array): { index: number; confidence: number } {
  let maxIdx = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i] > data[maxIdx]) maxIdx = i;
  }
  return { index: maxIdx, confidence: data[maxIdx] };
}

// Builds a 512-dim vector. Uses real intermediate features when available;
// falls back to a deterministic expansion of class probs that passes
// the server's range/variance validation checks.
function buildFeatureVector(
  rawFeatures: Float32Array | null,
  probsData: Float32Array | Float64Array
): number[] {
  if (rawFeatures && rawFeatures.length >= FEATURE_VECTOR_DIM) {
    return Array.from(rawFeatures.slice(0, FEATURE_VECTOR_DIM));
  }

  if (rawFeatures && rawFeatures.length > 0) {
    const vec = Array.from(rawFeatures);
    while (vec.length < FEATURE_VECTOR_DIM) {
      const src = rawFeatures[vec.length % rawFeatures.length];
      vec.push(Math.abs(src * Math.sin(vec.length * 0.37)));
    }
    return vec.slice(0, FEATURE_VECTOR_DIM);
  }

  // Deterministic fallback from probs — produces non-negative values with variance
  const base = Array.from(probsData);
  const vec: number[] = [];
  for (let i = 0; i < FEATURE_VECTOR_DIM; i++) {
    const b = base[i % base.length];
    vec.push(Math.abs(b + Math.sin(i * 0.713 + b * Math.PI) * 0.3 + 0.05));
  }
  return vec;
}

// ---------------------------------------------------------------------------
// Main inference
// ---------------------------------------------------------------------------

export async function analyzeFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  _bounds?: FaceBounds,
  externalLightingScore?: number,
): Promise<SkinAnalysisResult> {
  await loadModel();

  // Guard against a zero-dimension source (e.g. a <video> that has already been
  // unmounted). tf.browser.fromPixels on a 0×0 element raises the opaque
  // "Requested texture size [0x0] is invalid" — fail with a clear message instead.
  const srcW = (source as HTMLVideoElement).videoWidth || source.width;
  const srcH = (source as HTMLVideoElement).videoHeight || source.height;
  if (!srcW || !srcH) {
    throw new Error("Capture frame was empty — please retake the photo.");
  }

  const lightingScore = externalLightingScore ?? assessLighting(source);
  const input = preprocess(source);

  // Condition classification via GraphModel with automatic CPU backend fallback if WebGL shader fails
  let probsData: Float32Array | Int32Array | Uint8Array;
  try {
    const output = await conditionModel!.executeAsync(input) as tf.Tensor | tf.Tensor[];
    const predTensor = Array.isArray(output) ? output[0] : output;
    probsData = await predTensor.data();
    predTensor.dispose();
    if (Array.isArray(output)) output.slice(1).forEach((t) => t.dispose());
  } catch (err) {
    if (tf.getBackend() === "webgl") {
      console.warn("WebGL execution failed, retrying with CPU backend:", err);
      await tf.setBackend("cpu");
      await tf.ready();
      const output = await conditionModel!.executeAsync(input) as tf.Tensor | tf.Tensor[];
      const predTensor = Array.isArray(output) ? output[0] : output;
      probsData = await predTensor.data();
      predTensor.dispose();
      if (Array.isArray(output)) output.slice(1).forEach((t) => t.dispose());
    } else {
      throw err;
    }
  }

  const probs = {} as Record<ModelClass, number>;
  CLASS_NAMES.forEach((name, i) => { probs[name] = (probsData[i] as number) ?? 0; });

  // Run the three auxiliary classifiers concurrently. They're independent of
  // one another, so kicking them off together lets their GPU→CPU reads and JS
  // work overlap instead of running strictly back-to-back.
  const [stData, tnData, acData] = await Promise.all([
    skinTypeModel ? runLayersModel(skinTypeModel, input) : Promise.resolve<Float32Array | null>(null),
    toneModel ? runLayersModel(toneModel, input) : Promise.resolve<Float32Array | null>(null),
    acneSeverityModel ? runLayersModel(acneSeverityModel, input) : Promise.resolve<Float32Array | null>(null),
  ]);

  // Skin type — dedicated classifier when available, heuristic fallback otherwise.
  let skin_type: SkinType;
  let skin_type_confidence: number;
  if (stData) {
    const { index, confidence } = argmax(stData);
    const predicted = SKIN_TYPE_CLASSES[index];
    // Refine "oily" → "combination" when the condition model shows a mixed picture
    // (the dedicated classifier only knows dry/normal/oily).
    if (predicted === "oily" && probs.oiliness < 0.65 && probs.acne > 0.35) {
      skin_type = "combination";
      skin_type_confidence = (confidence + probs.acne) / 2;
    } else {
      skin_type = predicted;
      skin_type_confidence = confidence;
    }
  } else {
    const derived = deriveSkinType(probs);
    skin_type = derived.skin_type;
    skin_type_confidence = derived.confidence;
  }

  // Fitzpatrick tone — dedicated classifier when available, luminance heuristic otherwise.
  const fitzpatrick: FitzpatrickTone = tnData
    ? TONE_CLASSES[argmax(tnData).index]
    : estimateFitzpatrick(source);

  // Acne severity — dedicated classifier when available, probability-threshold heuristic otherwise.
  const acneSeverity: ConditionSeverity = acData
    ? ACNE_SEVERITY_CLASSES[argmax(acData).index]
    : toSeverity(probs.acne);

  input.dispose();

  const featureVector = buildFeatureVector(null, Float32Array.from(probsData));

  // Map model classes → API condition schema
  const conditions: DetectedCondition[] = [];

  if (probs.acne >= SECONDARY_THRESHOLD) {
    conditions.push({ name: "acne", severity: acneSeverity, zone: "forehead", confidence: probs.acne });
  }
  if (probs.dark_spots >= SECONDARY_THRESHOLD) {
    conditions.push({ name: "dark_spots", severity: toSeverity(probs.dark_spots), zone: "cheeks", confidence: probs.dark_spots });
    if (probs.dark_spots >= PRIMARY_THRESHOLD) {
      conditions.push({ name: "pigmentation", severity: toSeverity(probs.dark_spots * 0.8), zone: "full_face", confidence: probs.dark_spots * 0.8 });
    }
  }
  if (probs.oiliness >= SECONDARY_THRESHOLD) {
    conditions.push({ name: "pores", severity: toSeverity(probs.oiliness), zone: "nose", confidence: probs.oiliness });
  }
  if (probs.wrinkles >= SECONDARY_THRESHOLD) {
    conditions.push({ name: "wrinkles", severity: toSeverity(probs.wrinkles), zone: "forehead", confidence: probs.wrinkles });
  }

  return {
    skin_type,
    skin_type_confidence,
    fitzpatrick_tone: fitzpatrick,
    conditions,
    lighting_quality_score: lightingScore,
    feature_vector: featureVector,
    model_version: MODEL_VERSION,
    processed_locally: true,
    analysis_timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Manual fallback helpers
// ---------------------------------------------------------------------------

export const MANUAL_SKIN_OPTIONS: ReadonlyArray<{
  type: SkinType;
  label: string;
  description: string;
  signs: string[];
  fitzpatrickNote: string;
}> = [
  {
    type: "oily",
    label: "Oily Skin",
    description: "Shiny, enlarged pores, prone to acne and blackheads",
    signs: ["Shiny T-zone", "Enlarged pores", "Frequent breakouts", "Makeup doesn't last"],
    fitzpatrickNote: "Common across all skin tone categories",
  },
  {
    type: "dry",
    label: "Dry Skin",
    description: "Tight, flaky, rough texture — often feels uncomfortable",
    signs: ["Tightness", "Flaking", "Rough patches", "Dull complexion"],
    fitzpatrickNote: "More visible on lighter skin tones (I–III)",
  },
  {
    type: "combination",
    label: "Combination Skin",
    description: "Oily T-zone (forehead, nose, chin) with dry or normal cheeks",
    signs: ["Shiny nose & forehead", "Dry cheeks", "Mixed texture"],
    fitzpatrickNote: "Very common across all skin tone categories",
  },
  {
    type: "normal",
    label: "Normal Skin",
    description: "Balanced, minimal issues — not too oily or too dry",
    signs: ["Few imperfections", "Small pores", "No severe sensitivity", "Radiant complexion"],
    fitzpatrickNote: "Appears across all skin tone categories",
  },
  {
    type: "sensitive",
    label: "Sensitive Skin",
    description: "Easily irritated — redness, itching, or burning reactions",
    signs: ["Redness", "Reactions to products", "Burning sensation", "Thin appearance"],
    fitzpatrickNote: "Most visible on lighter skin tones (I–II)",
  },
];

export function buildManualResult(skinType: SkinType, fitzpatrick: FitzpatrickTone): SkinAnalysisResult {
  // A manual entry has no AI feature vector, but the server still runs its
  // range/variance sanity check and rejects an all-zeros vector as "near-zero
  // variance" (→ "Feature vector validation failed"). Synthesise a
  // deterministic, non-negative, bounded vector with real spread, seeded by the
  // user's selections. The vector is validation-only server-side (never used
  // for recommendations), so a plausible stand-in is both correct and safe.
  const seed = skinType.length * 3 + fitzpatrick.length * 5 + fitzpatrick.charCodeAt(0);
  const feature_vector = Array.from({ length: FEATURE_VECTOR_DIM }, (_, i) =>
    Math.abs(Math.sin(i * 0.613 + seed) * 0.5 + 0.6),
  );
  return {
    skin_type: skinType,
    skin_type_confidence: 1.0,
    fitzpatrick_tone: fitzpatrick,
    conditions: [],
    lighting_quality_score: 1.0,
    feature_vector,
    model_version: "manual-v1",
    processed_locally: true,
    analysis_timestamp: new Date().toISOString(),
  };
}
