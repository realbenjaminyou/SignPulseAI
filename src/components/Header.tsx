import { Languages } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <Languages className="w-5 h-5 text-accent" />
        </div>
        <h1 className="text-lg font-heading font-semibold text-foreground tracking-tight">
          SignPulseAI
        </h1>
      </div>
      <span className="ml-auto text-xs text-foreground/40 hidden sm:inline">
        Real-time ASL Translator
      </span>
    </header>
  );
}