"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Loader,
  XCircle,
  ChevronDown,
  Filter,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { Sparkline } from "@/components/viz/sparkline";
import { api, ApiError } from "@/lib/api-client";

type Status = "complete" | "running" | "failed";

interface SimulationSummary {
  id: string;
  title: string;
  topic: string;
  status: Status;
  rounds: number;
  totalRounds: number;
  createdAt: string;
  // Average H/D trajectory across dealers per round
  trajectory: number[];
  consensus: number;
}

const sampleSimulations: SimulationSummary[] = [
  {
    id: "sim_a1b2c3d4",
    title: "FOMC June 2026 Decision",
    topic: "Monetary Policy",
    status: "complete",
    rounds: 3,
    totalRounds: 3,
    createdAt: "2026-05-14T09:32:00Z",
    trajectory: [0.05, 0.08, 0.1],
    consensus: 0.62,
  },
  {
    id: "sim_e5f6g7h8",
    title: "US-China Tariff Escalation",
    topic: "Trade Policy",
    status: "complete",
    rounds: 4,
    totalRounds: 4,
    createdAt: "2026-05-12T14:18:00Z",
    trajectory: [0.3, 0.35, 0.32, 0.34],
    consensus: 0.41,
  },
  {
    id: "sim_i9j0k1l2",
    title: "Middle East Oil Supply Shock",
    topic: "Geopolitical",
    status: "complete",
    rounds: 3,
    totalRounds: 3,
    createdAt: "2026-05-10T11:05:00Z",
    trajectory: [0.4, 0.45, 0.5],
    consensus: 0.78,
  },
  {
    id: "sim_m3n4o5p6",
    title: "Yen Intervention Speculation",
    topic: "FX Policy",
    status: "running",
    rounds: 2,
    totalRounds: 4,
    createdAt: "2026-05-16T08:45:00Z",
    trajectory: [-0.1, -0.05],
    consensus: 0.55,
  },
  {
    id: "sim_q7r8s9t0",
    title: "Fed Balance Sheet Taper Announcement",
    topic: "Monetary Policy",
    status: "complete",
    rounds: 3,
    totalRounds: 3,
    createdAt: "2026-05-08T15:22:00Z",
    trajectory: [-0.2, -0.25, -0.3],
    consensus: 0.71,
  },
  {
    id: "sim_u1v2w3x4",
    title: "Sovereign Credit Downgrade Watch",
    topic: "Credit",
    status: "failed",
    rounds: 1,
    totalRounds: 3,
    createdAt: "2026-05-06T10:11:00Z",
    trajectory: [0.0],
    consensus: 0,
  },
];

const topics = ["All Topics", "Monetary Policy", "Trade Policy", "Geopolitical", "FX Policy", "Credit"];
const statuses: Array<{ value: Status | "all"; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "complete", label: "Complete" },
  { value: "running", label: "Running" },
  { value: "failed", label: "Failed" },
];

interface ApiSimulationRecord {
  simulationId: string;
  title?: string;
  status: string;
  currentRound?: number;
  totalRounds?: number;
  createdAt: string;
}

function adaptApiSimulation(s: ApiSimulationRecord): SimulationSummary {
  return {
    id: s.simulationId,
    title: s.title || "Untitled Simulation",
    topic: "Monetary Policy", // Not yet populated server-side; default
    status: (s.status as Status) || "complete",
    rounds: s.currentRound || 0,
    totalRounds: s.totalRounds || 3,
    createdAt: s.createdAt,
    trajectory: [], // Not in summary; only available in full SimulationView
    consensus: 0,
  };
}

