/**
 * TensorFlow.js skin analysis model loader and inference wrapper.
 * Model files live in /public/models/skin_model/model.json
 */

import type { TFJSResult, SkinType, SkinCondition } from "@skin-analysis/shared-types";

const MODEL_URL = "/models/skin_model/model.json";
const INPUT_SIZE = 224;

const SKIN_TYPE_CLASSES: SkinType[] = ["dry", "oily", "combination", "normal", "sensitive"];
const CONDITION_CLASSES: SkinCondition[] = [
  "acne", "pigmentation", "dark_circles", "uneven_tone",
  "wrinkles", "dehydration", "redness", "enlarged_pores",
];

let model: any | null = null;

export async function loadSkinModel(): Promise<void> {
  // Dynamically import TF.js to avoid SSR issues
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");
  await tf.ready();
  model = await tf.loadLayersModel(MODEL_URL);
}

export async function analyzeSkin(imageElement: HTMLVideoElement | HTMLImageElement): Promise<TFJSResult> {
  if (!model) await loadSkinModel();

  const tf = await import("@tensorflow/tfjs");

  const tensor = tf.tidy(() => {
    const img = tf.browser.fromPixels(imageElement);
    const resized = tf.image.resizeBilinear(img, [INPUT_SIZE, INPUT_SIZE]);
    const normalized = resized.div(255.0);
    return normalized.expandDims(0);
  });

  const predictions = model!.predict(tensor) as any;
  const skinTypeProbs: number[] = await predictions[0].data();
  const conditionProbs: number[] = await predictions[1].data();
  tensor.dispose();

  const confidenceScores = Object.fromEntries(
    SKIN_TYPE_CLASSES.map((cls, i) => [cls, skinTypeProbs[i]])
  ) as Record<SkinType, number>;

  const skinType = SKIN_TYPE_CLASSES[
    skinTypeProbs.indexOf(Math.max(...skinTypeProbs))
  ];

  const conditions = CONDITION_CLASSES.filter((_, i) => conditionProbs[i] > 0.5);

  return { skinType, conditions, confidenceScores };
}
