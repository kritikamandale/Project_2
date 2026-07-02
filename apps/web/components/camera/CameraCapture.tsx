"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Camera, RefreshCw, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  analyzeFrame,
  buildManualResult,
  loadSkinModel,
  MANUAL_SKIN_OPTIONS,
  type FaceBounds,
  type FitzpatrickTone,
  type SkinAnalysisResult,
  type SkinType,
} from "@/lib/ai/skinAnalysis";

// localStorage flag set after the analysis models load successfully once —
// used to show "first time takes longer" copy only on genuinely fresh visits.
const MODELS_CACHED_KEY = "skinai_models_cached_v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LightingQuality = "good" | "acceptable" | "poor";

interface LightingData {
  quality: LightingQuality;
  mean: number;
  std: number;
  guidance: string;
}

interface FaceGuide {
  isCentered: boolean;
  sizeOk: boolean;
  instruction: string;
  bounds: FaceBounds | null;
}

type CaptureStatus =
  | "idle"
  | "requesting"
  | "active"
  | "countdown"
  | "capturing"
  | "analyzing"
  | "preview"
  | "submitting"
  | "done"
  | "error"
  | "fallback";

interface State {
  status: CaptureStatus;
  countdown: number;
  analysisStep: string;
  analysisProgress: number;
  capturedDataUrl: string;
  result: SkinAnalysisResult | null;
  errorMessage: string;
  scanId: string;
  manualSkinType: SkinType | null;
  manualFitzpatrick: FitzpatrickTone | null;
}

type Action =
  | { type: "REQUEST" }
  | { type: "CAMERA_READY" }
  | { type: "COUNTDOWN"; count: number }
  | { type: "CAPTURING" }
  | { type: "ANALYZING"; step: string; progress: number }
  | { type: "PREVIEW"; dataUrl: string; result: SkinAnalysisResult }
  | { type: "DONE"; scanId: string }
  | { type: "ERROR"; message: string }
  | { type: "RETAKE" }
  | { type: "FALLBACK"; capturedDataUrl?: string }
  | { type: "SET_MANUAL_SKIN"; value: SkinType }
  | { type: "SET_MANUAL_FITZPATRICK"; value: FitzpatrickTone };

const initialState: State = {
  status: "idle",
  countdown: 3,
  analysisStep: "",
  analysisProgress: 0,
  capturedDataUrl: "",
  result: null,
  errorMessage: "",
  scanId: "",
  manualSkinType: null,
  manualFitzpatrick: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "REQUEST": return { ...state, status: "requesting" };
    case "CAMERA_READY": return { ...state, status: "active" };
    case "COUNTDOWN": return { ...state, status: "countdown", countdown: action.count };
    case "CAPTURING": return { ...state, status: "capturing" };
    case "ANALYZING": return { ...state, status: "analyzing", analysisStep: action.step, analysisProgress: action.progress };
    case "PREVIEW": return { ...state, status: "preview", capturedDataUrl: action.dataUrl, result: action.result };
    case "DONE": return { ...state, status: "done", scanId: action.scanId, capturedDataUrl: "" };
    case "ERROR": return { ...state, status: "error", errorMessage: action.message };
    case "RETAKE": return { ...initialState, status: "active" };
    case "FALLBACK": return { ...state, status: "fallback", capturedDataUrl: action.capturedDataUrl ?? state.capturedDataUrl };
    case "SET_MANUAL_SKIN": return { ...state, manualSkinType: action.value };
    case "SET_MANUAL_FITZPATRICK": return { ...state, manualFitzpatrick: action.value };
    default: return state;
  }
}

// ---------------------------------------------------------------------------
// Lighting analysis (synchronous, runs every animation frame)
// ---------------------------------------------------------------------------