export default function HistoryPage() {
  const apiConfigured = !!process.env.NEXT_PUBLIC_API_URL;
  const [simulations, setSimulations] = useState<SimulationSummary[]>(
    apiConfigured ? [] : sampleSimulations,
  );
  const [loading, setLoading] = useState(apiConfigured);
  const [usingFallback, setUsingFallback] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("All Topics");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.simulations.list();
        if (cancelled) return;

        const records = (
          (result as unknown as { simulations?: ApiSimulationRecord[] })
            .simulations || (result as unknown as ApiSimulationRecord[])
        );
        const arr = Array.isArray(records) ? records : [];

        if (arr.length === 0) {
          setSimulations(sampleSimulations);
          setUsingFallback(true);
        } else {
          setSimulations(arr.map(adaptApiSimulation));
        }
      } catch (err) {
        if (cancelled) return;
        // Network error / 401 / 500 -- show sample data so the page is still useful
        const _msg =
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Failed to load history";
        void _msg;
        setSimulations(sampleSimulations);
        setUsingFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiConfigured]);

  const filtered = useMemo(() => {
    return simulations
      .filter((s) => {
        if (
          searchQuery &&
          !s.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        if (topicFilter !== "All Topics" && s.topic !== topicFilter)
          return false;
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [searchQuery, topicFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Archive
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Simulation History
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {usingFallback && !loading && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-warning">
                <AlertTriangle className="h-3 w-3" />
                Sample
              </span>
            )}
            <span className="text-xs font-mono text-muted-foreground">
              {filtered.length.toString().padStart(2, "0")} /{" "}
              {simulations.length.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search simulations..."
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <FilterDropdown
            label={topicFilter}
            options={topics}
            value={topicFilter}
            onChange={setTopicFilter}
          />
          <FilterDropdown
            label={statuses.find((s) => s.value === statusFilter)?.label || ""}
            options={statuses.map((s) => s.label)}
            value={statuses.find((s) => s.value === statusFilter)?.label || ""}
            onChange={(label) => {
              const found = statuses.find((s) => s.label === label);
              if (found) setStatusFilter(found.value);
            }}
          />
        </div>

        {/* List */}
        <div className="rounded-lg border border-border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-base font-semibold">
                {searchQuery || topicFilter !== "All Topics" || statusFilter !== "all"
                  ? "No simulations match your filters"
                  : "No simulations yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
                {searchQuery || topicFilter !== "All Topics" || statusFilter !== "all"
                  ? "Try clearing your search or adjusting the filters."
                  : "Run your first sounding to start building a history of dealer reactions."}
              </p>
              {!searchQuery && topicFilter === "All Topics" && statusFilter === "all" && (
                <Link
                  href="/console/sounding/new"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Run your first sounding
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Sim ID</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Rounds</th>
                  <th className="px-4 py-3 text-right font-medium">Trajectory</th>
                  <th className="px-4 py-3 text-right font-medium">Consensus</th>
                  <th className="px-4 py-3 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sim, i) => (
                  <motion.tr
                    key={sim.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <Link
                        href={`/console/sounding/demo`}
                        className="hover:text-foreground transition-colors"
                      >
                        {sim.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/console/sounding/demo`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {sim.title}
                      </Link>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                        {sim.topic}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sim.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {sim.rounds} / {sim.totalRounds}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Sparkline values={sim.trajectory} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {sim.consensus > 0
                        ? (sim.consensus * 100).toFixed(0) + "%"
                        : "--"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {new Date(sim.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Page 1 of 1
            </p>
            <div className="flex gap-1">
              <button
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-50 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-50 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const config = {
    complete: {
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
      label: "Complete",
    },
    running: {
      icon: Loader,
      color: "text-primary",
      bg: "bg-primary/10",
      label: "Running",
    },
    failed: {
      icon: XCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      label: "Failed",
    },
  }[status];

  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${config.bg} ${config.color}`}
    >
      <Icon
        className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted cursor-pointer min-w-[160px] justify-between"
      >
        <span className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-full min-w-[160px] rounded-md border border-border bg-card shadow-lg overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-sm hover:bg-muted cursor-pointer text-left ${
                  opt === value ? "bg-muted text-foreground" : ""
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
