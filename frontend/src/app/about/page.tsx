"use client";

import Link from "next/link";
import { motion } from "motion/react";
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

const stack = [
  {
    icon: Brain,
    label: "AI Layer",
    items: [
      "Claude Opus 4.7 (primary reasoning)",
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
  return (
    <MarketingShell>
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-20">
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
