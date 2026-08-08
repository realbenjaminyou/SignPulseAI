import { type SessionState } from "../lib/types";
import { Play, Square, Volume2, VolumeX } from "lucide-react";

interface SessionControlsProps {
  sessionState: SessionState;
  autoPlay: boolean;
  onStart: () => void;
  onStop: () => void;
  onToggleAutoPlay: () => void;
}

export function SessionControls({
  sessionState,
  autoPlay,
  onStart,
  onStop,
  onToggleAutoPlay,
}: SessionControlsProps) {
  const isActive = sessionState === "active";
  const isTransitioning = sessionState === "starting" || sessionState === "stopping";

  return (
    <div className="flex items-center gap-3">
      {/* Start / End button */}
      <button
        onClick={isActive ? onStop : onStart}
        disabled={isTransitioning}
        className={`
          flex items-center gap-2 px-5 py-2.5 rounded-xl font-heading font-semibold text-sm
          transition-all duration-200 ease-out
          active:scale-[0.97]
          focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          ${
            isActive
              ? "bg-destructive text-white hover:bg-destructive/90"
              : "bg-primary text-on-primary hover:bg-primary/90"
          }
        `}
        aria-label={isActive ? "End session" : "Start session"}
      >
        {isTransitioning ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {sessionState === "starting" ? "Starting..." : "Stopping..."}
          </>
        ) : isActive ? (
          <>
            <Square className="w-4 h-4 fill-current" aria-hidden="true" />
            End Session
          </>
        ) : (
          <>
            <Play className="w-4 h-4 fill-current" aria-hidden="true" />
            Start Session
          </>
        )}
      </button>

      {/* Auto-play TTS toggle */}
      <button
        onClick={onToggleAutoPlay}
        disabled={isTransitioning}
        className={`
          flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200 ease-out
          active:scale-[0.97]
          focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          ${
            autoPlay
              ? "bg-surface-elevated text-foreground border border-border hover:bg-surface-elevated/80"
              : "bg-surface text-muted border border-border"
          }
        `}
        aria-label={autoPlay ? "Mute audio output" : "Enable audio output"}
        aria-pressed={autoPlay}
      >
        {autoPlay ? (
          <Volume2 className="w-4 h-4" aria-hidden="true" />
        ) : (
          <VolumeX className="w-4 h-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{autoPlay ? "Audio On" : "Audio Off"}</span>
      </button>
    </div>
  );
}