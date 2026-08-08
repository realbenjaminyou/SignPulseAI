import { useCallback, useEffect, useRef, useState } from "react";
import {
  type LandmarkFrame,
  type SpeechTranscription,
  type TranscriptEntry,
  type SessionState,
  type StatusMessage,
} from "../lib/types";
import {
  interpretGesture,
  assembleSentence,
  generateTTS,
  playTTSAudio,
  getSTTToken,
} from "../lib/supabase";
import { CONFIG } from "../lib/config";

// ---------------------------------------------------------------------------
// Speechmatics STT WebSocket
// ---------------------------------------------------------------------------
function createSTTConnection(
  token: string,
  onTranscription: (t: SpeechTranscription) => void,
  onError: (e: string) => void,
  stream: MediaStream,
): { close: () => void } {
  const ws = new WebSocket(
    `${CONFIG.SPEECHMATICS_STT_WS}?jwt=${token}`,
  );

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        message: "StartRecognition",
        audio_format: { type: "raw" },
        transcription_config: {
          language: "en",
          enable_partials: true,
          max_delay: 2,
        },
      }),
    );
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.message === "AddTranscript") {
        onTranscription({
          text:
            msg.results
              ?.map((r: { transcript: string }) => r.transcript)
              .join(" ") ?? "",
          is_final: !msg.results?.some(
            (r: { type: string }) => r.type === "partial",
          ),
        });
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onerror = () => onError("Speech recognition connection lost");

  // Pipe mic audio to WebSocket
  const micTrack = stream.getAudioTracks()[0];
  let mediaRecorder: MediaRecorder | null = null;

  if (micTrack) {
    const audioStream = new MediaStream([micTrack]);
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: mime });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        e.data.arrayBuffer().then((buf) => ws.send(buf));
      }
    };
    mediaRecorder.start(250);
  }

  const close = () => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ message: "StopRecognition" }));
      }
    } catch { /* ignore */ }
    ws.close();
    mediaRecorder?.stop();
  };

  return { close };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTranslationPipeline() {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [currentSentence, setCurrentSentence] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<StatusMessage>({
    type: "info",
    text: "Ready — press Start Session to begin",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  // Refs for persistent state (no useCallback deps)
  const bufferRef = useRef<LandmarkFrame[]>([]);
  const lastLandmarksRef = useRef<number[][] | null>(null);
  const lastGestureRef = useRef<string | null>(null);
  const speechTextRef = useRef("");
  const lastSentenceRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lmRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const noHandsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sttRef = useRef<{ close: () => void } | null>(null);
  const busyRef = useRef(false);

  const log = useCallback(
    (event: string, details?: Record<string, unknown>, error?: string) => {
      console.log(`[Pipeline] ${event}`, details ?? "", error ?? "");
    },
    [],
  );

  // ---- average landmarks ----
  const averageLandmarks = useCallback((frames: LandmarkFrame[]): number[][] => {
    if (frames.length === 0) return [];
    const numHands = Math.max(...frames.map((f) => f.hands.length));
    const result: number[][] = [];
    for (let h = 0; h < numHands; h++) {
      const handFrames = frames.filter((f) => f.hands.length > h).map((f) => f.hands[h]);
      if (handFrames.length === 0) continue;
      const avg: number[] = [];
      for (let i = 0; i < 21; i++) {
        const xs = handFrames.map((l) => l[i]?.x ?? 0);
        const ys = handFrames.map((l) => l[i]?.y ?? 0);
        const zs = handFrames.map((l) => l[i]?.z ?? 0);
        avg.push(
          xs.reduce((a, b) => a + b, 0) / xs.length,
          ys.reduce((a, b) => a + b, 0) / ys.length,
          zs.reduce((a, b) => a + b, 0) / zs.length,
        );
      }
      result.push(avg);
    }
    return result;
  }, []);

  // ---- debounce ----
  const hasMoved = useCallback(
    (current: number[][], prev: number[][] | null): boolean => {
      if (!prev) return current.length > 0;
      if (current.length !== prev.length) return true;
      if (current.length === 0) return false;
      let max = 0;
      for (let h = 0; h < current.length; h++) {
        for (let i = 0; i < Math.min(current[h].length, prev[h]?.length ?? 0); i++) {
          const d = Math.abs(current[h][i] - prev[h][i]);
          if (d > max) max = d;
        }
      }
      return max > CONFIG.MOVEMENT_THRESHOLD;
    },
    [],
  );

  // ---- assemble + display (uses refs, no callback deps issues) ----
  const assembleAndDisplay = useCallback(async () => {
    const gesture = lastGestureRef.current;
    const speech = speechTextRef.current || null;
    if (!gesture && !speech) return;

    try {
      abortRef.current = new AbortController();
      log("assemble", { gesture, speech });
      const sentence = await assembleSentence(gesture, speech, abortRef.current.signal);
      if (sentence === lastSentenceRef.current) return;
      lastSentenceRef.current = sentence;

      setCurrentSentence(sentence);
      setTranscriptHistory((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: sentence, timestamp: Date.now(), isNew: true },
      ]);
      log("assemble success", { sentence });
      setStatus({ type: "success", text: "Translation ready" });

      if (autoPlay) {
        setIsSpeaking(true);
        try {
          const audio = await generateTTS(sentence);
          await playTTSAudio(audio);
        } catch (e) {
          log("tts failed", undefined, String(e));
        } finally {
          setIsSpeaking(false);
        }
      }
      speechTextRef.current = "";
    } catch (err) {
      log("assemble failed", undefined, String(err));
      setStatus({ type: "error", text: "Connection issue — please try again." });
    }
  }, [autoPlay, log]);

  // ---- send landmarks for interpretation ----
  const sendForInterpretation = useCallback(async () => {
    if (bufferRef.current.length < 5) return;

    const avg = averageLandmarks(bufferRef.current);
    if (!hasMoved(avg, lastLandmarksRef.current)) return;
    lastLandmarksRef.current = avg;

    setIsLoading(true);
    setStatus({ type: "info", text: "Interpreting sign..." });

    try {
      abortRef.current = new AbortController();
      const frames = bufferRef.current.map((f) => ({
        landmarks: f.hands.map((hand) => hand.map((lm) => [lm.x, lm.y, lm.z]).flat()),
        handedness: f.handedness,
      }));

      log("interpret-gesture", { frames: frames.length });
      const result = await interpretGesture(frames, abortRef.current.signal);
      lastGestureRef.current = result.gesture;
      log("interpret-gesture ok", { gesture: result.gesture, conf: result.confidence });

      await assembleAndDisplay();
    } catch (err) {
      log("interpret-gesture failed", undefined, String(err));
      setStatus({ type: "error", text: "Translation unavailable — retrying..." });
    } finally {
      setIsLoading(false);
    }
  }, [averageLandmarks, hasMoved, log, assembleAndDisplay]);

  // ---- handle single landmark frame ----
  const handleFrame = useCallback((frame: LandmarkFrame) => {
    if (noHandsRef.current) clearTimeout(noHandsRef.current);

    if (frame.hands.length === 0) {
      noHandsRef.current = setTimeout(() => {
        setStatus({
          type: "warning",
          text: "No hands detected — position your hands in the camera frame.",
        });
      }, CONFIG.NO_HANDS_TIMEOUT_MS);
      return;
    }

    bufferRef.current.push(frame);
    const cutoff = Date.now() - CONFIG.LANDMARK_BUFFER_MS;
    bufferRef.current = bufferRef.current.filter((f) => f.timestamp >= cutoff);
  }, []);

  // ---- start session ----
  const startSession = useCallback(async () => {
    setSessionState("starting");
    setTranscriptHistory([]);
    setCurrentSentence("");
    setStatus({ type: "info", text: "Starting session..." });
    lastSentenceRef.current = "";
    lastGestureRef.current = null;
    speechTextRef.current = "";
    busyRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      setActiveStream(stream);

      // Init MediaPipe
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(CONFIG.MEDIAPIPE_WASM_CDN);
      const hl = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: CONFIG.MEDIAPIPE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      lmRef.current = hl;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.muted = true;
      await video.play();
      videoRef.current = video;

      // Detection loop
      let lastTs = -1;
      const loop = () => {
        if (video.readyState >= 2) {
          const now = performance.now();
          if (now !== lastTs) {
            lastTs = now;
            const res = hl.detectForVideo(video, now);
            const frame: LandmarkFrame = {
              timestamp: Date.now(),
              hands: res.landmarks.map((hand: any[]) =>
                hand.map((lm: any) => ({ x: lm.x, y: lm.y, z: lm.z })),
              ),
              handedness:
                res.handedness?.map((h: any) => h[0]?.categoryName ?? "Unknown") ?? [],
            };
            handleFrame(frame);
          }
        }
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);

      // Interpret interval
      intervalRef.current = setInterval(() => {
        if (!busyRef.current) {
          busyRef.current = true;
          sendForInterpretation().finally(() => { busyRef.current = false; });
        }
      }, CONFIG.INTERPRET_INTERVAL_MS);

      // STT (optional)
      try {
        const token = await getSTTToken();
        sttRef.current = createSTTConnection(
          token,
          (t) => {
            if (t.is_final) {
              speechTextRef.current =
                (speechTextRef.current ? speechTextRef.current + " " : "") + t.text;
            }
          },
          (e) => log("STT error", undefined, e),
          stream,
        );
      } catch (e) {
        log("STT init failed", undefined, String(e));
        setStatus({ type: "warning", text: "Speech recognition unavailable — sign only" });
      }

      setSessionState("active");
      setStatus({ type: "success", text: "Session active — start signing!" });
      log("session started");
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      log("session start failed", undefined, msg);
      setSessionState("idle");
      setStatus({
        type: "error",
        text: msg.includes("Permission")
          ? "Camera or microphone permission denied — please allow access and try again"
          : "Failed to start session. Check your camera and microphone.",
      });
    }
  }, [handleFrame, sendForInterpretation, log]);

  // ---- stop session ----
  const stopSession = useCallback(async () => {
    setSessionState("stopping");
    log("session stopping");

    abortRef.current?.abort();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (noHandsRef.current) clearTimeout(noHandsRef.current);
    if (animRef.current) cancelAnimationFrame(animRef.current);

    sttRef.current?.close();
    lmRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setActiveStream(null);

    intervalRef.current = null;
    noHandsRef.current = null;
    animRef.current = null;
    sttRef.current = null;
    lmRef.current = null;
    streamRef.current = null;
    videoRef.current = null;
    bufferRef.current = [];
    lastLandmarksRef.current = null;
    lastGestureRef.current = null;
    speechTextRef.current = "";
    busyRef.current = false;

    setSessionState("idle");
    setStatus({ type: "info", text: "Session ended. Press Start Session to begin again." });
    log("session ended");
  }, [log]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (noHandsRef.current) clearTimeout(noHandsRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      sttRef.current?.close();
      lmRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    sessionState,
    currentSentence,
    transcriptHistory,
    status,
    isLoading,
    isSpeaking,
    autoPlay,
    activeStream,
    startSession,
    stopSession,
    setAutoPlay,
  };
}