import { Languages } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-center gap-3 py-6 select-none">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20">
        <Languages className="w-5 h-5 text-primary" aria-hidden="true" />
      </div>
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground tracking-tight">
          SignPulseAI
        </h1>
        <p className="text-xs text-muted -mt-0.5">ASL → English Translator</p>
      </div>
    </header>
  );
}