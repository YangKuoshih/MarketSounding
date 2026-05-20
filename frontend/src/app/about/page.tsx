"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Brain,
  Database,
  Cloud,
  Lock,
  Code,
  GitBranch,
} from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";

const dealers = [
  {
    id: "gs",
    short: "GS",
    name: "Goldman Sachs",
    bias: -0.2,
    color: "#60a5fa",
    keyVoice: "David Mericle · Jan Hatzius",
    personality:
      "Model-driven and quantitative. GS builds proprietary frameworks (Financial Conditions Index, Current Activity Indicator) and leans on data surprises relative to consensus. Calls tend to be early and contrarian. Comfortable with conditional probabilistic forecasts.",
    voiceSample:
      "Our FCI model suggests policy is restrictive by 75bp relative to neutral. The risk-reward favors a cut conditional on the next two payrolls prints.",
  },
  {
    id: "jpm",
    short: "JPM",
    name: "JP Morgan",
    bias: 0.1,
    color: "#94a3b8",
    keyVoice: "Michael Feroli · Bruce Kasman",
    personality:
      "Labor-market focused and methodical. JPM anchors views to payrolls breadth, JOLTS quits rate, and wage growth. Balanced, institutional tone. Prefers to wait for clear confirmation before committing to a directional call.",
    voiceSample:
      "Wage growth north of 4% is structurally inconsistent with the 2% target. We need evidence — not projections — of labor market softening before moving.",
  },
  {
    id: "ms",
    short: "MS",
    name: "Morgan Stanley",
    bias: 0.5,
    color: "#f87171",
    keyVoice: "Ellen Zentner · Mike Wilson",
    personality:
      "Contrarian and tail-risk focused. MS builds scenario trees and consistently flags risks the market underprices. Often the most hawkish voice in the room, emphasizing financial conditions loosening and the risk of premature easing.",
    voiceSample:
      "Financial conditions have unwound 50bp of effective tightening since October. The market is priced for perfection — that concerns us more than the data.",
  },
  {
    id: "citi",
    short: "Citi",
    name: "Citi",
    bias: 0.0,
    color: "#94a3b8",
    keyVoice: "Andrew Hollenhorst",
    personality:
      "Print-reactive and consensus-leaning. Citi tracks high-frequency data series closely and adjusts quickly to incoming prints. Tends toward the median view but will break from consensus when the data clearly supports it.",
    voiceSample:
      "Initial claims trending higher, ISM services contracting, consumer confidence falling — the data is telling a coherent story the Fed hasn't fully acknowledged yet.",
  },
  {
    id: "bofa",
    short: "BofA",
    name: "Bank of America",
    bias: 0.3,
    color: "#fb923c",
    keyVoice: "Michael Gapen",
    personality:
      "Consumer-spending anchored with a hawkish lean. BofA's proprietary card transaction data gives them a direct read on consumer activity that often diverges from headline surveys. Resistant to slowdown narratives until their own data confirms it.",
    voiceSample:
      "Our card data shows no signs of the slowdown others are forecasting. The savings drawdown narrative is overstated. We see one cut, maybe, and only if the data forces it.",
  },
];

const stack = [
  {
    icon: Brain,
    label: "AI Layer",
    items: [
      "Claude Sonnet 4.6 (primary reasoning)",
      "Claude Haiku (utility tasks)",
      "AWS Bedrock AgentCore",
      "Per-dealer session memory",
    ],
  },
  {
    icon: Cloud,
    label: "Backend",
    items: [
      "AWS Lambda (Node.js 20)",
      "Step Functions (multi-round orchestration)",
      "API Gateway REST + JWT auth",
      "Tavily web search integration",
    ],
  },
  {
    icon: Database,
    label: "Data Layer",
    items: [
      "DynamoDB (7 tables, on-demand)",
      "S3 (transcripts + graph cache)",
      "Encrypted at rest (AWS-managed)",
      "GSI-based user query isolation",
    ],
  },
  {
    icon: Code,
    label: "Frontend",
    items: [
      "Next.js 15 (static export)",
      "Tailwind CSS 4 + shadcn/ui",
      "D3.js visualizations",
      "Motion (Framer Motion) animations",
    ],
  },
  {
    icon: Lock,
    label: "Security",
    items: [
      "bcrypt password hashing (10 rounds)",
      "JWT HS256, 24h expiry",
      "Timing-safe credential validation",
      "TLS 1.2+ enforced via API Gateway",
    ],
  },
  {
    icon: GitBranch,
    label: "Infrastructure",
    items: [
      "Terraform IaC (modular)",
      "CloudFront + S3 (OAC)",
      "Multi-environment (dev/prod)",
      "Property-based testing (fast-check)",
    ],
  },
];

