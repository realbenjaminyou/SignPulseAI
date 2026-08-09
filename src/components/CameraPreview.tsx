import { useRef, useEffect, useCallback, useState } from 'react';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { HandData, HandLandmarkPayload, HandLandmarkData } from '../lib/types';
import { CAMERA_CONSTRAINTS } from '../lib/config';

interface CameraPreviewProps {
  stream?: MediaStream | null;
  hands?: HandData[];
  isActive?: boolean;
  fps?: number;
  onLandmarksDetected?: (payload: HandLandmarkPayload) => void;
}

const FRAME_INTERVAL_MS = 100; // ~10 FPS throttling

export default function CameraPreview({
  stream: parentStream = null,
  hands = [],
  isActive = false,
  fps: parentFps = 0,
  onLandmarksDetected,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastCaptureTimeRef = useRef<number>(0);
  const localStreamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [measuredFps, setMeasuredFps] = useState<number>(0);

  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(performance.now());
  const activeHandsRef = useRef<HandData[]>([]);

  // ── 1. Initialize MediaPipe HandLandmarker ──
  useEffect(() => {
    let isMounted = true;

    async function initHandLandmarker() {
      if (handLandmarkerRef.current) return;
      try {
        setIsModelLoading(true);
        setModelError(null);

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
        );

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (isMounted) {
          handLandmarkerRef.current = landmarker;
          setIsModelLoading(false);
        } else {
          landmarker.close();
        }
      } catch (err) {
        console.error('Failed to initialize MediaPipe HandLandmarker:', err);
        if (isMounted) {
          setModelError('Failed to load MediaPipe hand detection model');
          setIsModelLoading(false);
        }
      }
    }

    initHandLandmarker();

    return () => {
      isMounted = false;
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
        handLandmarkerRef.current = null;
      }
    };
  }, []);

  // ── 2. Handle Webcam Stream ──
  useEffect(() => {
    let isCancelled = false;

    async function setupCamera() {
      if (!isActive) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
          localStreamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        return;
      }

      if (parentStream) {
        if (videoRef.current) {
          videoRef.current.srcObject = parentStream;
          videoRef.current.play().catch(() => {});
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Webcam access error:', err);
        setModelError('Camera access denied or unequipped');
      }
    }

    setupCamera();

    return () => {
      isCancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [isActive, parentStream]);

  // ── 3. Animation Loop (10 FPS Throttle & Landmark Extraction) ──
  const processFrame = useCallback(
    (timestamp: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = handLandmarkerRef.current;

      if (!isActive || !video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Track FPS
      frameCountRef.current++;
      const elapsedFps = timestamp - fpsTimerRef.current;
      if (elapsedFps >= 1000) {
        setMeasuredFps(Math.round((frameCountRef.current * 1000) / elapsedFps));
        frameCountRef.current = 0;
        fpsTimerRef.current = timestamp;
      }

      // Throttle capture to ~10 FPS (100 ms)
      const elapsedCapture = timestamp - lastCaptureTimeRef.current;
      const round3 = (val: number) => Math.round(val * 1000) / 1000;

      if (landmarker && elapsedCapture >= FRAME_INTERVAL_MS) {
        lastCaptureTimeRef.current = timestamp;

        try {
          const result = landmarker.detectForVideo(video, timestamp);
          const detectedHands: HandLandmarkData[] = [];
          const currentHandData: HandData[] = [];

          if (result.landmarks && result.landmarks.length > 0) {
            for (let h = 0; h < result.landmarks.length; h++) {
              const lmList = result.landmarks[h];
              const category = result.handedness?.[h]?.[0]?.categoryName ?? 'Right';
              const handedness: 'Left' | 'Right' = category === 'Left' ? 'Left' : 'Right';
              const confidence = result.handedness?.[h]?.[0]?.score ?? 0.8;

              // Round 21 landmarks to 3 decimal places
              const roundedLandmarks = lmList.map((p) => ({
                x: round3(p.x),
                y: round3(p.y),
                z: round3(p.z),
              }));

              detectedHands.push({
                handedness,
                landmarks: roundedLandmarks,
              });

              currentHandData.push({
                landmarks: roundedLandmarks.map((l) => ({ ...l, visibility: 1 })),
                handedness,
                confidence,
              });
            }
          }

          activeHandsRef.current = currentHandData;

          // Trigger callback ONLY when hands_detected > 0
          if (detectedHands.length > 0) {
            const payload: HandLandmarkPayload = {
              timestamp: Date.now(),
              hands_detected: detectedHands.length,
              hands: detectedHands,
            };

            if (onLandmarksDetected) {
              onLandmarksDetected(payload);
            }
          }
        } catch (err) {
          console.error('HandLandmarker detection error:', err);
        }
      }

      // Draw canvas skeleton overlay
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          const displayHands = activeHandsRef.current.length > 0 ? activeHandsRef.current : hands;
          for (const hand of displayHands) {
            drawHandSkeleton(ctx, hand, w, h);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processFrame);
    },
    [isActive, hands, onLandmarksDetected],
  );

  useEffect(() => {
    if (isActive) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isActive, processFrame]);

  // ── Canvas resize ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const onResize = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    };

    video.addEventListener('loadedmetadata', onResize);
    onResize();

    return () => video.removeEventListener('loadedmetadata', onResize);
  }, [isActive]);

  const activeStream = parentStream || localStreamRef.current;
  const hasStream = activeStream !== null;
  const displayFps = parentFps || measuredFps;

  return (
    <div className="relative w-full max-w-[640px] mx-auto rounded-xl overflow-hidden bg-black/60 border border-border aspect-[4/3]">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover scale-x-[-1]"
      />

      {/* Landmark canvas overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={640}
        height={480}
      />

      {/* FPS badge */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-xs font-mono text-foreground/70">
        {displayFps} fps
      </div>

      {/* Camera status indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
        {hasStream ? (
          <>
            <Camera className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Live</span>
          </>
        ) : (
          <>
            <CameraOff className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-400">Off</span>
          </>
        )}
      </div>

      {/* Model loading overlay */}
      {isModelLoading && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-foreground/80">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium">Initializing MediaPipe Hand Detection...</p>
        </div>
      )}

      {/* Error state */}
      {modelError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-red-400 p-4 text-center">
          <AlertCircle className="w-6 h-6" />
          <p className="text-xs">{modelError}</p>
        </div>
      )}

      {/* Empty state */}
      {!hasStream && !isModelLoading && !modelError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-foreground/40">
          <Camera className="w-8 h-8" />
          <p className="text-sm">Camera not started</p>
          <p className="text-xs">Click "Start Session" to begin</p>
        </div>
      )}
    </div>
  );
}

/* ── Hand skeleton drawing ── */
const CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [0, 5], [5, 9], [9, 13], [13, 17],
];

function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  hand: HandData,
  w: number,
  h: number,
) {
  const { landmarks } = hand;
  if (!landmarks || landmarks.length < 21) return;

  // Draw connections
  ctx.strokeStyle = 'oklch(0.5854 0.2041 277.12 / 0.6)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  for (const [i, j] of CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  }

  // Draw landmarks
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = lm.x * w;
    const y = lm.y * h;

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle =
      i === 0
        ? 'oklch(0.7686 0.1647 70.08)' // wrist = secondary
        : 'oklch(0.6658 0.1574 58.32)'; // primary
    ctx.fill();
  }
}