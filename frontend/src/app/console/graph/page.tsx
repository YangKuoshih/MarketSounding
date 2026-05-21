"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader,
  AlertTriangle,
  Network,
  ArrowRight,
  X,
  Clock,
  Trash2,
} from "lucide-react";
import {
  KnowledgeGraph,
  type GraphNode,
  type GraphEdge,
} from "@/components/viz/knowledge-graph";
import { type GraphQuerySpec } from "@/components/chat-graph-query";
import { api, ApiError, type GraphQueryRecord } from "@/lib/api-client";

// Inline label map since it won't be exported from the component module
const OP_LABELS: Record<string, string> = {
  shortest_path: "Shortest Path",
  centrality: "Centrality",
  filter_by_type: "Filter by Type",
  filter_by_concern: "Filter by Concern",
  highlight_node: "Highlight Node",
  subgraph: "Subgraph",
};

function adaptApiNode(n: {
  nodeId: string;
  nodeType: string;
  label?: string;
  metadata?: Record<string, unknown>;
}): GraphNode {
  return {
    id: n.nodeId,
    type: (n.nodeType as GraphNode["type"]) || "topic",
    label: n.label || n.nodeId,
    metadata: n.metadata || {},
  };
}

function adaptApiEdge(e: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  weight?: number;
}): GraphEdge {
  return {
    source: e.sourceNodeId,
    target: e.targetNodeId,
    edgeType: (e.edgeType as GraphEdge["edgeType"]) || "topic",
    weight: e.weight ?? 0.5,
  };
}

