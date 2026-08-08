import { Play, Square, Volume2, VolumeX } from 'lucide-react';

interface SessionControlsProps {
  isRunning: boolean;
  ttsEnabled: boolean;
  onToggleSession: () => void;
  onToggleTts: () => void;
  disabled: boolean;
}

export default function SessionControls({
  isRunning,
  ttsEnabled,
  onToggleSession,
  onToggleTts,
  disabled,
}: SessionControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {/* Start / Stop */}
      <button
        onClick={onToggleSession}
        disabled={disabled && !isRunning}
        className={`
          inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
          transition-all duration-200 ease-out cursor-pointer
          active:scale-[0.97]
          focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2
          ${
            isRunning
              ? 'bg-destructive text-white hover:opacity-90'
              : 'bg-accent text-white hover:opacity-90 shadow-[0_0_16px_oklch(0.5854_0.2041_277.12_/_0.3)]'
          }
          disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        `}
        aria-label={isRunning ? 'End translation session' : 'Start translation session'}
      >
        {isRunning ? (
          <>
            <Square className="w-4 h-4" />
            End Session
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Start Session
          </>
        )}
      </button>

      {/* TTS toggle */}
      <button
        onClick={onToggleTts}
        disabled={!isRunning}
        className={`
          inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
          border transition-all duration-200 ease-out cursor-pointer
          active:scale-[0.97]
          focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2
          ${
            ttsEnabled
              ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
              : 'border-border text-foreground/60 hover:text-foreground/80 hover:border-foreground/20'
          }
          disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        `}
        aria-label={ttsEnabled ? 'Mute voice output' : 'Enable voice output'}
        aria-pressed={ttsEnabled}
      >
        {ttsEnabled ? (
          <>
            <Volume2 className="w-4 h-4" />
            Voice On
          </>
        ) : (
          <>
            <VolumeX className="w-4 h-4" />
            Voice Off
          </>
        )}
      </button>
    </div>
  );
}