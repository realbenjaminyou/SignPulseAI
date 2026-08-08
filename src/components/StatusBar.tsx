import { type StatusMessage } from "../lib/types";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

interface StatusBarProps {
  status: StatusMessage;
}

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
} as const;

const colorMap = {
  info: "border-border text-muted",
  warning: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  error: "border-destructive/30 text-destructive bg-destructive/5",
  success: "border-success/30 text-success bg-success/5",
} as const;

export function StatusBar({ status }: StatusBarProps) {
  const Icon = iconMap[status.type];

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
        transition-all duration-200
        ${colorMap[status.type]}
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{status.text}</span>
    </div>
  );
}