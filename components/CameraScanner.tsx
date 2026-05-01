"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  SwitchCamera,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";

interface Props {
  onCapture: (files: File[]) => void;
  busy: boolean;
}

type CameraState = "idle" | "requesting" | "active" | "denied" | "unavailable";

export default function CameraScanner({ onCapture, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [flashFrame, setFlashFrame] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Start camera
  const startCamera = useCallback(
    async (facing: "environment" | "user" = facingMode) => {
      // Stop any existing stream first
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
        console.error("[camera]", err);
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

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState("idle");
  }, []);

  // Attach stream to video element once it's in the DOM
  useEffect(() => {
    if (cameraState === "active" && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error("[camera] play error", err);
      });
    }
  }, [cameraState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Switch front/back camera
  const switchCamera = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (cameraState === "active") {
      startCamera(next);
    }
  }, [facingMode, cameraState, startCamera]);

  // Capture a frame from the video feed
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || busy) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Flash effect
    setFlashFrame(true);
    setTimeout(() => setFlashFrame(false), 150);

    // Convert canvas to File
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );

    if (blob) {
      const file = new File([blob], `scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onCapture([file]);
    }
  }, [busy, onCapture]);

  // ─── Idle state ───
  if (cameraState === "idle") {
    return (
      <div
        onClick={startCamera.bind(null, facingMode)}
        role="button"
        tabIndex={0}
        className="group cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-accent/60 hover:bg-panel2 transition-colors min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-panel2 border border-border flex items-center justify-center mb-3 group-hover:bg-panel">
          <Camera className="w-5 h-5 text-accent" />
        </div>
        <p className="font-medium">Tap to open camera</p>
        <p className="text-sm text-muted mt-1">
          Point at a card and tap the shutter to scan it.
        </p>
      </div>
    );
  }

  // ─── Requesting / denied / unavailable ───
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

  if (cameraState === "denied" || cameraState === "unavailable") {
    return (
      <div className="rounded-xl border-2 border-dashed border-danger/40 bg-danger/5 min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center">
        <AlertCircle className="w-8 h-8 text-danger mb-3" />
        <p className="font-medium text-danger">Camera unavailable</p>
        <p className="text-sm text-muted mt-2 max-w-sm">{errorMsg}</p>
        <button
          className="btn mt-4"
          onClick={() => startCamera(facingMode)}
        >
          Try again
        </button>
      </div>
    );
  }

  // ─── Active camera ───
  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

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
        <div className="w-[70%] max-w-[280px] aspect-[2.5/3.5] border-2 border-white/30 rounded-xl" />
      </div>

      {/* Flash effect */}
      {flashFrame && (
        <div className="absolute inset-0 bg-white/70 pointer-events-none animate-pulse" />
      )}

      {/* Scanning overlay */}
      {busy && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-accent mb-3" />
          <p className="text-white font-medium">Scanning…</p>
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

          {/* Shutter button */}
          <button
            className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all ${
              busy
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105 active:scale-95"
            }`}
            onClick={captureFrame}
            disabled={busy}
            title="Capture card"
          >
            <div className="w-12 h-12 rounded-full bg-white" />
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
      </div>
    </div>
  );
}
