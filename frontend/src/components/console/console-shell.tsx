"use client";

import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ConsoleHeader } from "./console-header";

export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <ConsoleHeader />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <footer className="flex items-center gap-2 border-t border-border bg-warning/10 px-4 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
        <span className="text-xs text-muted-foreground font-mono">
          Simulated views -- not actual dealer commentary
        </span>
      </footer>
    </div>
  );
}
