import { useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import type { HandData } from '../lib/types';
import { MAX_FPS } from '../lib/config';

interface CameraPreviewProps {
  stream: MediaStream | null;
  hands: HandData[];
  isActive: boolean;
  fps: number;
}

export default function CameraPreview({
  stream,
  hands,
  isActive,
  fps,
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastDrawRef = useRef<number>(0);

  /* ── Attach stream to video ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  /* ── Draw hand landmarks on canvas ── */
  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      // Throttle draw to match camera FPS
      const elapsed = timestamp - lastDrawRef.current;
      const minInterval = 1000 / MAX_FPS;
      if (elapsed < minInterval) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDrawRef.current = timestamp;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (!isActive || hands.length === 0) return;

      for (const hand of hands) {
        drawHandSkeleton(ctx, hand, w, h);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    },
    [hands, isActive],
  );

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  /* ── Resize canvas to match video ── */
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
  }, [stream]);

  const hasStream = stream !== null;

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
        {fps} fps
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

      {/* Empty state */}
      {!hasStream && (
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
  if (landmarks.length < 21) return;

  // Draw connections
  ctx.strokeStyle = 'oklch(0.5854 0.2041 277.12 / 0.6)'; // accent
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
    ctx.fillStyle = i === 0
      ? 'oklch(0.7686 0.1647 70.08)'  // wrist = secondary
      : 'oklch(0.6658 0.1574 58.32)'; // primary
    ctx.fill();
  }
}