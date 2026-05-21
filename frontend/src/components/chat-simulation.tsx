"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

export interface SimSpec {
  topic: string;
  rounds: number;
  crisis: string | null;
}

export function parseSimulationSpec(text: string): { prose: string; sim: SimSpec | null } {
  const match = text.match(/```simulate\s*([\s\S]*?)```/);
  if (!match) return { prose: text, sim: null };
  const prose = text.replace(/```simulate[\s\S]*?```/, "").trim();
  try {
    const raw = JSON.parse(match[1].trim()) as { topic?: unknown; rounds?: unknown; crisis?: unknown };
    const topic = typeof raw.topic === "string" && raw.topic.trim() ? raw.topic.trim() : null;
    if (!topic) return { prose: text, sim: null };
    const rounds = typeof raw.rounds === "number" && raw.rounds >= 3 && raw.rounds <= 5 ? raw.rounds : 3;
    const crisis = typeof raw.crisis === "string" && raw.crisis.trim() ? raw.crisis.trim() : null;
    return { prose, sim: { topic, rounds, crisis } };
  } catch {
    return { prose: text, sim: null };
  }
}

type LaunchPhase = "ready" | "researching" | "launching" | "done" | "error";

export function SimLaunchCard({ sim }: { sim: SimSpec }) {
  const router = useRouter();
  const [phase, setPhase] = useState<LaunchPhase>("ready");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleLaunch() {
    if (phase !== "ready") return;
    setErrorText(null);

    try {
      setPhase("researching");
      setStatusText("Researching topic via live web sources…");
      const researchResult = await api.events.research(sim.topic);

      setPhase("launching");
      setStatusText("Research complete — launching simulation…");
      const simResult = await api.simulations.create({
        eventText: researchResult.event.rawText ?? "",
        topic: sim.topic,
        title: researchResult.event.title || sim.topic,
        config: {
          maxRounds: sim.rounds,
          convergenceThreshold: 0.1,
          enableCrisisInjection: !!sim.crisis,
          crisisText: sim.crisis ?? undefined,
        },
      });

      setPhase("done");
      setStatusText("Launched! Redirecting…");
      setTimeout(() => {
        router.push(`/console/sounding/${simResult.simulationId}`);
      }, 600);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
          ? err.message
          : "Launch failed";
      setErrorText(msg);
      setPhase("error");
    }
  }

  const busy = phase === "researching" || phase === "launching" || phase === "done";

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
          Simulation Ready
        </span>
      </div>

      {/* Config summary */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0 pt-0.5">TOPIC</span>
          <span className="text-sm font-medium leading-snug">{sim.topic}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0">ROUNDS</span>
          <span className="text-sm">{sim.rounds}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-14 shrink-0 pt-0.5">CRISIS</span>
          {sim.crisis ? (
            <span className="text-sm leading-snug">{sim.crisis}</span>
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>
      </div>

      {/* Status line */}
      {statusText && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {phase === "done" ? (
            <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
          ) : (
            <Loader className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
          )}
          <span>{statusText}</span>
        </div>
      )}

      {/* Error */}
      {errorText && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{errorText}</span>
        </div>
      )}

      {/* Launch button */}
      {phase !== "done" && (
        <button
          onClick={handleLaunch}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {busy ? (
            <>
              <Loader className="h-3.5 w-3.5 animate-spin" />
              {phase === "researching" ? "Researching…" : "Launching…"}
            </>
          ) : (
            <>
              <Rocket className="h-3.5 w-3.5" />
              Launch Simulation
            </>
          )}
        </button>
      )}
    </div>
  );
}
