"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Newspaper,
  TrendingUp,
  Globe,
  ArrowRight,
  CheckCircle,
  Loader,
  AlertCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { Sparkline } from "@/components/viz/sparkline";
import { api, type SimulationSummary } from "@/lib/api-client";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const sampleEvents = [
  {
    id: "fomc-june-2026",
    title: "FOMC June 2026 Decision",
    summary:
      "Markets pricing 25bp cut with 60% probability after softer CPI print",
    icon: "newspaper",
    tag: "Monetary Policy",
  },
  {
    id: "tariffs-china",
    title: "US-China Tariff Escalation",
    summary:
      "New 25% tariffs on $200B in goods; retaliatory measures expected within 48h",
    icon: "trending",
    tag: "Trade Policy",
  },
  {
    id: "oil-supply-shock",
    title: "Middle East Oil Supply Shock",
    summary:
      "Strait of Hormuz disruption takes 20% of global supply offline for 72h",
    icon: "globe",
    tag: "Geopolitical",
  },
];

const iconMap = {
  newspaper: Newspaper,
  trending: TrendingUp,
  globe: Globe,
};

export default function ConsoleDashboardPage() {
  const [topic, setTopic] = useState("");
  const router = useRouter();
  const [recentSoundings, setRecentSoundings] = useState<SimulationSummary[]>([]);
  const [soundingsLoading, setSoundingsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.simulations.list();
        if (cancelled) return;
        const arr = Array.isArray(result)
          ? result
          : ((result as unknown as { simulations?: SimulationSummary[] }).simulations ?? []);
        setRecentSoundings(arr.slice(0, 5));
      } catch {
        // silently leave list empty — no mock fallback on dashboard
      } finally {
        if (!cancelled) setSoundingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim()) {
      router.push(
        `/console/sounding/new?topic=${encodeURIComponent(topic.trim())}`,
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-10 flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-muted-foreground"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        <span>System Ready</span>
        <span className="text-border">|</span>
        <span>5 Dealer Agents Online</span>
        <span className="text-border">|</span>
        <span>v0.1.0</span>
      </motion.div>

      {/* Hero search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-3xl"
      >
        <h1 className="text-5xl font-bold tracking-tight mb-4 leading-tight">
          What&apos;s moving<br />
          <span className="text-primary">the markets?</span>
        </h1>
        <p className="text-base text-muted-foreground mb-8 leading-relaxed max-w-xl">
          Enter a topic and watch 5 primary dealer agents debate, influence each other,
          and converge — or clash — across multiple rounds.
        </p>
        <form onSubmit={handleSearch} className="relative shadow-lg">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. FOMC rate decision, tariffs on China, oil supply shock..."
            className="w-full rounded-xl border-2 border-border bg-card py-5 pl-12 pr-36 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-0 font-sans transition-colors"
          />
          <button
            type="submit"
            disabled={!topic.trim()}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer transition-colors"
          >
            Research
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground font-mono">
          Powered by Claude Sonnet 4.6 · GS · JPM · MS · Citi · BofA
        </p>
      </motion.div>

      {/* Sample event cards */}
      <div className="mt-14">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Start with a sample
            </h2>
            <span className="text-xs font-mono text-muted-foreground/50">03 / 03</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {sampleEvents.map((event, i) => {
            const Icon = iconMap[event.icon as keyof typeof iconMap];
            return (
              <motion.button
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: 0.05 * (i + 1),
                  ease: "easeOut",
                }}
                onClick={() =>
                  router.push(
                    `/console/sounding/new?topic=${encodeURIComponent(event.title)}`,
                  )
                }
                className="group relative flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg cursor-pointer"
              >
                <div className="flex w-full items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {event.tag}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{event.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {event.summary}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Run simulation
                  <ArrowRight className="h-3 w-3" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Recent soundings */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="mt-16"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Recent Soundings
          </h2>
          <Link
            href="/console/history"
            className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {soundingsLoading ? (
            <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground font-mono">
              <Loader className="h-3.5 w-3.5 animate-spin" />
              Loading your simulations…
            </div>
          ) : recentSoundings.length === 0 ? (
            <div className="flex items-center gap-2 px-5 py-6 text-xs text-muted-foreground font-mono">
              <AlertCircle className="h-3.5 w-3.5" />
              No simulations yet — run your first sounding above.
            </div>
          ) : (
            recentSoundings.map((sim, i) => (
              <motion.div
                key={sim.simulationId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.3 + i * 0.05 }}
              >
                <Link
                  href={`/console/sounding/${sim.simulationId}`}
                  className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {sim.status === "complete" ? (
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      ) : sim.status === "failed" ? (
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Loader className="h-4 w-4 text-primary shrink-0 animate-spin" />
                      )}
                      <p className="text-sm font-medium truncate">
                        {sim.eventTitle || sim.simulationId}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span className="truncate max-w-[120px]">{sim.simulationId}</span>
                      <span className="text-border">|</span>
                      <span>Round {sim.currentRound} / {sim.totalRounds}</span>
                      <span className="text-border">|</span>
                      <span>{timeAgo(sim.createdAt)}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
