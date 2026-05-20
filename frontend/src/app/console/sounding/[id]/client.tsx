"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { CheckCircle, Loader, Zap, FileText, Activity } from "lucide-react";
import { HDSpectrum } from "@/components/viz/hd-spectrum";
import { PositionEvolution } from "@/components/viz/position-evolution";
import { DealerTable } from "@/components/viz/dealer-table";
import { api, ApiError } from "@/lib/api-client";
import type { ReactionData, SimulationView, RoundData } from "@/lib/api-client";

const DEALERS = [
  { id: "gs", name: "Goldman Sachs", short: "GS" },
  { id: "jpm", name: "JP Morgan", short: "JPM" },
  { id: "ms", name: "Morgan Stanley", short: "MS" },
  { id: "citi", name: "Citi", short: "Citi" },
  { id: "bofa", name: "Bank of America", short: "BofA" },
];

// Sample data for demo
const SAMPLE_REACTIONS: ReactionData[] = [
  {
    personaId: "gs",
    status: "complete",
    ratePathView: "Expect reversal within 6 months as data softens",
    balanceSheetView: "QT likely to pause by Q3 given liquidity conditions",
    riskAssetView: "Equities resilient near-term but watch credit spreads",
    keyConcerns: ["Core services inflation", "Labor market cooling"],
    hawkishDovishScore: -0.3,
    confidence: 0.7,
    reasoningMd:
      "Our models suggest the Fed has overtightened relative to forward-looking indicators. The lagged impact of 525bp in hikes is still working through the system, and we expect unemployment to drift toward 4.5% by year-end. This supports our long-standing view that the next move is a cut, not a hike.\n\nThe key risk to our view is stickier-than-expected services inflation, but recent data on rents and healthcare costs suggests disinflation is finally taking hold in these categories.",
    positionShift: null,
    influencedBy: [],
    keyQuote: null,
  },
  {
    personaId: "jpm",
    status: "complete",
    ratePathView: "Fed on hold through Q3, data-dependent path to first cut",
    balanceSheetView: "QT continues at current pace through 2026",
    riskAssetView: "Selective opportunity in duration, cautious on HY",
    keyConcerns: ["Wage growth persistence", "Fiscal deficit trajectory"],
    hawkishDovishScore: 0.1,
    confidence: 0.65,
    reasoningMd:
      "We take a more balanced view than the market consensus. While acknowledging progress on inflation, we note that the labor market remains tight by historical standards, and wage growth above 4% is inconsistent with the 2% inflation target.\n\nOur base case is that the Fed remains on hold until there is clear evidence of labor market weakening, which we do not expect before September at the earliest.",
    positionShift: -0.1,
    influencedBy: ["gs"],
    keyQuote: "GS's labor market argument is compelling but premature",
  },
  {
    personaId: "ms",
    status: "complete",
    ratePathView: "Higher for longer; risk of additional hike if services re-accelerate",
    balanceSheetView: "QT to accelerate via MBS sales in H2",
    riskAssetView: "Defensive positioning warranted; overweight cash",
    keyConcerns: ["Financial conditions loosening", "Shelter inflation", "Geopolitical risk"],
    hawkishDovishScore: 0.5,
    confidence: 0.6,
    reasoningMd:
      "We remain more hawkish than consensus. Financial conditions have loosened meaningfully since October, effectively undoing 50-75bp of tightening. This is counterproductive to the Fed's objectives and increases the risk that inflation progress stalls.\n\nOur scenario analysis assigns 25% probability to an additional rate hike in H2 if core PCE remains above 2.8%.",
    positionShift: 0.0,
    influencedBy: [],
    keyQuote: "Financial conditions easing works against the Fed's objectives",
  },
  {
    personaId: "citi",
    status: "complete",
    ratePathView: "Three cuts by year-end, first in June",
    balanceSheetView: "QT taper announcement at June meeting",
    riskAssetView: "Constructive on risk assets given easing cycle ahead",
    keyConcerns: ["Recession risk underpriced", "Credit deterioration in CRE"],
    hawkishDovishScore: -0.4,
    confidence: 0.55,
    reasoningMd:
      "The data prints continue to support our view that the economy is slowing faster than the Fed acknowledges. Initial claims trending higher, ISM services contracting, and consumer confidence falling all point to an economy that needs rate relief sooner rather than later.\n\nWe are the most dovish on the Street because we believe recession risks are materially underpriced.",
    positionShift: -0.1,
    influencedBy: ["gs"],
    keyQuote: "Recession risks are materially underpriced by the market",
  },
  {
    personaId: "bofa",
    status: "complete",
    ratePathView: "One cut maximum in 2026; consumer spending remains too strong",
    balanceSheetView: "QT continues; balance sheet normalization far from complete",
    riskAssetView: "US consumer names remain well-supported",
    keyConcerns: ["Consumer resilience", "Immigration-driven labor supply"],
    hawkishDovishScore: 0.3,
    confidence: 0.75,
    reasoningMd:
      "Our proprietary consumer spending data shows no signs of the slowdown others are forecasting. Card spending remains robust, and the savings drawdown narrative is overstated when you account for asset appreciation.\n\nWe see at most one cut this year, and even that is data-dependent. The economy is running hotter than headline indicators suggest.",
    positionShift: 0.05,
    influencedBy: ["ms"],
    keyQuote: "Consumer spending data contradicts the slowdown narrative",
  },
];

