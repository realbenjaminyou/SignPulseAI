import { useEffect, useRef } from "react";
import { type TranscriptEntry } from "../lib/types";
import { MessageSquare } from "lucide-react";

interface TranslationOutputProps {
  currentSentence: string;
  transcriptHistory: TranscriptEntry[];
  isSpeaking: boolean;
}

export function TranslationOutput({
  currentSentence,
  transcriptHistory,
  isSpeaking,
}: TranslationOutputProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcript entries appear
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptHistory.length]);

  return (
    <div className="space-y-4">
      {/* Current sentence — large, prominent */}
      <div
        className={`
          min-h-[5rem] rounded-xl border p-4 flex items-center justify-center text-center
          transition-all duration-300
          ${
            currentSentence
              ? "border-accent/30 bg-accent/5"
              : "border-border bg-surface"
          }
        `}
        aria-live="polite"
        aria-atomic="true"
      >
        {currentSentence ? (
          <p className="text-xl sm:text-2xl font-heading font-semibold text-foreground leading-relaxed">
            {currentSentence}
            {isSpeaking && (
              <span className="inline-block w-1.5 h-5 ml-1 bg-accent rounded-full animate-pulse align-middle" />
            )}
          </p>
        ) : (
          <p className="text-sm text-muted">Translation will appear here</p>
        )}
      </div>

      {/* Transcript history */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wider">
          <MessageSquare className="w-3 h-3" aria-hidden="true" />
          <span>Transcript</span>
        </div>

        <div
          className="max-h-40 overflow-y-auto space-y-1.5 scrollable-transcript pr-1"
          role="log"
          aria-label="Translation transcript history"
          aria-live="polite"
        >
          {transcriptHistory.length === 0 ? (
            <p className="text-xs text-muted/60 italic py-2">
              Your translated sentences will appear here once you start signing.
            </p>
          ) : (
            transcriptHistory.map((entry) => (
              <p
                key={entry.id}
                className={`
                  text-sm leading-relaxed rounded-lg px-3 py-1.5
                  transition-all duration-300
                  ${entry.isNew
                    ? "bg-surface-elevated text-foreground font-medium"
                    : "text-muted"
                  }
                `}
              >
                {entry.text}
              </p>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}