type NodeType = GraphNode["type"];
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  dealer: "Dealers",
  topic: "Topics",
  concern: "Concerns",
  crisis: "Crisis",
};
const ALL_NODE_TYPES: NodeType[] = ["dealer", "topic", "concern", "crisis"];

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Node type visibility filter (hidden = not shown)
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());

  // Active query from Jarrett
  const [activeQuery, setActiveQuery] = useState<GraphQuerySpec | null>(null);
  const [activeQueryText, setActiveQueryText] = useState<string | null>(null);

  // Query history panel
  const [showHistory, setShowHistory] = useState(false);
  const [queryHistory, setQueryHistory] = useState<GraphQueryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Derived: filtered nodes/edges based on hidden types
  const visibleNodes = nodes.filter((n) => !hiddenTypes.has(n.type));
  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => {
    const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
    const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
    return visibleNodeIds.has(s) && visibleNodeIds.has(t);
  });

  function toggleType(type: NodeType) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // Load graph data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.graph.subgraph();
        if (cancelled) return;
        const apiNodes = (result.nodes || []).map(
          (n) => adaptApiNode(n as Parameters<typeof adaptApiNode>[0])
        );
        const apiEdges = (result.edges || []).map(
          (e) => adaptApiEdge(e as Parameters<typeof adaptApiEdge>[0])
        );
        setNodes(apiNodes);
        setEdges(apiEdges);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Failed to load graph";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Listen for jarrett:graph events from the widget / chat page
  useEffect(() => {
    function handleGraphQuery(e: Event) {
      const detail = (e as CustomEvent).detail as {
        spec: GraphQuerySpec;
        naturalLanguage: string;
      };
      if (!detail?.spec) return;
      setActiveQuery(detail.spec);
      setActiveQueryText(detail.naturalLanguage || detail.spec.explanation);

      // Persist to history
      api.graph
        .saveQuery({
          naturalLanguage: detail.naturalLanguage || detail.spec.explanation,
          operation: detail.spec.operation,
          params: detail.spec.params,
          explanation: detail.spec.explanation,
          resultSummary: detail.spec.resultSummary,
        })
        .catch(() => {/* best-effort */});
    }

    window.addEventListener("jarrett:graph", handleGraphQuery);
    return () => window.removeEventListener("jarrett:graph", handleGraphQuery);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const records = await api.graph.listQueries();
      setQueryHistory(records);
    } catch {
      // best-effort
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  function toggleHistory() {
    setShowHistory((prev) => {
      if (!prev) loadHistory();
      return !prev;
    });
  }

  function replayQuery(record: GraphQueryRecord) {
    setActiveQuery({
      operation: record.operation as GraphQuerySpec["operation"],
      params: record.params,
      explanation: record.explanation,
      resultSummary: record.resultSummary,
    });
    setActiveQueryText(record.naturalLanguage);
    setShowHistory(false);
  }

  async function deleteQuery(queryId: string) {
    await api.graph.deleteQuery(queryId).catch(() => {});
    setQueryHistory((prev) => prev.filter((r) => r.queryId !== queryId));
  }

  function clearQuery() {
    setActiveQuery(null);
    setActiveQueryText(null);
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold">Knowledge Graph</h1>
          <p className="text-xs text-muted-foreground font-mono">
            {visibleNodes.length}/{nodes.length} nodes · {visibleEdges.length}/{edges.length} edges
          </p>
        </div>

        {/* Node type filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-1">Show</span>
          {ALL_NODE_TYPES.map((type) => {
            const hidden = hiddenTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest border transition-colors cursor-pointer ${
                  hidden
                    ? "border-border text-muted-foreground/40 bg-transparent"
                    : "border-primary/40 text-primary bg-primary/10"
                }`}
              >
                {NODE_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Query history button */}
          <button
            onClick={toggleHistory}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted transition-colors cursor-pointer"
          >
            <Clock className="h-3 w-3 text-muted-foreground" />
            History
          </button>

          <div className="flex items-center gap-1.5">
            {loading ? (
              <>
                <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Loading</span>
              </>
            ) : error ? (
              <>
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-warning">Fallback</span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Live</span>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active query bar */}
      {activeQuery && (
        <motion.div
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-6 py-2"
        >
          <Network className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary mr-2">
              {OP_LABELS[activeQuery.operation] ?? activeQuery.operation}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {activeQueryText || activeQuery.explanation}
            </span>
          </div>
          <button
            onClick={clearQuery}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted cursor-pointer text-muted-foreground shrink-0"
            aria-label="Clear query"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative flex-1 overflow-hidden"
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Building knowledge graph</p>
              <p className="text-xs text-muted-foreground mt-1">Mapping dealer influence networks across all simulations…</p>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Network className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Graph is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Complete a simulation to populate the knowledge graph with dealer positions, topics, and influence edges.
              </p>
            </div>
            <Link
              href="/console/sounding/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Run a simulation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <KnowledgeGraph nodes={visibleNodes} edges={visibleEdges} activeQuery={activeQuery} />
        )}

        {/* Zoom controls */}
        <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted cursor-pointer"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted cursor-pointer"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-muted cursor-pointer"
            aria-label="Reset view"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* History panel */}
        {showHistory && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            className="absolute left-0 top-0 h-full w-72 border-r border-border bg-card shadow-xl z-20 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">Query History</span>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted cursor-pointer text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : queryHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No graph queries yet.
                  <br />
                  Ask Jarrett to analyse the graph.
                </div>
              ) : (
                queryHistory.map((record) => (
                  <div
                    key={record.queryId}
                    className="group rounded-lg border border-border p-3 space-y-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                        {OP_LABELS[record.operation] ?? record.operation}
                      </span>
                      <button
                        onClick={() => deleteQuery(record.queryId)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/10 cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs leading-snug line-clamp-2">
                      {record.naturalLanguage}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(record.createdAt).toLocaleString()}
                    </p>
                    <button
                      onClick={() => replayQuery(record)}
                      className="w-full rounded bg-primary/10 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      Replay
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Legend */}
      <div className="border-t border-border bg-card px-6 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Legend
          </span>
          <LegendNode shape="circle" color="var(--primary)" label="Dealer" />
          <LegendNode shape="rect" color="var(--muted-foreground)" label="Topic" />
          <LegendNode shape="diamond" color="var(--accent)" label="Concern" />
          <LegendNode shape="triangle" color="var(--warning)" label="Crisis" />
          <span className="ml-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Edges
          </span>
          <LegendEdge color="var(--primary)" label="Influence" dashed={false} />
          <LegendEdge color="var(--muted-foreground)" label="Concern" dashed />
          <LegendEdge color="var(--warning)" label="Crisis" dashed={false} />
          {activeQuery && (
            <span className="ml-4 text-[10px] font-mono uppercase tracking-widest text-primary animate-pulse">
              ● Query Active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendNode({
  shape,
  color,
  label,
}: {
  shape: "circle" | "rect" | "diamond" | "triangle";
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {shape === "circle" && (
        <div className="h-3 w-3 rounded-full border-2" style={{ borderColor: color, background: "var(--card)" }} />
      )}
      {shape === "rect" && (
        <div className="h-3 w-4 rounded-sm border" style={{ borderColor: color, background: "var(--card)" }} />
      )}
      {shape === "diamond" && (
        <div className="h-3 w-3 rotate-45 border" style={{ borderColor: color, background: "var(--card)" }} />
      )}
      {shape === "triangle" && (
        <svg width="12" height="12" viewBox="0 0 12 12">
          <polygon points="6,1 11,10 1,10" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1" />
        </svg>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function LegendEdge({ color, label, dashed }: { color: string; label: string; dashed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="2" viewBox="0 0 20 2">
        <line x1="0" y1="1" x2="20" y2="1" stroke={color} strokeWidth="1.5" strokeDasharray={dashed ? "3,2" : "0"} />
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