const SAMPLE_TRAJECTORIES = [
  { personaId: "gs", shortName: "GS", scores: [{ round: 1, score: -0.2 }, { round: 2, score: -0.25 }, { round: 3, score: -0.3 }] },
  { personaId: "jpm", shortName: "JPM", scores: [{ round: 1, score: 0.2 }, { round: 2, score: 0.15 }, { round: 3, score: 0.1 }] },
  { personaId: "ms", shortName: "MS", scores: [{ round: 1, score: 0.5 }, { round: 2, score: 0.5 }, { round: 3, score: 0.5 }] },
  { personaId: "citi", shortName: "Citi", scores: [{ round: 1, score: -0.3 }, { round: 2, score: -0.35 }, { round: 3, score: -0.4 }] },
  { personaId: "bofa", shortName: "BofA", scores: [{ round: 1, score: 0.25 }, { round: 2, score: 0.28 }, { round: 3, score: 0.3 }] },
];

export function SimulationViewClient({ id, autoPrint = false }: { id: string; autoPrint?: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const isDemo = id === "demo";
  const isRunningDemo = id === "running";
  const useRealApi = !isDemo && !isRunningDemo;

  const [liveSim, setLiveSim] = useState<SimulationView | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Real polling for non-demo simulations
  useEffect(() => {
    if (!useRealApi) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const sim = await api.simulations.get(id);
        if (cancelled) return;
        setLiveSim(sim);
        setLiveError(null);

        if (sim.status === "running") {
          timer = setTimeout(poll, 2000);
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Polling failed";
        setLiveError(msg);
        timer = setTimeout(poll, 5000);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [id, useRealApi]);

  // Auto-print when simulation is complete and ?print=1 was set
  useEffect(() => {
    if (autoPrint && liveSim?.status === "complete") {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [autoPrint, liveSim?.status]);

  // Real API: show live state
  if (useRealApi) {
    if (liveError && !liveSim) {
      return (
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
            <h2 className="text-base font-semibold mb-2">
              Failed to load simulation
            </h2>
            <p className="text-sm text-muted-foreground font-mono">
              {liveError}
            </p>
          </div>
        </div>
      );
    }
    if (!liveSim) {
      return (
        <div className="mx-auto max-w-3xl px-6 py-12 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader className="h-4 w-4 animate-spin" />
          <span className="font-mono">Loading simulation {id}...</span>
        </div>
      );
    }
    if (liveSim.status === "running") {
      return <RunningView id={id} liveSim={liveSim} />;
    }
    // Status: complete or failed -- render full view with live data
    return (
      <CompleteView
        sim={liveSim}
        showTranscript={showTranscript}
        setShowTranscript={setShowTranscript}
      />
    );
  }

  // Demo mode (no API or demo IDs)
  const isComplete = isDemo;
  if (!isComplete) {
    return <RunningView id={id} />;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">FOMC June 2026 Decision</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              3 rounds completed
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <CheckCircle className="h-3 w-3" />
            Complete
          </span>
        </div>

        {/* H/D Spectrum */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Hawkish / Dovish Spectrum
          </h2>
          <div className="rounded-lg border border-border p-4">
            <HDSpectrum
              dealers={SAMPLE_REACTIONS.map((r) => ({
                personaId: r.personaId,
                shortName: DEALERS.find((d) => d.id === r.personaId)?.short || r.personaId,
                hawkishDovishScore: r.hawkishDovishScore,
              }))}
            />
          </div>
        </section>

        {/* Position Evolution */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Position Evolution
          </h2>
          <div className="rounded-lg border border-border p-4">
            <PositionEvolution trajectories={SAMPLE_TRAJECTORIES} />
          </div>
        </section>

        {/* Comparative Table */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Final Positions
          </h2>
          <DealerTable reactions={SAMPLE_REACTIONS} />
        </section>

        {/* Transcript toggle */}
        <section>
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            {showTranscript ? "Hide" : "Show"} Discussion Transcript
          </button>
          {showTranscript && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25 }}
              className="mt-4 rounded-lg border border-border p-4 text-sm leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap"
            >
              {`## Round 1: Initial Reactions

**Goldman Sachs** (H/D: -0.2): Expects rate reversal within 6 months. Models suggest overtightening.
**JP Morgan** (H/D: +0.2): Balanced view; labor market still tight.
**Morgan Stanley** (H/D: +0.5): Higher for longer; financial conditions too loose.
**Citi** (H/D: -0.3): Three cuts by year-end; recession risks underpriced.
**BofA** (H/D: +0.25): One cut max; consumer spending remains strong.

## Round 2: Peer Response

**GS** shifted dovish (-0.05) after Citi's recession probability argument.
**JPM** shifted slightly dovish (-0.05) acknowledging GS labor data.
**MS** held firm -- financial conditions argument unchanged.
**Citi** shifted dovish (-0.05) reinforced by GS correlation.
**BofA** shifted hawkish (+0.03) influenced by MS tail-risk framing.

## Round 3: Final Positions

Convergence detected (avg shift: 0.04). Positions stabilized.
Anchor dealer: MS (zero total movement)
Swing dealer: JPM (largest total shift: -0.10)

Clusters: Dovish camp (GS, Citi), Hawkish camp (MS, BofA), Moderate (JPM)`}
            </motion.div>
          )}
        </section>
      </motion.div>
    </div>
  );
}

interface LogEntry {
  message: string;
  timestamp: string;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hdColor(score: number): string {
  if (score > 0.15) return "text-orange-400";
  if (score < -0.15) return "text-blue-400";
  return "text-muted-foreground";
}

function hdLabel(score: number): string {
  return (score >= 0 ? "+" : "") + score.toFixed(2);
}

function RunningView({
  id,
  liveSim,
}: {
  id: string;
  liveSim?: SimulationView | null;
}) {
  // Start with empty logs to avoid SSR/CSR timestamp mismatch; populate in useEffect
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Demo-mode animation state (only used when no liveSim)
  const [demoRound, setDemoRound] = useState(1);
  const [demoCompleted, setDemoCompleted] = useState(0);

  const isLive = !!liveSim;
  const totalRounds = liveSim?.totalRounds ?? 3;

  // Seed initial logs on mount (client-side only)
  useEffect(() => {
    setLogs([
      { message: "Initializing simulation...", timestamp: formatTimestamp(new Date()) },
      { message: "Loading persona profiles...", timestamp: formatTimestamp(new Date()) },
      { message: "Round 1 dispatched to 5 dealers", timestamp: formatTimestamp(new Date()) },
    ]);
  }, []);

  // Append log entries when new rounds complete (live mode)
  const prevRoundCount = useRef(0);
  useEffect(() => {
    if (!isLive || !liveSim) return;
    const newRounds = liveSim.rounds.length;
    if (newRounds > prevRoundCount.current) {
      for (let i = prevRoundCount.current; i < newRounds; i++) {
        const round = liveSim.rounds[i];
        const ts = formatTimestamp(new Date());
        round.reactions.forEach((r) => {
          setLogs((l) => [
            ...l,
            {
              message: `Round ${round.roundNumber} [${round.roundType}]: ${r.personaId.toUpperCase()} — H/D ${hdLabel(r.hawkishDovishScore)} (conf: ${(r.confidence * 100).toFixed(0)}%)`,
              timestamp: ts,
            },
          ]);
        });
        if (i < newRounds - 1 || liveSim.status === "running") {
          const nextRound = round.roundNumber + 1;
          if (nextRound <= totalRounds) {
            setLogs((l) => [
              ...l,
              { message: `Round ${nextRound} dispatched to 5 dealers`, timestamp: ts },
            ]);
          }
        }
      }
      prevRoundCount.current = newRounds;
    }
  }, [isLive, liveSim, totalRounds]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Demo animation (no liveSim)
  useEffect(() => {
    if (isLive) return;
    const interval = setInterval(() => {
      setDemoCompleted((prev) => {
        if (prev >= 5) {
          if (demoRound < totalRounds) {
            setDemoRound((r) => r + 1);
            setLogs((l) => [
              ...l,
              { message: `Round ${demoRound} complete`, timestamp: formatTimestamp(new Date()) },
              { message: `Round ${demoRound + 1} dispatched to 5 dealers`, timestamp: formatTimestamp(new Date()) },
            ]);
            return 0;
          }
          return prev;
        }
        const dealer = DEALERS[prev];
        setLogs((l) => [
          ...l,
          {
            message: `Round ${demoRound}: ${dealer.short} reaction received (H/D: ${(Math.random() * 1.6 - 0.8).toFixed(2)})`,
            timestamp: formatTimestamp(new Date()),
          },
        ]);
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [demoRound, isLive, totalRounds]);

  // Derive current round and dealer states from liveSim
  const currentRound = isLive ? Math.max(1, liveSim!.currentRound) : demoRound;

  // In live mode: all 5 dealers run in parallel per round, so a round is either
  // complete (in liveSim.rounds) or currently running (all dealers are "thinking")
  const completedRoundCount = liveSim?.rounds.length ?? 0;
  const currentRoundData = isLive && liveSim
    ? liveSim.rounds.find((r) => r.roundNumber === currentRound) ?? null
    : null;
  // In live mode all 5 run in parallel — show all as "thinking" until round data arrives
  // In demo mode use sequential demoCompleted counter

  const progress = isLive
    ? (completedRoundCount / totalRounds) * 100
    : ((demoRound - 1 + demoCompleted / 5) / totalRounds) * 100;

  // Latest completed round reactions for live preview
  const latestCompletedRound = isLive && liveSim && liveSim.rounds.length > 0
    ? liveSim.rounds[liveSim.rounds.length - 1]
    : null;

  const title = liveSim?.event?.title || id;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Live Simulation
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">{id}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-primary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Running
          </span>
        </div>

        {/* Progress */}
        <div className="mb-6 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            <span>Round {currentRound} / {totalRounds}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          {/* Dealer status cards */}
          <div className="mt-6 grid grid-cols-5 gap-3">
            {DEALERS.map((dealer) => {
              // In live mode all dealers run in parallel — check if this dealer has
              // a reaction in the current round's data
              const currentReaction = currentRoundData?.reactions.find(
                (r) => r.personaId === dealer.id
              );
              const isDone = !!currentReaction && currentReaction.status === "complete";
              // In demo mode use sequential index
              const demoIdx = DEALERS.indexOf(dealer);
              const demoIsDone = !isLive && demoIdx < demoCompleted;
              const demoIsActive = !isLive && demoIdx === demoCompleted;

              const showDone = isLive ? isDone : demoIsDone;
              const showActive = isLive ? !isDone : demoIsActive;
              const hdScore = currentReaction?.hawkishDovishScore;

              return (
                <motion.div
                  key={dealer.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                    showDone
                      ? "border-success/40 bg-success/5"
                      : showActive
                        ? "border-primary/60 bg-primary/5"
                        : "border-border bg-card"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    showDone
                      ? "border-success bg-success/10"
                      : showActive
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted"
                  }`}>
                    {showActive && !showDone ? (
                      <Loader className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="text-xs font-mono font-semibold">{dealer.short}</span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-mono font-semibold">{dealer.short}</p>
                    {showDone && hdScore != null ? (
                      <p className={`text-[10px] font-mono font-bold mt-0.5 ${hdColor(hdScore)}`}>
                        {hdLabel(hdScore)}
                      </p>
                    ) : (
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {showDone ? "Done" : showActive ? "Thinking…" : "Waiting"}
                      </p>
                    )}
                  </div>
                  {showDone && <CheckCircle className="h-3 w-3 text-success" />}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Latest completed round preview */}
        {latestCompletedRound && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 rounded-lg border border-border bg-card p-5"
          >
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Round {latestCompletedRound.roundNumber} Results —{" "}
              <span className="capitalize">{latestCompletedRound.roundType.replace("_", " ")}</span>
            </h2>
            <div className="space-y-2">
              {latestCompletedRound.reactions.map((r) => {
                const dealer = DEALERS.find((d) => d.id === r.personaId);
                return (
                  <div key={r.personaId} className="flex items-start gap-3 text-xs">
                    <span className="font-mono font-semibold w-10 shrink-0 text-muted-foreground">
                      {dealer?.short ?? r.personaId}
                    </span>
                    <span className={`font-mono font-bold w-12 shrink-0 ${hdColor(r.hawkishDovishScore)}`}>
                      {hdLabel(r.hawkishDovishScore)}
                    </span>
                    <span className="text-muted-foreground leading-relaxed line-clamp-2">
                      {r.ratePathView}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* System dashboard / logs */}
        <div className="rounded-lg border border-border bg-foreground/95 p-4 font-mono text-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-success" />
              <span className="uppercase tracking-widest text-success">System Dashboard</span>
            </div>
            <span className="text-background/60">{id}</span>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {logs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 text-background/80"
              >
                <span className="text-success shrink-0">{log.timestamp}</span>
                <span>{log.message}</span>
              </motion.div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function buildTranscript(rounds: RoundData[]): string {
  return rounds
    .map((round) => {
      const header = `## Round ${round.roundNumber}: ${round.roundType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
      const entries = round.reactions.map((r) => {
        const dealer = DEALERS.find((d) => d.id === r.personaId);
        const name = dealer?.name ?? r.personaId;
        const hd = (r.hawkishDovishScore >= 0 ? "+" : "") + r.hawkishDovishScore.toFixed(2);
        const shift = r.positionShift != null
          ? ` (shift: ${r.positionShift >= 0 ? "+" : ""}${r.positionShift.toFixed(2)})`
          : "";
        const influenced = r.influencedBy?.length
          ? ` · influenced by ${r.influencedBy.map((id) => id.toUpperCase()).join(", ")}`
          : "";
        return `**${name}** H/D: ${hd}${shift}${influenced}\n${r.ratePathView}\n${r.keyQuote ? `"${r.keyQuote}"` : ""}\n\n${r.reasoningMd}`;
      });
      return [header, ...entries].join("\n\n");
    })
    .join("\n\n---\n\n");
}

function CompleteView({
  sim,
  showTranscript,
  setShowTranscript,
}: {
  sim: SimulationView;
  showTranscript: boolean;
  setShowTranscript: (v: boolean) => void;
}) {
  const reactions: ReactionData[] =
    sim.rounds.length > 0
      ? sim.rounds[sim.rounds.length - 1].reactions
      : [];

  const trajectories = DEALERS.map((d) => ({
    personaId: d.id,
    shortName: d.short,
    scores: sim.rounds.map((round) => {
      const r = round.reactions.find((x) => x.personaId === d.id);
      return {
        round: round.roundNumber,
        score: r?.hawkishDovishScore ?? 0,
      };
    }),
  }));

  const isFailed = sim.status === "failed";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">
              {sim.event?.title || "Simulation"}
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {sim.rounds.length} rounds completed
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isFailed && (
              <button
                onClick={() => window.print()}
                className="print:hidden flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                Export Report
              </button>
            )}
            {isFailed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                <Zap className="h-3 w-3" />
                Failed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                <CheckCircle className="h-3 w-3" />
                Complete
              </span>
            )}
          </div>
        </div>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Hawkish / Dovish Spectrum
          </h2>
          <div className="rounded-lg border border-border p-4">
            <HDSpectrum
              dealers={reactions.map((r) => ({
                personaId: r.personaId,
                shortName:
                  DEALERS.find((d) => d.id === r.personaId)?.short ||
                  r.personaId,
                hawkishDovishScore: r.hawkishDovishScore,
              }))}
            />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Position Evolution
          </h2>
          <div className="rounded-lg border border-border p-4">
            <PositionEvolution trajectories={trajectories} />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Final Positions
          </h2>
          <DealerTable reactions={reactions} />
        </section>

        {(sim.transcript || sim.rounds.length > 0) && (
          <section>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              {showTranscript ? "Hide" : "Show"} Discussion Transcript
            </button>
            {showTranscript && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.25 }}
                className="mt-4 rounded-lg border border-border p-4 text-sm leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap"
              >
                {sim.transcript || buildTranscript(sim.rounds)}
              </motion.div>
            )}
          </section>
        )}
      </motion.div>
    </div>
  );
}
