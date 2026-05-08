"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  SwitchCamera,
  Loader2,
  X,
  AlertCircle,
  Scan,
  Layers,
} from "lucide-react";

export type CameraMode = "listing" | "identify";

interface Props {
  onCapture: (files: File[]) => void;
  /** Only used in listing mode to show a subtle "processing" indicator */
  busy: boolean;
  mode?: CameraMode;
}

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable";
type DetectState = "waiting" | "stable" | "captured" | "cooldown";

// Motion detection constants
const PROBE_W = 80;
const PROBE_H = 112; // ~card aspect ratio
const PROBE_INTERVAL_MS = 450;
const MOTION_THRESHOLD = 10; // avg per-channel pixel diff (0–255)
const STABLE_FRAMES_NEEDED = 2; // consecutive stable frames before capture
const COOLDOWN_MS = 3000;

function frameDiff(a: ImageData, b: ImageData): number {
  let total = 0;
  const len = a.data.length;
  for (let i = 0; i < len; i += 4) {
    total +=
      (Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2])) /
      3;
  }
  return total / (len / 4);
}

export default function CameraScanner({
  onCapture,
  busy,
  mode = "listing",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Separate low-res probe canvas for motion detection — never shown
  const probeRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Motion detection state (refs — don't need re-renders)
  const prevFrameRef = useRef<ImageData | null>(null);
  const stableCountRef = useRef(0);
  const cooldownRef = useRef(false);
  const probeTimerRef = useRef<ReturnType<typeof setInterval>>();

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [flashFrame, setFlashFrame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detectState, setDetectState] = useState<DetectState>("waiting");

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = useCallback(
    async (facing: "environment" | "user" = facingMode) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraState("requesting");
      setErrorMsg(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setCameraState("active");
      } catch (err: any) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setCameraState("denied");
          setErrorMsg(
            "Camera access was denied. Please allow camera access in your browser settings."
          );
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          setCameraState("unavailable");
          setErrorMsg("No camera found on this device.");
        } else {
          setCameraState("unavailable");
          setErrorMsg(err?.message || "Could not access camera.");
        }
      }
    },
    [facingMode]
  );

  // ── Stop camera ───────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("idle");
    setDetectState("waiting");
  }, []);

  // Attach stream to video element once active
  useEffect(() => {
    if (cameraState === "active" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
      if (probeTimerRef.current) clearInterval(probeTimerRef.current);
    };
  }, []);

  // Switch front/back
  const switchCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (cameraState === "active") startCamera(next);
  }, [facingMode, cameraState, startCamera]);

  // ── Capture a full-res frame ──────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    setFlashFrame(true);
    setTimeout(() => setFlashFrame(false), 150);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (blob) {
      const file = new File([blob], `scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onCapture([file]);
    }
  }, [onCapture]);

  // ── Identify mode: motion detection auto-capture ──────────────────────────
  useEffect(() => {
    if (mode !== "identify" || cameraState !== "active") return;

    // Reset detection state when mode starts
    prevFrameRef.current = null;
    stableCountRef.current = 0;
    cooldownRef.current = false;
    setDetectState("waiting");

    probeTimerRef.current = setInterval(() => {
      if (cooldownRef.current) return;
      if (!videoRef.current || !probeRef.current) return;

      const video = videoRef.current;
      const probe = probeRef.current;
      probe.width = PROBE_W;
      probe.height = PROBE_H;
      const ctx = probe.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, PROBE_W, PROBE_H);
      const frame = ctx.getImageData(0, 0, PROBE_W, PROBE_H);

      if (prevFrameRef.current) {
        const diff = frameDiff(prevFrameRef.current, frame);
        if (diff < MOTION_THRESHOLD) {
          stableCountRef.current++;
          setDetectState("stable");
          if (stableCountRef.current >= STABLE_FRAMES_NEEDED) {
            // Card is stable — fire!
            stableCountRef.current = 0;
            cooldownRef.current = true;
            setDetectState("captured");
            captureFrame();
            setTimeout(() => {
              cooldownRef.current = false;
              prevFrameRef.current = null;
              setDetectState("waiting");
            }, COOLDOWN_MS);
          }
        } else {
          stableCountRef.current = 0;
          setDetectState("waiting");
        }
      }
      prevFrameRef.current = frame;
    }, PROBE_INTERVAL_MS);

    return () => {
      if (probeTimerRef.current) clearInterval(probeTimerRef.current);
      stableCountRef.current = 0;
      prevFrameRef.current = null;
      cooldownRef.current = false;
    };
  }, [mode, cameraState, captureFrame]);

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (cameraState === "idle") {
    return (
      <div
        onClick={() => startCamera(facingMode)}
        role="button"
        tabIndex={0}
        className="group cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-accent/60 hover:bg-panel2 transition-colors min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-panel2 border border-border flex items-center justify-center mb-3 group-hover:bg-panel">
          {mode === "identify" ? (
            <Scan className="w-5 h-5 text-accent" />
          ) : (
            <Camera className="w-5 h-5 text-accent" />
          )}
        </div>
        <p className="font-medium">Tap to open camera</p>
        <p className="text-sm text-muted mt-1">
          {mode === "identify"
            ? "Hold a card in frame — it will be identified automatically."
            : "Point at a card and tap the shutter to scan it."}
        </p>
      </div>
    );
  }

  // ── Requesting ────────────────────────────────────────────────────────────
  if (cameraState === "requesting") {
    return (
      <div className="rounded-xl border-2 border-dashed border-border min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
        <p className="font-medium">Requesting camera access…</p>
        <p className="text-sm text-muted mt-1">
          Allow access when prompted by your browser.
        </p>
      </div>
    );
  }

  // ── Denied / unavailable ──────────────────────────────────────────────────
  if (cameraState === "denied" || cameraState === "unavailable") {
    return (
      <div className="rounded-xl border-2 border-dashed border-danger/40 bg-danger/5 min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center">
        <AlertCircle className="w-8 h-8 text-danger mb-3" />
        <p className="font-medium text-danger">Camera unavailable</p>
        <p className="text-sm text-muted mt-2 max-w-sm">{errorMsg}</p>
        <button className="btn mt-4" onClick={() => startCamera(facingMode)}>
          Try again
        </button>
      </div>
    );
  }

  // ── Active camera ─────────────────────────────────────────────────────────
  // Corner bracket helper for identify mode overlay
  const cornerClass = "absolute w-6 h-6 border-white/70";
  const identifyBorderColor =
    detectState === "captured"
      ? "border-accent"
      : detectState === "stable"
      ? "border-accent/60"
      : "border-white/30";

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      {/* Hidden canvases */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={probeRef} className="hidden" />

      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full aspect-[3/4] sm:aspect-video object-cover"
      />

      {/* Card guide overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          className={`relative w-[70%] max-w-[280px] aspect-[2.5/3.5] rounded-xl transition-colors duration-300 ${
            mode === "identify" ? identifyBorderColor : "border-white/30"
          } border-2`}
        >
          {/* Corner brackets for identify mode */}
          {mode === "identify" && (
            <>
              <span
                className={`${cornerClass} top-0 left-0 border-t-2 border-l-2 rounded-tl-lg ${
                  detectState === "captured"
                    ? "border-accent"
                    : detectState === "stable"
                    ? "border-accent/70"
                    : "border-white/50"
                } transition-colors`}
              />
              <span
                className={`${cornerClass} top-0 right-0 border-t-2 border-r-2 rounded-tr-lg ${
                  detectState === "captured"
                    ? "border-accent"
                    : detectState === "stable"
                    ? "border-accent/70"
                    : "border-white/50"
                } transition-colors`}
              />
              <span
                className={`${cornerClass} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg ${
                  detectState === "captured"
                    ? "border-accent"
                    : detectState === "stable"
                    ? "border-accent/70"
                    : "border-white/50"
                } transition-colors`}
              />
              <span
                className={`${cornerClass} bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg ${
                  detectState === "captured"
                    ? "border-accent"
                    : detectState === "stable"
                    ? "border-accent/70"
                    : "border-white/50"
                } transition-colors`}
              />
            </>
          )}
        </div>
      </div>

      {/* Flash effect */}
      {flashFrame && (
        <div className="absolute inset-0 bg-white/70 pointer-events-none animate-pulse" />
      )}

      {/* Identify mode: status pill */}
      {mode === "identify" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm transition-colors ${
              detectState === "captured"
                ? "bg-accent text-black"
                : detectState === "stable"
                ? "bg-accent/20 border border-accent/50 text-accent"
                : detectState === "cooldown"
                ? "bg-white/10 border border-white/20 text-white/60"
                : "bg-black/40 border border-white/20 text-white/70"
            }`}
          >
            {detectState === "captured" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-black" />
                Captured!
              </>
            ) : detectState === "stable" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Hold still…
              </>
            ) : detectState === "cooldown" ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                Processing…
              </>
            ) : (
              <>
                <Scan className="w-3 h-3" />
                Point at a card
              </>
            )}
          </div>
        </div>
      )}

      {/* Listing mode: subtle "processing" indicator (non-blocking) */}
      {mode === "listing" && busy && (
        <div className="absolute top-3 right-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/20 backdrop-blur-sm text-xs text-white/80">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing…
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-6">
          {/* Switch camera */}
          <button
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
            onClick={switchCamera}
            title="Switch camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>

          {/* Shutter — always active in listing mode; manual override in identify mode */}
          <button
            className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all ${
              mode === "identify"
                ? detectState === "cooldown"
                  ? "border-white/30 opacity-40 cursor-not-allowed"
                  : "border-accent hover:scale-105 active:scale-95"
                : "border-white hover:scale-105 active:scale-95"
            }`}
            onClick={captureFrame}
            disabled={mode === "identify" && detectState === "cooldown"}
            title={
              mode === "identify"
                ? "Tap to capture manually"
                : "Capture card"
            }
          >
            <div
              className={`w-12 h-12 rounded-full ${
                mode === "identify" ? "bg-accent" : "bg-white"
              }`}
            />
          </button>

          {/* Close camera */}
          <button
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
            onClick={stopCamera}
            title="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode label */}
        <p className="text-center text-[10px] text-white/40 mt-2">
          {mode === "identify"
            ? "Auto-capture · tap shutter to override"
            : "Tap shutter after each card — camera stays live"}
        </p>
      </div>
    </div>
  );
}
