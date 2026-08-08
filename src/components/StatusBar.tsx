import { AlertCircle, CheckCircle2, Info, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { PipelineStatus } from '../lib/types';

interface StatusBarProps {
  status: PipelineStatus;
  error: string | null;
  latency: number;
  handsDetected: number;
  sttConnected: boolean;
}

export default function StatusBar({
  status,
  error,
  latency,
  handsDetected,
  sttConnected,
}: StatusBarProps) {
  const statusConfig = getStatusConfig(status, error);

  return (
    <div className="w-full max-w-[640px] mx-auto">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs">
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <statusConfig.icon className={`w-3.5 h-3.5 ${statusConfig.color}`} />
          <span className={`font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Hands detected */}
        <div className="flex items-center gap-1 text-foreground/50">
          <span>Hands:</span>
          <span className={handsDetected > 0 ? 'text-green-400 font-medium' : 'text-foreground/30'}>
            {handsDetected}
          </span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Latency */}
        <div className="flex items-center gap-1 text-foreground/50">
          <span>Latency:</span>
          <span className="font-mono text-foreground/70">{latency}ms</span>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* STT status */}
        <div className="flex items-center gap-1 text-foreground/50">
          {sttConnected ? (
            <Wifi className="w-3 h-3 text-green-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-foreground/30" />
          )}
          <span className="hidden sm:inline">STT</span>
        </div>

        {/* Error banner (if any) */}
        {error && (
          <>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">{error}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Status config ── */

import type { LucideIcon } from 'lucide-react';

interface StatusConfig {
  icon: LucideIcon;
  label: string;
  color: string;
}

function getStatusConfig(status: PipelineStatus, error: string | null): StatusConfig {
  if (error) {
    return {
      icon: AlertCircle,
      label: 'Error',
      color: 'text-destructive',
    };
  }

  switch (status) {
    case 'idle':
      return {
        icon: Info,
        label: 'Idle',
        color: 'text-foreground/40',
      };
    case 'initializing':
      return {
        icon: Loader2,
        label: 'Initializing',
        color: 'text-accent',
      };
    case 'running':
      return {
        icon: CheckCircle2,
        label: 'Running',
        color: 'text-green-400',
      };
    case 'paused':
      return {
        icon: Info,
        label: 'Paused',
        color: 'text-yellow-400',
      };
    case 'error':
      return {
        icon: AlertCircle,
        label: 'Error',
        color: 'text-destructive',
      };
    case 'ended':
      return {
        icon: Info,
        label: 'Session ended',
        color: 'text-foreground/40',
      };
  }
}