export default function AboutPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  return (
    <MarketingShell>
      <section ref={heroRef} className="relative overflow-hidden border-b border-border">
        {/* Parallax background gradient */}
        <motion.div
          style={{ y: bgY }}
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/6 via-primary/2 to-transparent pointer-events-none"
        />
        <div className="mx-auto max-w-5xl px-6 py-20">
          <motion.div style={{ y: heroY, opacity: heroOpacity }}>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3"
            >
              About
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-4xl font-semibold tracking-tight sm:text-5xl"
            >
              A market sounding desk that runs in agent-time.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-6 text-lg text-muted-foreground leading-relaxed"
            >
              MarketSounding models how primary dealers respond to market events
              through a multi-round AI roundtable. Inspired by MiroFish&apos;s
              multi-agent simulation framework, the system fuses topic-driven web
              research, persona-grounded LLM reasoning, and convergence detection
              to surface dealer perspectives in under 90 seconds.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Mission
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                Surface dealer perspective at the speed of news.
              </h2>
            </div>
            <div className="lg:col-span-8 space-y-6 text-base leading-relaxed text-muted-foreground">
              <p>
                Primary dealer surveys are the gold standard for market
                sentiment, but they run on a quarterly cadence and arrive after
                events have already moved markets. MarketSounding bridges that
                gap with simulated dealer reactions grounded in documented house
                views and recent NY Fed SPD survey data.
              </p>
              <p>
                The multi-round design is the differentiator: dealers don&apos;t
                react in isolation. They see each other&apos;s positions and
                update their views, exposing convergence dynamics, anchor and
                swing dealers, and how a sudden crisis injection can fragment
                consensus.
              </p>
              <p>
                Every output ships with an explicit{" "}
                <span className="font-medium text-foreground">
                  Simulated views -- not actual dealer commentary
                </span>{" "}
                disclaimer. Persona profiles are system-controlled and audited
                for accuracy against public dealer research.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dealer personas */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-10">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              The Dealers
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Five desks. Five distinct voices.
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-2xl">
              Each agent is grounded in publicly documented house views, characteristic reasoning styles, and a calibrated hawkish/dovish default. They don&apos;t just react — they challenge each other.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dealers.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-[10px] font-bold"
                        style={{ borderColor: d.color, color: d.color }}
                      >
                        {d.short}
                      </span>
                      <h3 className="text-sm font-semibold">{d.name}</h3>
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {d.keyVoice}
                    </p>
                  </div>
                  {/* Bias indicator */}
                  <div className="text-right shrink-0">
                    <span
                      className="font-mono text-sm font-semibold"
                      style={{ color: d.color }}
                    >
                      {d.bias > 0 ? "+" : ""}{d.bias.toFixed(1)}
                    </span>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {d.bias > 0.2 ? "Hawkish" : d.bias < -0.1 ? "Dovish" : "Neutral"}
                    </p>
                  </div>
                </div>

                {/* Bias bar */}
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${((d.bias + 1) / 2) * 100}%`,
                      background: d.color,
                    }}
                  />
                </div>

                {/* Personality */}
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                  {d.personality}
                </p>

                {/* Voice sample */}
                <blockquote className="border-l-2 pl-3 text-xs italic text-muted-foreground/80 leading-relaxed" style={{ borderColor: d.color }}>
                  &ldquo;{d.voiceSample}&rdquo;
                </blockquote>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="mb-10">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Tech Stack
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Built on AWS-native serverless.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-3 rounded-lg overflow-hidden border border-border">
            {stack.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="bg-card p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <s.icon className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {s.items.map((item) => (
                    <li
                      key={item}
                      className="text-sm text-foreground/90 leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer block */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning/20 mt-0.5">
                <span className="text-xs font-bold text-warning">!</span>
              </div>
              <div>
                <h3 className="font-semibold mb-2">
                  Important: Simulated content only
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All dealer reactions in MarketSounding are generated by AI
                  agents. They are not statements, opinions, or commentary from
                  actual primary dealers. Persona profiles are constructed from
                  publicly documented house views and may not reflect current
                  positioning. This system is intended for analytical exercise
                  and scenario exploration only -- not for trading decisions or
                  market-moving distribution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to run a sounding?
          </h2>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/console"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Launch Console
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
            >
              Try Agent Chat
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
