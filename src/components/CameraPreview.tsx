import { useEffect, useRef, useState } from "react";
import { Webcam, Loader2 } from "lucide-react";

interface CameraPreviewProps {
  stream: MediaStream | null;
  isLoading: boolean;
}

export function CameraPreview({ stream, isLoading }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.muted = true;
      video.play().then(() => setHasStream(true)).catch(() => setHasStream(false));
    } else {
      video.srcObject = null;
      setHasStream(false);
    }
  }, [stream]);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface border border-border">
      {/* Video */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover video-mirror transition-opacity duration-300 ${
          hasStream ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Camera preview"
      />

      {/* Placeholder when no stream */}
      {!hasStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted">
          <Webcam className="w-8 h-8" aria-hidden="true" />
          <p className="text-sm font-medium">
            {isLoading ? "Starting camera..." : "Camera preview"}
          </p>
        </div>
      )}

      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute top-3 right-3">
          <Loader2 className="w-4 h-4 text-primary animate-spin" aria-label="Loading" />
        </div>
      )}
    </div>
  );
}