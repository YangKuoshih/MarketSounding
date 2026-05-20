"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Users,
  GitBranch,
  Zap,
  Network,
  FileText,
  ShieldCheck,
  Activity,
  Target,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";

const dealers = [
  { id: "gs", short: "GS", name: "Goldman Sachs", bias: -0.2, color: "var(--dovish)" },
  { id: "jpm", short: "JPM", name: "JP Morgan", bias: 0.1, color: "var(--muted-foreground)" },
  { id: "ms", short: "MS", name: "Morgan Stanley", bias: 0.5, color: "var(--hawkish)" },
  { id: "citi", short: "Citi", name: "Citi", bias: 0.0, color: "var(--muted-foreground)" },
  { id: "bofa", short: "BofA", name: "Bank of America", bias: 0.3, color: "var(--hawkish)" },
];

const features = [
  {
    icon: Users,
    title: "5 Dealer Personas",
    description:
      "GS, JPM, MS, Citi, BofA -- each with documented house views, biases, and analytical frameworks grounded in NY Fed SPD data.",
  },
  {
    icon: GitBranch,
    title: "Multi-Round Roundtable",
    description:
      "Dealers see each other's positions and update their views across 3-5 rounds. Watch consensus form and dissent emerge.",
  },
  {
    icon: Zap,
    title: "Crisis Injection",
    description:
      "Inject mid-simulation crisis events to force re-evaluation. Observe how sudden shocks shift positions across the panel.",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    description:
      "Force-directed graph reveals dealer-topic-concern relationships and influence patterns across all simulations.",
  },
  {
    icon: FileText,
    title: "Discussion Transcripts",
    description:
      "Markdown-formatted round-by-round narrative showing who shifted, who held firm, and why -- with anchor and swing dealers identified.",
  },
  {
    icon: ShieldCheck,
    title: "Disclaimers Built-In",
    description:
      "Every output is clearly marked as simulated. No claim of real dealer commentary. Persona profiles are system-controlled.",
  },
];

