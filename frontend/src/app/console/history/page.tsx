"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Loader,
  XCircle,
  ChevronDown,
  Filter,
  AlertCircle,
  ArrowRight,
  Printer,
} from "lucide-react";
import { motion } from "motion/react";
import { Sparkline } from "@/components/viz/sparkline";
import { api } from "@/lib/api-client";
import type { SimulationSummary } from "@/lib/api-client";

type Status = "complete" | "running" | "failed";

const PAGE_SIZE = 15;

const statusOptions: Array<{ value: Status | "all"; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "complete", label: "Complete" },
  { value: "running", label: "Running" },
  { value: "failed", label: "Failed" },
];

function inferTopic(title: string): string {
  const t = title.toLowerCase();
  if (/fomc|fed|rate|cut|hike|bps|basis point|powell|taper|qe|qt|balance sheet/.test(t)) return "Monetary Policy";
  if (/tariff|trade|china|export|import|wto|sanction/.test(t)) return "Trade Policy";
  if (/oil|opec|energy|gas|supply shock|middle east|iran|saudi|geopolit|war|conflict/.test(t)) return "Geopolitical";
  if (/yen|yuan|fx|currency|dollar|euro|sterling|intervention/.test(t)) return "FX Policy";
  if (/credit|downgrade|spread|cds|default|sovereign|debt/.test(t)) return "Credit";
  if (/inflation|cpi|pce|core|deflation/.test(t)) return "Inflation";
  if (/gdp|recession|growth|employment|jobs|payroll|unemployment/.test(t)) return "Macro";
  return "Other";
}

export default function HistoryPage() {
  const router = useRouter();
  const [simulations, setSimulations] = useState<SimulationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("All Topics");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.simulations.list();
        if (cancelled) return;
        const arr = Array.isArray(result)
          ? result
          : ((result as unknown as { simulations?: SimulationSummary[] }).simulations ?? []);
        setSimulations(arr);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Derive unique topics from actual data
  const availableTopics = useMemo(() => {
    const set = new Set(simulations.map((s) => inferTopic(s.eventTitle)));
    return ["All Topics", ...Array.from(set).sort()];
  }, [simulations]);

  const filtered = useMemo(() => {
    return simulations.filter((s) => {
      if (searchQuery && !s.eventTitle.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (topicFilter !== "All Topics" && inferTopic(s.eventTitle) !== topicFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [simulations, searchQuery, topicFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [searchQuery, topicFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Archive
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Simulation History</h1>
          </div>
          <div className="flex items-center gap-3">
            {loading && <Loader className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {!loading && (
              <span className="text-xs font-mono text-muted-foreground">
                {filtered.length.toString().padStart(2, "0")} /{" "}
                {simulations.length.toString().padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

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
            options={availableTopics}
            value={topicFilter}
            onChange={setTopicFilter}
          />
          <FilterDropdown
            options={statusOptions.map((s) => s.label)}
            value={statusOptions.find((s) => s.value === statusFilter)?.label ?? "All Statuses"}
            onChange={(label) => {
              const found = statusOptions.find((s) => s.label === label);
              if (found) setStatusFilter(found.value);
            }}
          />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-3 px-5 py-10 text-sm text-muted-foreground font-mono">
              <Loader className="h-4 w-4 animate-spin" />
              Loading simulations…
            </div>
          ) : pageItems.length === 0 ? (
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
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Rounds</th>
                  <th className="px-4 py-3 text-right font-medium">Trajectory</th>
                  <th className="px-4 py-3 text-right font-medium">Consensus</th>
                  <th className="px-4 py-3 text-right font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((sim, i) => (
                  <motion.tr
                    key={sim.simulationId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/console/sounding/${sim.simulationId}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium hover:text-primary transition-colors">
                        {sim.eventTitle || sim.simulationId}
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                        {inferTopic(sim.eventTitle)} · {sim.simulationId}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sim.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {sim.status === "complete"
                        ? `${sim.totalRounds} / ${sim.totalRounds}`
                        : `${sim.currentRound} / ${sim.totalRounds}`}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {sim.trajectory && sim.trajectory.length >= 2 ? (
                          <Sparkline values={sim.trajectory} />
                        ) : (
                          <span className="text-xs font-mono text-muted-foreground">--</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ConsensusCell value={sim.consensus} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(sim.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {sim.status === "complete" && (
                          <button
                            title="Print report"
                            onClick={() => {
                              window.open(`/console/sounding/${sim.simulationId}?print=1`, "_blank");
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <Link
                          href={`/console/sounding/${sim.simulationId}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          title="View simulation"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-mono">
              Page {page} of {totalPages} · {filtered.length} results
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40 hover:bg-muted cursor-pointer transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40 hover:bg-muted cursor-pointer transition-colors"
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

function ConsensusCell({ value }: { value?: number }) {
  if (value == null) {
    return <span className="text-xs font-mono text-muted-foreground">--</span>;
  }
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "text-success" : pct >= 40 ? "text-warning" : "text-destructive";
  return (
    <span className={`text-xs font-mono font-semibold ${color}`}>{pct}%</span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const config = {
    complete: { icon: CheckCircle, color: "text-success", bg: "bg-success/10", label: "Complete" },
    running: { icon: Loader, color: "text-primary", bg: "bg-primary/10", label: "Running" },
    failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Failed" },
  }[status];

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${config.bg} ${config.color}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {config.label}
    </span>
  );
}

function FilterDropdown({
  options,
  value,
  onChange,
}: {
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
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{value}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-full min-w-[160px] rounded-md border border-border bg-card shadow-lg overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center px-3 py-2 text-sm hover:bg-muted cursor-pointer text-left ${opt === value ? "bg-muted text-foreground font-medium" : ""}`}
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
