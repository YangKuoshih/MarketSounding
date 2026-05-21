"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ClipboardPaste,
  BookOpen,
  Rocket,
  Loader,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, ApiError } from "@/lib/api-client";

type InputMode = "search" | "paste" | "sample";

const tabs: { id: InputMode; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "paste", label: "Paste", icon: ClipboardPaste },
  { id: "sample", label: "Sample", icon: BookOpen },
];

const SAMPLES = [
  "FOMC June 2026 Decision",
  "US-China Tariff Escalation",
  "Middle East Oil Supply Shock",
];

type Phase = "idle" | "researching" | "launching";

export default function NewSimulationPage() {
  return (
    <Suspense fallback={null}>
      <NewSimulationContent />
    </Suspense>
  );
}

function NewSimulationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<InputMode>("search");
  const [topic, setTopic] = useState(() => searchParams.get("topic") ?? "");
  const [pastedText, setPastedText] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [crisisEnabled, setCrisisEnabled] = useState(false);
  const [crisisText, setCrisisText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const launchFired = useRef(false);
  const [pendingAutoLaunch, setPendingAutoLaunch] = useState(false);

  const busy = phase !== "idle";
  const activeTopic = topic.trim();

  // Listen for Jarrett widget firing a simulate spec from the floating chat
  useEffect(() => {
    function onJarrettSimulate(e: Event) {
      const spec = (e as CustomEvent).detail as { topic?: string; rounds?: number; crisis?: string | null };
      if (!spec || busy) return;
      if (typeof spec.topic === "string" && spec.topic.trim()) {
        setTopic(spec.topic.trim());
        setMode("search");
      }
      if (typeof spec.rounds === "number" && spec.rounds >= 3 && spec.rounds <= 5) {
        setMaxRounds(spec.rounds);
      }
      if (spec.crisis && typeof spec.crisis === "string") {
        setCrisisEnabled(true);
        setCrisisText(spec.crisis);
      } else {
        setCrisisEnabled(false);
        setCrisisText("");
      }
      setError(null);
      launchFired.current = false;
      // Trigger auto-launch after state settles
      setPendingAutoLaunch(true);
    }
    window.addEventListener("jarrett:simulate", onJarrettSimulate);
    return () => window.removeEventListener("jarrett:simulate", onJarrettSimulate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const canLaunch =
    (mode === "search" && activeTopic.length > 0) ||
    (mode === "sample" && activeTopic.length > 0) ||
    (mode === "paste" && pastedText.trim().length > 0);

  // Fire auto-launch when Jarrett fills the form via widget
  useEffect(() => {
    if (pendingAutoLaunch && canLaunch && !busy) {
      setPendingAutoLaunch(false);
      handleLaunch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoLaunch, canLaunch, busy]);

  const config = {
    maxRounds,
    convergenceThreshold: 0.1,
    enableCrisisInjection: crisisEnabled,
    crisisText: crisisEnabled ? crisisText : undefined,
  };

  async function handleLaunch() {
    if (busy || !canLaunch || launchFired.current) return;
    launchFired.current = true;
    setError(null);

    try {
      if (mode === "paste") {
        setPhase("launching");
        setStatusLine("Launching simulation…");
        const result = await api.simulations.create({
          eventText: pastedText,
          title: activeTopic || "Untitled Simulation",
          config,
        });
        router.push(`/console/sounding/${result.simulationId}`);
        return;
      }

      // Search / sample: research first, then simulate in one shot
      setPhase("researching");
      setStatusLine("Researching topic via live web sources…");
      const researchResult = await api.events.research(activeTopic);

      setPhase("launching");
      setStatusLine("Research complete — launching simulation…");
      const simResult = await api.simulations.create({
        eventText: researchResult.event.rawText ?? "",
        topic: activeTopic,
        title: researchResult.event.title || activeTopic,
        config,
      });
      router.push(`/console/sounding/${simResult.simulationId}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
          ? err.message
          : "Launch failed"
      );
      setPhase("idle");
      setStatusLine(null);
      launchFired.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-semibold mb-1">New Simulation</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Configure your simulation, then enter a topic and launch.
        </p>

        {/* ── Step 1: Configuration ─────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-5 mb-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Step 1 — Configuration
          </h2>

          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-sm font-medium">Rounds</label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Number of dealer debate rounds (3 – 5)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={3}
                max={5}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                disabled={busy}
                className="w-28 disabled:opacity-50"
              />
              <span className="font-mono text-sm w-4 text-right">{maxRounds}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Crisis injection</label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Inject a surprise event mid-simulation to trigger re-evaluation
              </p>
            </div>
            <button
              onClick={() => { if (!busy) setCrisisEnabled(!crisisEnabled); }}
              className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer shrink-0 ${
                crisisEnabled ? "bg-primary" : "bg-muted"
              } ${busy ? "opacity-50 pointer-events-none" : ""}`}
              role="switch"
              aria-checked={crisisEnabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  crisisEnabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {crisisEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1.5">Crisis event description</label>
                  <textarea
                    value={crisisText}
                    onChange={(e) => setCrisisText(e.target.value)}
                    placeholder="e.g. China announces surprise 200bp rate cut and $2T stimulus package..."
                    rows={2}
                    disabled={busy}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Injected after round 1 to trigger a re-evaluation round.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Step 2: Market topic ──────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-5 mb-5">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Step 2 — Market Topic
          </h2>

          {/* Input mode tabs */}
          <div className="flex gap-1 rounded-lg bg-muted p-1 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (busy) return;
                  setMode(tab.id);
                  setError(null);
                }}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  mode === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search mode */}
          {mode === "search" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Market topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => { setTopic(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && !busy && canLaunch && handleLaunch()}
                placeholder="e.g. FOMC rate decision, tariffs on China..."
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          )}

          {/* Paste mode */}
          {mode === "paste" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Event text</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste market event text here (max 50KB)..."
                  rows={6}
                  maxLength={50 * 1024}
                  disabled={busy}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {(pastedText.length / 1024).toFixed(1)} KB / 50 KB
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Title (optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. FOMC Decision"
                  disabled={busy}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Sample mode */}
          {mode === "sample" && (
            <div className="grid gap-3">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    if (busy) return;
                    setTopic(s);
                    setError(null);
                  }}
                  className={`flex items-center gap-3 rounded-md border p-4 text-left transition-colors cursor-pointer ${
                    topic === s ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  } ${busy ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{s}</span>
                  {topic === s && <CheckCircle className="h-4 w-4 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Status line ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {statusLine && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-5"
            >
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
                {phase === "researching" || phase === "launching" ? (
                  <Loader className="h-4 w-4 animate-spin text-primary shrink-0" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                )}
                <p className="text-xs text-muted-foreground">{statusLine}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Launch button ─────────────────────────────────────────────── */}
        <button
          onClick={handleLaunch}
          disabled={busy || !canLaunch}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer transition-colors"
        >
          {phase === "researching" ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Researching…
            </>
          ) : phase === "launching" ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Launching simulation…
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Launch — {maxRounds} round{maxRounds !== 1 ? "s" : ""}{crisisEnabled ? " · crisis" : ""}
            </>
          )}
        </button>

        {mode !== "paste" && !busy && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground font-mono">
            Researches the topic via live web sources, then runs {maxRounds} dealer rounds
          </p>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-mono">{error}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
