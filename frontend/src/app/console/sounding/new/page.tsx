"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ClipboardPaste,
  BookOpen,
  Rocket,
  ExternalLink,
  Loader,
} from "lucide-react";
import { motion } from "motion/react";
import { api, ApiError } from "@/lib/api-client";

type InputMode = "search" | "paste" | "sample";

const tabs: { id: InputMode; label: string; icon: typeof Search }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "paste", label: "Paste", icon: ClipboardPaste },
  { id: "sample", label: "Sample", icon: BookOpen },
];

export default function NewSoundingPage() {
  return (
    <Suspense fallback={null}>
      <NewSoundingContent />
    </Suspense>
  );
}

function NewSoundingContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") || "";
  const [mode, setMode] = useState<InputMode>(initialTopic ? "search" : "search");
  const [topic, setTopic] = useState(initialTopic);
  const [pastedText, setPastedText] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [crisisEnabled, setCrisisEnabled] = useState(false);
  const [researching, setResearching] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const router = useRouter();

  async function handleLaunch() {
    setLaunching(true);
    setLaunchError(null);

    const apiConfigured = !!process.env.NEXT_PUBLIC_API_URL;

    if (!apiConfigured) {
      // Demo mode -- skip backend, route to pre-rendered demo
      router.push("/console/sounding/demo");
      return;
    }

    try {
      const eventText = mode === "paste" ? pastedText : undefined;
      const params = {
        eventText,
        topic: mode === "search" ? topic : undefined,
        title: topic || "Untitled Simulation",
        config: {
          maxRounds,
          convergenceThreshold: 0.1,
          enableCrisisInjection: crisisEnabled,
        },
      };
      const result = await api.simulations.create(params);
      router.push(`/console/sounding/${result.simulationId}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Failed to launch simulation";
      setLaunchError(message);
      setLaunching(false);
    }
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
              onClick={() => setMode(tab.id)}
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
              <label className="block text-sm font-medium mb-1.5">
                Market topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. FOMC rate decision, tariffs on China..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={() => setResearching(true)}
              disabled={!topic.trim() || researching}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            >
              {researching ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Research topic
            </button>
          </div>
        )}

        {/* Paste mode */}
        {mode === "paste" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Event text
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste market event text here (max 50KB)..."
                rows={8}
                maxLength={50 * 1024}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {(pastedText.length / 1024).toFixed(1)} KB / 50 KB
              </p>
            </div>
          </div>
        )}

        {/* Sample mode */}
        {mode === "sample" && (
          <div className="grid gap-3">
            {["FOMC June 2026 Decision", "US-China Tariff Escalation", "Middle East Oil Supply Shock"].map(
              (title) => (
                <button
                  key={title}
                  className="flex items-center gap-3 rounded-md border border-border p-4 text-left hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <BookOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{title}</span>
                </button>
              ),
            )}
          </div>
        )}

        {/* Simulation config */}
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
                className="w-24"
              />
              <span className="font-mono text-sm w-4">{maxRounds}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm">Crisis injection</label>
            <button
              onClick={() => setCrisisEnabled(!crisisEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
                crisisEnabled ? "bg-primary" : "bg-muted"
              }`}
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
        </div>

        {/* Launch */}
        <div className="mt-8">
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {launching ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Rocket className="h-5 w-5" />
            )}
            {launching ? "Launching..." : "Launch Simulation"}
          </button>
          {launchError && (
            <p className="mt-3 text-sm text-destructive font-mono">
              {launchError}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