const workflow = [
  {
    n: "01",
    title: "Topic Research",
    description:
      "Enter a market topic. The Research Agent searches the web via Tavily, filters by recency, and synthesizes a structured event brief with source citations.",
  },
  {
    n: "02",
    title: "Round 1: Initial Reactions",
    description:
      "Each dealer agent reacts independently to the event. No peer context -- pure persona-driven response based on their established house view.",
  },
  {
    n: "03",
    title: "Rounds 2-N: Peer Response",
    description:
      "Dealers see all other dealers' prior reactions. They may shift, hold, or sharpen their position. Influence relationships are tracked.",
  },
  {
    n: "04",
    title: "Convergence or Crisis",
    description:
      "Simulation terminates when positions stabilize, or executes a crisis re-evaluation round if user injects a market shock.",
  },
  {
    n: "05",
    title: "Results & Analysis",
    description:
      "H/D spectrum, position evolution chart, comparative table, discussion transcript, and knowledge graph contributions.",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax transforms
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const cardY = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <MarketingShell>
      {/* Hero */}
      <section ref={heroRef} className="relative overflow-hidden border-b border-border">
        {/* Parallax background gradient */}
        <motion.div
          style={{ y: bgY }}
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/8 via-primary/3 to-transparent pointer-events-none"
        />
        {/* Second gradient layer at different speed for depth */}
        <motion.div
          style={{ y: useTransform(scrollYProgress, [0, 1], ["0%", "60%"]) }}
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(var(--primary)/0.12),transparent)] pointer-events-none"
        />

        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left: copy — slower parallax */}
            <motion.div style={{ y: textY, opacity }} className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span>System Ready</span>
                <span className="text-border">|</span>
                <span>Powered by Claude Sonnet 4.6</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
              >
                Simulate dealer reactions
                <br />
                <span className="text-muted-foreground">before the market moves.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed"
              >
                MarketBuzz runs multi-round AI agent roundtables modeling how
                5 primary dealers react to market events -- watching consensus
                form, dissent emerge, and crises shift positions.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mt-8 flex flex-col sm:flex-row items-start gap-3"
              >
                <Link
                  href="/console"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Launch Console
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  How it Works
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-10 grid grid-cols-3 gap-6 max-w-md"
              >
                <Stat value="5" label="Dealer Agents" />
                <Stat value="3-5" label="Round Depth" />
                <Stat value="< 90s" label="Per Simulation" />
              </motion.div>
            </motion.div>

            {/* Right: card stack — faster upward parallax (floats) */}
            <motion.div
              style={{ y: cardY, opacity }}
              className="lg:col-span-5"
            >
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <DealerCardStack />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Capabilities
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              A research desk that runs in 90 seconds.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Built for NY Fed Markets Group analysts and macro researchers who
              need scenario-grade dealer perspective without waiting for the
              next survey cycle.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3 rounded-lg overflow-hidden border border-border">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-card p-6"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Workflow
              </p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                The Roundtable Protocol
              </h2>
            </div>
            <span className="hidden md:block text-xs font-mono text-muted-foreground">
              05 / 05
            </span>
          </div>

          <div className="space-y-6">
            {workflow.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="grid grid-cols-12 gap-4 border-b border-border pb-6 last:border-0"
              >
                <div className="col-span-12 md:col-span-2">
                  <span className="font-mono text-2xl font-semibold text-muted-foreground">
                    {step.n}
                  </span>
                </div>
                <div className="col-span-12 md:col-span-3">
                  <h3 className="font-semibold">{step.title}</h3>
                </div>
                <div className="col-span-12 md:col-span-7">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Dealer panel */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              The Panel
            </p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              5 personas. Distinct house views.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Each dealer agent has a documented bias on the hawkish/dovish
              spectrum, characteristic concerns, and an analytical framework.
              Strong events can move any dealer against their bias.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {dealers.map((dealer, i) => (
              <motion.div
                key={dealer.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2"
                    style={{ borderColor: dealer.color }}
                  >
                    <span className="font-mono text-xs font-semibold">
                      {dealer.short}
                    </span>
                  </div>
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: dealer.color }}
                  >
                    {dealer.bias > 0 ? "+" : ""}
                    {dealer.bias.toFixed(1)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold">{dealer.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {dealer.bias > 0.2
                    ? "Hawkish"
                    : dealer.bias < -0.1
                      ? "Dovish"
                      : "Neutral"}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-card">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-12 text-center">
            <Activity className="mx-auto mb-6 h-10 w-10 text-primary" />
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Run your first sounding.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground leading-relaxed">
              Enter a topic, watch 5 dealers react, inject a crisis. No setup
              required.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/console"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
              >
                <Target className="h-4 w-4" />
                Launch Console
              </Link>
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
              >
                Talk to an Agent
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function DealerCardStack() {
  return (
    <div className="relative">
      <div className="rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span>Round 2 / 3</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            sim_a1b2c3d4
          </span>
        </div>

        <div className="space-y-2">
          {dealers.map((dealer, i) => (
            <motion.div
              key={dealer.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
              className="flex items-center gap-3 rounded-md border border-border bg-background p-3"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full border-2"
                style={{ borderColor: dealer.color }}
              >
                <span className="font-mono text-[10px] font-semibold">
                  {dealer.short}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {dealer.name}
                  </span>
                  <span
                    className="font-mono text-xs font-semibold"
                    style={{ color: dealer.color }}
                  >
                    {dealer.bias > 0 ? "+" : ""}
                    {dealer.bias.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${50 + dealer.bias * 50}%`,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: 0.6 + i * 0.08,
                      ease: "easeOut",
                    }}
                    className="h-full"
                    style={{ background: dealer.color }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>Convergence: 0.12</span>
          <span>Status: Running</span>
        </div>
      </div>

      {/* Decorative offset card */}
      <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-xl border border-border bg-card opacity-50" />
      <div className="absolute -bottom-8 -right-8 -z-20 h-full w-full rounded-xl border border-border bg-card opacity-25" />
    </div>
  );
}
