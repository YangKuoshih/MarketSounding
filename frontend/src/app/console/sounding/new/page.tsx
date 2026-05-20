"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ClipboardPaste,
  BookOpen,
  Rocket,
  Loader,
  CheckCircle,
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

export default function NewSoundingPage() {
  return (
    <Suspense fallback={null}>
      <NewSoundingContent />
    </Suspense>
  );
}

// Separate research result from launch — so auto-research from dashboard doesn't
// bypass the config panel and always fire with the default 3 rounds.
interface ResearchResult {
  rawText: string;
  title: string;
  summary: string;
}

type Phase = "idle" | "researching" | "ready" | "launching";

function NewSoundingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [mode, setMode] = useState<InputMode>("search");
  const [topic, setTopic] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [crisisEnabled, setCrisisEnabled] = useState(false);
  const [crisisText, setCrisisText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoFired = useRef(false);

  const activeTopic = topic.trim();
  const canResearch =
    (mode === "search" && activeTopic.length > 0) ||
    (mode === "sample" && activeTopic.length > 0);
  const canLaunch =
    (mode === "paste" && pastedText.trim().length > 0) ||
    ((mode === "search" || mode === "sample") && !!research);

  const busy = phase === "researching" || phase === "launching";

  // ── Research step ────────────────────────────────────────────────────────────

  async function doResearch(topicStr: string) {
    setError(null);
    setResearch(null);
    setPhase("researching");
    try {
      const result = await api.events.research(topicStr);
      setResearch({
        rawText: result.event.rawText ?? "",
        title: result.event.title || topicStr,
        summary: result.event.summary ?? "",
      });
      setPhase("ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Research failed");
      setPhase("idle");
    }
  }

  // ── Launch step ──────────────────────────────────────────────────────────────

  async function doLaunch() {
    setError(null);
    setPhase("launching");

    const config = {
      maxRounds,
      convergenceThreshold: 0.1,
      enableCrisisInjection: crisisEnabled,
      crisisText: crisisEnabled ? crisisText : undefined,
    };

    try {
      if (mode === "paste") {
        const result = await api.simulations.create({
          eventText: pastedText,
          title: activeTopic || "Untitled Simulation",
          config,
        });
        router.push(`/console/sounding/${result.simulationId}`);
        return;
      }

      if (!research) return;
      const result = await api.simulations.create({
        eventText: research.rawText,
        topic: activeTopic,
        title: research.title,
        config,
      });
      router.push(`/console/sounding/${result.simulationId}`);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.status}: ${err.message}` : err instanceof Error ? err.message : "Failed to launch");
      setPhase(research || mode === "paste" ? "ready" : "idle");
    }
  }

  // ── Auto-research from dashboard ?topic= (NOT auto-launch) ───────────────────

  useEffect(() => {
    const t = searchParams.get("topic");
    if (t && !autoFired.current) {
      autoFired.current = true;
      setTopic(t);
      setMode("search");
      doResearch(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTopicChange(val: string) {
    setTopic(val);
    setError(null);
    // Clear stale research when topic changes
    if (research) setResearch(null);
    if (phase === "ready") setPhase("idle");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-semibold mb-6">New Sounding</h1>

        {/* Input mode tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (busy) return;
                setMode(tab.id);
                setError(null);
                setResearch(null);
                if (phase === "ready") setPhase("idle");
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Market topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => handleTopicChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && canResearch && !research && doResearch(activeTopic)}
                placeholder="e.g. FOMC rate decision, tariffs on China..."
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
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
                rows={8}
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
                  setResearch(null);
                  if (phase === "ready") setPhase("idle");
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

        {/* Research status / result */}
        <AnimatePresence>
          {(phase === "researching" || research) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-md border border-border bg-muted/40 px-4 py-3 flex items-start gap-3">
                {phase === "researching" ? (
                  <Loader className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {phase === "researching"
                    ? "Researching topic via live web sources…"
                    : research?.summary}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Configuration — always visible */}
        <div className="mt-8 space-y-4 border-t border-border pt-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Configuration
          </h2>

          <div className="flex items-center justify-between">
            <label className="text-sm">Rounds</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={3}
                max={5}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                disabled={busy}
                className="w-24 disabled:opacity-50"
              />
              <span className="font-mono text-sm w-4">{maxRounds}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm">Crisis injection</label>
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

          {crisisEnabled && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Crisis event</label>
              <textarea
                value={crisisText}
                onChange={(e) => setCrisisText(e.target.value)}
                placeholder="e.g. China announces surprise 200bp rate cut and $2T stimulus package..."
                rows={2}
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                This will be injected after round 1 to trigger a re-evaluation round.
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-8 flex items-center gap-3">
          {/* Step 1: Research (search/sample modes only, before research is done) */}
          {mode !== "paste" && !research && (
            <button
              onClick={() => doResearch(activeTopic)}
              disabled={busy || !canResearch}
              className="flex items-center gap-2 rounded-md bg-muted border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {phase === "researching" ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {phase === "researching" ? "Researching…" : "Research Topic"}
            </button>
          )}

          {/* Step 2: Launch (always shown when ready; for paste mode it's the only button) */}
          {(mode === "paste" || research) && (
            <button
              onClick={doLaunch}
              disabled={busy || !canLaunch}
              className="flex items-center gap-2 rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {phase === "launching" ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {phase === "launching" ? "Launching…" : `Launch — ${maxRounds} rounds`}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-destructive font-mono">{error}</p>
        )}
      </motion.div>
    </div>
  );
}
