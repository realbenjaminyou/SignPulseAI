import { useRef, useEffect } from 'react';
import { MessageSquare, Sparkles, Volume2 } from 'lucide-react';
import type { TranslationEntry, ConfidenceLevel } from '../lib/types';
import { getConfidenceLevel, getConfidenceColor, getConfidenceBg } from '../lib/types';

interface TranslationOutputProps {
  currentSentence: string;
  transcript: TranslationEntry[];
  confidence: number;
  isSpeaking: boolean;
}

export default function TranslationOutput({
  currentSentence,
  transcript,
  confidence,
  isSpeaking,
}: TranslationOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcript]);

  const confLevel: ConfidenceLevel = getConfidenceLevel(confidence);

  return (
    <div className="w-full max-w-[640px] mx-auto flex flex-col gap-3">
      {/* ── Current sentence output ── */}
      <div className="relative rounded-xl border border-border bg-muted/50 p-4 min-h-[80px]">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-foreground/50 uppercase tracking-wider">
            Translation
          </span>

          {/* Confidence badge */}
          {currentSentence && (
            <span
              className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getConfidenceBg(confLevel)}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${getConfidenceColor(confLevel)}`} />
              {Math.round(confidence * 100)}%
            </span>
          )}

          {/* Speaking indicator */}
          {isSpeaking && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-accent/10 border border-accent/30 text-accent">
              <Volume2 className="w-3 h-3 animate-pulse" />
              Speaking
            </span>
          )}
        </div>

        {/* Empty state */}
        {!currentSentence && (
          <p className="text-sm text-foreground/30 italic">
            Signs and speech will appear here...
          </p>
        )}

        {/* Current sentence */}
        {currentSentence && (
          <p
            className="text-lg font-medium text-foreground leading-relaxed"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentSentence}
          </p>
        )}
      </div>

      {/* ── Transcript history ── */}
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-3.5 h-3.5 text-foreground/40" />
          <span className="text-xs font-medium text-foreground/40 uppercase tracking-wider">
            Transcript
          </span>
          <span className="text-xs text-foreground/20">({transcript.length})</span>
        </div>

        <div
          ref={scrollRef}
          className="max-h-[200px] overflow-y-auto space-y-1.5 scroll-smooth"
          role="log"
          aria-live="polite"
          aria-label="Translation transcript history"
        >
          {transcript.length === 0 && (
            <p className="text-xs text-foreground/20 italic py-2">
              No translations yet. Start a session to begin.
            </p>
          )}

          {transcript.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-2 text-sm py-1 px-2 rounded ${
                entry.type === 'assembled' ? 'bg-accent/5' : ''
              }`}
            >
              <span className="text-[10px] font-mono text-foreground/20 mt-0.5 shrink-0">
                {formatTime(entry.timestamp)}
              </span>
              <span className="text-foreground/80 leading-relaxed">
                {entry.text}
              </span>
              <span className="ml-auto text-[10px] text-foreground/20 shrink-0">
                {Math.round(entry.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
}