function analyzeLighting(video: HTMLVideoElement, canvas: HTMLCanvasElement): LightingData {
  const w = 320, h = 240;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let sum = 0;
  const n = data.length / 4;
  const lums: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += lum;
    lums.push(lum);
  }

  const mean = sum / n;
  const variance = lums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  // Check bottom-half darkness (shadow on chin/neck)
  let bottomSum = 0;
  let topSum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (y < h / 2) topSum += lum; else bottomSum += lum;
    }
  }
  const shadowRatio = bottomSum / (topSum + 1);

  let quality: LightingQuality;
  let guidance: string;

  if (mean > 150 && std > 20 && shadowRatio > 0.6) {
    quality = "good";
    guidance = "Perfect lighting — hold still";
  } else if (mean >= 100) {
    quality = "acceptable";
    guidance = mean < 100 ? "Move to a brighter area" : "Remove shadows from your face";
  } else {
    quality = "poor";
    guidance = "Move to a brighter area";
  }

  if (shadowRatio < 0.5) guidance = "Remove shadows from face";

  return { quality, mean, std, guidance };
}

// ---------------------------------------------------------------------------
// Draw face oval guide on overlay canvas
// ---------------------------------------------------------------------------

function drawFaceGuide(
  canvas: HTMLCanvasElement,
  videoWidth: number,
  videoHeight: number,
  guide: FaceGuide,
  lighting: LightingData,
) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / videoWidth;
  const scaleY = canvas.height / videoHeight;
  const cx = (canvas.width / 2);
  const cy = (canvas.height / 2) - 20;
  const rx = (videoWidth * 0.22) * scaleX;
  const ry = (videoHeight * 0.32) * scaleY;

  const canCapture =
    lighting.quality === "good" &&
    guide.isCentered &&
    guide.sizeOk;

  const color = canCapture
    ? "rgba(34, 197, 94, 0.9)"    // green
    : guide.isCentered && guide.sizeOk
    ? "rgba(234, 179, 8, 0.9)"    // yellow — lighting issue
    : "rgba(239, 68, 68, 0.7)";   // red — position issue

  // Outer dim overlay (darken everything outside oval)
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Oval border
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash(guide.isCentered ? [] : [12, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Corner tick marks
  const tickAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  tickAngles.forEach((angle) => {
    const tx = cx + Math.cos(angle) * rx;
    const ty = cy + Math.sin(angle) * ry;
    const nx = Math.cos(angle) * 12;
    const ny = Math.sin(angle) * 12;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + nx, ty + ny);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Face bbox if detected
  if (guide.bounds) {
    const { x, y, width, height } = guide.bounds;
    ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x * scaleX, y * scaleY, width * scaleX, height * scaleY);
    ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------------------
// Face detection (wraps @tensorflow-models/face-detection dynamically)
// ---------------------------------------------------------------------------

let faceDetector: { estimateFaces: (img: HTMLVideoElement) => Promise<any[]> } | null = null;
let detectorLoading = false;

async function getFaceDetector() {
  if (faceDetector) return faceDetector;
  if (detectorLoading) return null;
  detectorLoading = true;
  try {
    const faceDetection = await import("@tensorflow-models/face-detection");
    faceDetector = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      { runtime: "tfjs" as const },
    );
    return faceDetector;
  } catch {
    return null;
  } finally {
    detectorLoading = false;
  }
}

async function detectFaceGuide(
  video: HTMLVideoElement,
): Promise<FaceGuide> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  try {
    const detector = await getFaceDetector();
    // If TF model is unavailable, allow capture without face detection
    if (!detector) return { isCentered: true, sizeOk: true, instruction: "Position your face in the oval", bounds: null };

    const faces = await detector.estimateFaces(video);
    if (!faces.length) {
      return { isCentered: true, sizeOk: true, instruction: "Hold still and look at the camera", bounds: null };
    }

    const face = faces[0];
    const bb = face.box ?? face.boundingBox;
    const { xMin, yMin, width, height } = bb;

    const bounds: FaceBounds = { x: xMin, y: yMin, width, height };

    // Face center relative to frame
    const faceCx = (xMin + width / 2) / vw;
    const faceCy = (yMin + height / 2) / vh;
    const isCentered = Math.abs(faceCx - 0.5) < 0.20 && Math.abs(faceCy - 0.5) < 0.20;

    // Face size: height should occupy 40–70% of frame height
    const sizeRatio = height / vh;
    const tooSmall = sizeRatio < 0.40;
    const tooBig = sizeRatio > 0.70;
    const sizeOk = !tooSmall && !tooBig;

    let instruction: string;
    if (!isCentered) instruction = "Center your face in the oval";
    else if (tooSmall) instruction = "Move closer to the camera";
    else if (tooBig) instruction = "Move back a little";
    else instruction = "Perfect — hold still";

    return { isCentered, sizeOk, instruction, bounds };
  } catch {
    return { isCentered: true, sizeOk: true, instruction: "Hold still", bounds: null };
  }
}

// ---------------------------------------------------------------------------
// EXIF stripping — draw to canvas, re-export as blob (strips all EXIF)
// ---------------------------------------------------------------------------

function captureExifStrippedFrame(
  video: HTMLVideoElement,
  targetWidth = 1280,
  targetHeight = 960,
): { dataUrl: string; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  // Drawing the video frame to a new canvas and exporting as dataURL discards
  // any EXIF metadata that might have been embedded in the video stream.
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
  // Return the canvas too: analysis must run against this frozen frame, not the
  // live <video>, which unmounts the instant status leaves "countdown" and would
  // then be a 0×0 element (→ "Requested texture size [0x0] is invalid").
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), canvas };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CameraCaptureProps {
  onComplete: (result: SkinAnalysisResult, scanId: string) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CameraCapture({ onComplete, onCancel }: CameraCaptureProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [lighting, setLighting] = useState<LightingData>({
    quality: "poor",
    mean: 0,
    std: 0,
    guidance: "Starting camera…",
  });
  const [faceGuide, setFaceGuide] = useState<FaceGuide>({
    isCentered: false,
    sizeOk: false,
    instruction: "Center your face in the oval",
    bounds: null,
  });

  const webcamRef = useRef<Webcam>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const lightingCanvasRef = useRef<HTMLCanvasElement>(null);
  const countdownRef = useRef<ReturnType<typeof setTimeout>>();

  // On-device model readiness. "idle" → loading is kicked off by the effect
  // below; firstTime differentiates the (slower) first visit copy from
  // subsequent cached loads.
  const [modelState, setModelState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [firstTime] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MODELS_CACHED_KEY) !== "1";
    } catch {
      return true;
    }
  });

  // Allow capture in good/acceptable lighting once the models are ready;
  // face-detection is advisory only
  const canCapture =
    state.status === "active" &&
    lighting.quality !== "poor" &&
    modelState === "ready";

  // ---------------------------------------------------------------------------
  // Real-time lighting analysis loop (every animation frame)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== "active") return;
    let frameId = 0;

    const lightingLoop = () => {
      const video = webcamRef.current?.video;
      const canvas = lightingCanvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const result = analyzeLighting(video, canvas);
        setLighting(result);
      }
      frameId = requestAnimationFrame(lightingLoop);
    };

    frameId = requestAnimationFrame(lightingLoop);
    return () => cancelAnimationFrame(frameId);
  }, [state.status]);

  // ---------------------------------------------------------------------------
  // Face detection loop (every ~250ms)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== "active") return;
    let active = true;

    const detectLoop = async () => {
      while (active) {
        const video = webcamRef.current?.video;
        if (video && video.readyState >= 2) {
          const guide = await detectFaceGuide(video);
          if (active) setFaceGuide(guide);
        }
        await new Promise<void>((r) => setTimeout(r, 250));
      }
    };

    detectLoop();
    return () => { active = false; };
  }, [state.status]);

  // ---------------------------------------------------------------------------
  // Overlay canvas drawing (every animation frame when active)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== "active") return;
    let frameId = 0;

    const drawLoop = () => {
      const video = webcamRef.current?.video;
      const canvas = overlayRef.current;
      if (video && canvas && video.readyState >= 2) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        drawFaceGuide(canvas, video.videoWidth, video.videoHeight, faceGuide, lighting);
      }
      frameId = requestAnimationFrame(drawLoop);
    };

    frameId = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(frameId);
  }, [state.status, faceGuide, lighting]);

  // ---------------------------------------------------------------------------
  // Pre-load the on-device analysis models while the camera is active.
  // The download + GPU warm-up can take a while (especially on a first visit
  // when nothing is browser-cached), so surface a visible, reassuring loading
  // state and hold the shutter disabled until everything is ready.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state.status !== "active" || modelState !== "idle") return;
    setModelState("loading");
    loadSkinModel()
      .then(() => {
        setModelState("ready");
        try {
          localStorage.setItem(MODELS_CACHED_KEY, "1");
        } catch { /* private mode — treat every visit as first-time */ }
      })
      .catch(() => setModelState("error"));
  }, [state.status, modelState]);

  const retryModelLoad = useCallback(() => setModelState("idle"), []);

  // ---------------------------------------------------------------------------
  // Countdown
  // ---------------------------------------------------------------------------
  const startCountdown = useCallback(() => {
    if (!canCapture) return;
    dispatch({ type: "COUNTDOWN", count: 3 });
  }, [canCapture]);

  useEffect(() => {
    if (state.status !== "countdown") return;
    if (state.countdown <= 0) {
      runCapture();
      return;
    }
    countdownRef.current = setTimeout(() => {
      dispatch({ type: "COUNTDOWN", count: state.countdown - 1 });
    }, 1000);
    return () => clearTimeout(countdownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.countdown]);

  // ---------------------------------------------------------------------------
  // Capture + analysis pipeline
  // ---------------------------------------------------------------------------
  const runCapture = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video) { dispatch({ type: "ERROR", message: "Camera feed lost" }); return; }
    // The video must still be a live frame here. If it reports 0×0 the stream
    // isn't ready — capturing now would produce a blank/invalid frame.
    if (!video.videoWidth || !video.videoHeight) {
      dispatch({ type: "ERROR", message: "Camera not ready yet — please wait a moment and try again." });
      return;
    }

    dispatch({ type: "CAPTURING" });
    // EXIF stripping happens here: drawing to a new canvas and re-exporting
    // as dataURL removes all metadata embedded in the original video frame.
    // Capture the frozen canvas now (video is still mounted) and analyze THAT —
    // the <video> unmounts as soon as we leave the countdown state.
    const { dataUrl, canvas: frameCanvas } = captureExifStrippedFrame(video);

    dispatch({ type: "ANALYZING", step: "Getting your photo ready…", progress: 15 });
    await tick();

    try {
      dispatch({ type: "ANALYZING", step: "This can take a moment — analysing your skin…", progress: 30 });
      await tick();

      dispatch({ type: "ANALYZING", step: "Looking closely at your skin…", progress: 55 });
      const bounds = faceGuide.bounds ?? undefined;
      const lightingScore = lighting.mean / 255;
      const result = await analyzeFrame(frameCanvas, bounds, lightingScore);

      dispatch({ type: "ANALYZING", step: "Working out your skin type…", progress: 75 });
      await tick();

      dispatch({ type: "ANALYZING", step: "Almost there — summarising what we found…", progress: 90 });
      await tick();

      dispatch({ type: "PREVIEW", dataUrl, result });
    } catch (err) {
      const msg = (err as Error).message ?? "Analysis failed";
      if (msg.includes("unavailable")) {
        // Model not available — go to manual mode and keep the captured photo for reference
        dispatch({ type: "FALLBACK", capturedDataUrl: dataUrl });
      } else {
        dispatch({ type: "ERROR", message: msg });
      }
    }
  }, [faceGuide, lighting]);

  // ---------------------------------------------------------------------------
  // Submit feature vector to API
  // ---------------------------------------------------------------------------
  const handleConfirm = useCallback(async () => {
    if (!state.result) return;
    dispatch({ type: "ANALYZING", step: "Saving analysis…", progress: 95 });

    try {
      const { submitScan } = await import("@/lib/api/scan");
      const scanResponse = await submitScan(state.result);
      dispatch({ type: "DONE", scanId: scanResponse.scan_id });
      onComplete(state.result, scanResponse.scan_id);
    } catch (err) {
      dispatch({ type: "ERROR", message: (err as Error).message ?? "Failed to save scan" });
    }
  }, [state.result, onComplete]);

  // ---------------------------------------------------------------------------
  // Manual fallback: submit user-selected skin type
  // ---------------------------------------------------------------------------
  const handleManualSubmit = useCallback(async () => {
    const { manualSkinType, manualFitzpatrick } = state;
    if (!manualSkinType || !manualFitzpatrick) return;

    dispatch({ type: "ANALYZING", step: "Saving your selection…", progress: 95 });
    const result = buildManualResult(manualSkinType, manualFitzpatrick);

    try {
      const { submitScan } = await import("@/lib/api/scan");
      const scanResponse = await submitScan(result);
      dispatch({ type: "DONE", scanId: scanResponse.scan_id });
      onComplete(result, scanResponse.scan_id);
    } catch (err) {
      dispatch({ type: "ERROR", message: (err as Error).message ?? "Failed to save selection" });
    }
  }, [state, onComplete]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const lightingColors: Record<LightingQuality, string> = {
    good: "text-green-400",
    acceptable: "text-yellow-400",
    poor: "text-red-400",
  };

  const lightingIcons: Record<LightingQuality, string> = {
    good: "🟢",
    acceptable: "🟡",
    poor: "🔴",
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative w-full h-full min-h-screen bg-black flex flex-col overflow-hidden">

      {/* ── Privacy banner ──────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center gap-2 px-4 py-2 bg-black/70 border-b border-white/10 text-xs text-white/80">
        <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
        <span>
          Your photo never leaves your device. We analyse your skin locally and only
          send skin characteristics — not your image.{" "}
          <a href="/DATA_PRIVACY.md" target="_blank" rel="noreferrer" className="underline text-teal-300">
            Learn more
          </a>
        </span>
        <button onClick={onCancel} className="ml-auto text-white/60 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Hidden canvases for processing ──────────────────────────────── */}
      <canvas ref={lightingCanvasRef} className="hidden" />

      {/* ── Main camera area ────────────────────────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center bg-black">

        {/* Camera feed */}
        {(state.status === "idle" || state.status === "requesting" || state.status === "active" || state.status === "countdown") && (
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            videoConstraints={{ width: 1280, height: 960, facingMode: "user" }}
            onUserMedia={() => dispatch({ type: "CAMERA_READY" })}
            onUserMediaError={() =>
              dispatch({ type: "ERROR", message: "Camera access denied. Please allow camera permission and try again." })
            }
            className="w-full h-full object-cover"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          />
        )}

        {/* Face detection overlay canvas */}
        {state.status === "active" && (
          <canvas
            ref={overlayRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}

        {/* ── Lighting indicator ──────────────────────────────────────── */}
        <AnimatePresence>
          {state.status === "active" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 backdrop-blur-sm"
            >
              <span className="text-sm">{lightingIcons[lighting.quality]}</span>
              <span className={`text-xs font-medium ${lightingColors[lighting.quality]}`}>
                {lighting.guidance}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Face guide instruction ────────────────────────────────── */}
        <AnimatePresence>
          {state.status === "active" && (
            <motion.div
              key={faceGuide.instruction}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-28 left-0 right-0 flex justify-center"
            >
              <div className="bg-black/60 rounded-full px-4 py-2 backdrop-blur-sm">
                <span className="text-sm text-white">{faceGuide.instruction}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Model preparation status (download + warm-up) ──────────── */}
        <AnimatePresence>
          {state.status === "active" && modelState !== "ready" && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-20 left-0 right-0 flex justify-center px-6"
            >
              {modelState === "error" ? (
                <button
                  onClick={retryModelLoad}
                  className="flex items-center gap-2 bg-rose-500/90 rounded-full px-4 py-2 backdrop-blur-sm hover:bg-rose-500 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  <span className="text-xs text-white font-medium">
                    Couldn&apos;t get the analysis ready — tap to retry
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5 bg-black/60 rounded-full px-4 py-2 backdrop-blur-sm">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin shrink-0" />
                  <span className="text-xs text-white/90">
                    {firstTime
                      ? "Setting things up for your first scan — this takes a little longer the first time…"
                      : "Getting your scan ready — just a moment…"}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Countdown overlay ──────────────────────────────────────── */}
        <AnimatePresence>
          {state.status === "countdown" && state.countdown > 0 && (
            <motion.div
              key={state.countdown}
              initial={{ scale: 1.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <span className="text-white font-bold text-9xl drop-shadow-2xl">
                {state.countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Analyzing overlay ──────────────────────────────────────── */}
        <AnimatePresence>
          {(state.status === "capturing" || state.status === "analyzing" || state.status === "submitting") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-6"
            >
              <div className="w-16 h-16 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
              <div className="text-center space-y-2">
                <p className="text-white font-semibold">{state.analysisStep || "Analysing skin…"}</p>
                <div className="w-64 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-teal-500 to-teal-700 rounded-full"
                    style={{ width: `${state.analysisProgress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="font-number text-xs text-white/50">{state.analysisProgress}%</p>
              </div>
              {/* Step indicators */}
              <div className="flex gap-3 text-xs text-white/60">
                {["Photo", "Analysis", "Skin check", "Saving"].map((s, i) => (
                  <span
                    key={s}
                    className={state.analysisProgress > i * 25 ? "text-teal-400" : ""}
                  >
                    {i > 0 && <span className="mr-3 opacity-30">›</span>}
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Preview overlay ────────────────────────────────────────── */}
        <AnimatePresence>
          {state.status === "preview" && state.result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-6 p-6"
            >
              {/* Blurred preview — user confirms they see only a blurred version */}
              <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.capturedDataUrl}
                  alt="Captured frame (blurred for privacy)"
                  className="w-full h-full object-cover"
                  style={{ filter: "blur(20px)", transform: "scale(1.1)" }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/60 rounded-xl px-3 py-1.5 text-xs text-white/80 text-center">
                    Photo blurred<br />for privacy
                  </div>
                </div>
              </div>

              {/* Analysis summary */}
              <div className="text-center space-y-1">
                <h3 className="text-white font-semibold text-lg">Analysis complete</h3>
                <p className="text-white/60 text-sm">
                  Skin type:{" "}
                  <span className="text-teal-300 font-medium capitalize">
                    {state.result.skin_type}
                  </span>{" "}
                  (<span className="font-number">{Math.round(state.result.skin_type_confidence * 100)}%</span> confidence)
                </p>
                <p className="text-white/60 text-sm">
                  Fitzpatrick tone:{" "}
                  <span className="text-teal-300 font-medium">
                    Type {state.result.fitzpatrick_tone}
                  </span>
                </p>
                {state.result.conditions.length > 0 && (
                  <p className="text-white/60 text-sm">
                    {state.result.conditions.length} condition(s) detected
                  </p>
                )}
              </div>

              {/* Bias warning */}
              {(["IV", "V", "VI"] as FitzpatrickTone[]).includes(state.result.fitzpatrick_tone) &&
                state.result.skin_type_confidence < 0.70 && (
                <Alert className="bg-amber-900/40 border-amber-600/50 max-w-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <AlertDescription className="text-amber-200 text-xs">
                    Lower confidence for your skin tone. You can retake or override manually.
                  </AlertDescription>
                </Alert>
              )}

              {/* Privacy confirmation — photo is still in memory until Confirm is clicked */}
              <p className="text-green-400 text-xs text-center max-w-xs">
                ✓ Your photo stays on this device and will be deleted once you confirm.
              </p>

              <div className="flex gap-3 w-full max-w-xs">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                  onClick={() => dispatch({ type: "RETAKE" })}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retake
                </Button>
                <Button
                  className="flex-1 bg-skin-500 hover:bg-skin-600 text-white"
                  onClick={handleConfirm}
                >
                  Confirm
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Done overlay ───────────────────────────────────────────── */}
        <AnimatePresence>
          {state.status === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4"
            >
              <div className="text-6xl">✅</div>
              <h3 className="text-white font-semibold text-xl">Scan saved!</h3>
              <p className="text-green-400 text-sm text-center max-w-xs px-4">
                Your photo has been deleted. Only skin data was saved.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error overlay ──────────────────────────────────────────── */}
        <AnimatePresence>
          {state.status === "error" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4 p-6"
            >
              <div className="text-5xl">⚠️</div>
              <p className="text-white text-center">{state.errorMessage}</p>
              <div className="flex gap-3">
                <Button variant="outline" className="border-white/20 text-white" onClick={() => dispatch({ type: "RETAKE" })}>
                  Try again
                </Button>
                <Button variant="ghost" className="text-white/60" onClick={() => dispatch({ type: "FALLBACK" })}>
                  Use manual input
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Requesting permission ────────────────────────────────── */}
        {state.status === "requesting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white/70 space-y-3">
              <Camera className="w-12 h-12 mx-auto animate-pulse" />
              <p>Requesting camera access…</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Capture button ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {state.status === "active" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative z-20 flex items-center justify-center gap-6 py-6 bg-black"
          >
            <div className="text-center text-xs text-white/40 w-24">
              {!canCapture && (
                <span>
                  {modelState !== "ready"
                    ? "Preparing…"
                    : lighting.quality === "poor"
                    ? "Need better lighting"
                    : "Position face"}
                </span>
              )}
            </div>

            <button
              onClick={startCountdown}
              disabled={!canCapture}
              className={`w-20 h-20 rounded-full border-4 transition-all duration-300 flex items-center justify-center
                ${canCapture
                  ? "border-white bg-white/10 hover:bg-white/20 active:scale-95 shadow-[0_0_24px_rgba(255,255,255,0.3)]"
                  : "border-white/20 bg-white/5 cursor-not-allowed opacity-50"
                }`}
              aria-label="Capture"
            >
              <div className={`w-14 h-14 rounded-full ${canCapture ? "bg-white" : "bg-white/30"}`} />
            </button>

            <div className="text-xs text-white/40 w-24 text-right">
              {canCapture && <span className="text-green-400">Ready</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Manual skin-type selection (shown after capture when AI model is unavailable) ── */}
      <AnimatePresence>
        {state.status === "fallback" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 z-30 bg-slate-950 overflow-y-auto p-6"
          >
            <div className="max-w-lg mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold text-xl">Tell us about your skin</h2>
                <button onClick={onCancel} className="text-white/40 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Show blurred captured photo as reference */}
              {state.capturedDataUrl && (
                <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={state.capturedDataUrl}
                      alt="Your captured photo"
                      className="w-full h-full object-cover"
                      style={{ filter: "blur(12px)", transform: "scale(1.15)" }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-lg">📸</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Photo captured!</p>
                    <p className="text-white/50 text-xs mt-0.5">
                      Use your photo as reference to select your skin type below.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-white/70 text-sm">
                Choose the description that best matches your skin:
              </p>

              <div className="grid gap-3">
                {MANUAL_SKIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => dispatch({ type: "SET_MANUAL_SKIN", value: opt.type })}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      state.manualSkinType === opt.type
                        ? "border-skin-500 bg-skin-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{opt.label}</span>
                      {state.manualSkinType === opt.type && (
                        <span className="text-skin-400 text-xs">Selected ✓</span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm">{opt.description}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {opt.signs.map((s) => (
                        <li key={s} className="text-xs bg-white/10 rounded-full px-2 py-0.5 text-white/70">
                          {s}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-teal-300/70">{opt.fitzpatrickNote}</p>
                  </button>
                ))}
              </div>

              {/* Fitzpatrick selector */}
              <div>
                <p className="text-white/80 text-sm font-medium mb-3">Select your skin tone (Fitzpatrick scale)</p>
                <div className="flex gap-2">
                  {(["I", "II", "III", "IV", "V", "VI"] as FitzpatrickTone[]).map((tone, i) => {
                    const colors = ["#FDDBB4", "#F5C28A", "#E0A96D", "#C68642", "#8D5524", "#4A2912"];
                    return (
                      <button
                        key={tone}
                        onClick={() => dispatch({ type: "SET_MANUAL_FITZPATRICK", value: tone })}
                        className={`flex-1 aspect-square rounded-lg border-2 transition-all ${
                          state.manualFitzpatrick === tone ? "border-white scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: colors[i] }}
                        aria-label={`Fitzpatrick Type ${tone}`}
                        title={`Type ${tone}`}
                      />
                    );
                  })}
                </div>
                {state.manualFitzpatrick && (
                  <p className="text-white/60 text-xs mt-2">
                    Selected: Type {state.manualFitzpatrick}
                  </p>
                )}
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={!state.manualSkinType || !state.manualFitzpatrick}
                className="w-full bg-skin-500 hover:bg-skin-600 text-white"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tick(ms = 50): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
