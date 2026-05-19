"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ZoomIn, ZoomOut, RotateCcw, Loader, AlertTriangle, Network, ArrowRight } from "lucide-react";
import {
  KnowledgeGraph,
  type GraphNode,
  type GraphEdge,
} from "@/components/viz/knowledge-graph";
import { api, ApiError } from "@/lib/api-client";

const sampleNodes: GraphNode[] = [
  // Dealers
  {
    id: "dealer:gs",
    type: "dealer",
    label: "GS",
    metadata: {
      avgHawkishDovishScore: -0.25,
      simulationCount: 12,
      topConcerns: ["Inflation", "Wages", "Rate Path"],
    },
  },
  {
    id: "dealer:jpm",
    type: "dealer",
    label: "JPM",
    metadata: {
      avgHawkishDovishScore: 0.1,
      simulationCount: 12,
      topConcerns: ["Wages", "Fiscal Deficit"],
    },
  },
  {
    id: "dealer:ms",
    type: "dealer",
    label: "MS",
    metadata: {
      avgHawkishDovishScore: 0.45,
      simulationCount: 12,
      topConcerns: ["FCI", "Shelter", "Geopolitical"],
    },
  },
  {
    id: "dealer:citi",
    type: "dealer",
    label: "Citi",
    metadata: {
      avgHawkishDovishScore: -0.05,
      simulationCount: 12,
      topConcerns: ["Recession", "CRE"],
    },
  },
  {
    id: "dealer:bofa",
    type: "dealer",
    label: "BofA",
    metadata: {
      avgHawkishDovishScore: 0.3,
      simulationCount: 12,
      topConcerns: ["Consumer", "Labor Supply"],
    },
  },

  // Topics
  {
    id: "topic:fomc-jun",
    type: "topic",
    label: "FOMC June",
    metadata: {
      eventDate: "2026-06-12",
      eventTitle: "FOMC June 2026 Decision",
      consensusScore: 0.62,
    },
  },
  {
    id: "topic:tariffs",
    type: "topic",
    label: "China Tariffs",
    metadata: {
      eventDate: "2026-04-08",
      eventTitle: "US-China Tariff Escalation",
      consensusScore: 0.41,
    },
  },
  {
    id: "topic:oil",
    type: "topic",
    label: "Oil Shock",
    metadata: {
      eventDate: "2026-03-15",
      eventTitle: "Middle East Oil Supply Shock",
      consensusScore: 0.78,
    },
  },

  // Concerns
  {
    id: "concern:inflation",
    type: "concern",
    label: "Inflation",
    metadata: {
      frequency: 24,
      category: "macro",
      dealerIds: ["gs", "ms", "bofa"],
    },
  },
  {
    id: "concern:wages",
    type: "concern",
    label: "Wages",
    metadata: {
      frequency: 18,
      category: "macro",
      dealerIds: ["gs", "jpm"],
    },
  },
  {
    id: "concern:fci",
    type: "concern",
    label: "FCI",
    metadata: {
      frequency: 15,
      category: "market",
      dealerIds: ["ms", "citi"],
    },
  },
  {
    id: "concern:supply-chain",
    type: "concern",
    label: "Supply Chain",
    metadata: {
      frequency: 9,
      category: "geopolitical",
      dealerIds: ["ms", "bofa"],
    },
  },

  // Crisis
  {
    id: "crisis:china-stim",
    type: "crisis",
    label: "China Stim",
    metadata: {
      crisisText: "China announces surprise 200bp rate cut and $2T stimulus",
    },
  },
];

const sampleEdges: GraphEdge[] = [
  // Topic -> Dealer (participation)
  { source: "topic:fomc-jun", target: "dealer:gs", edgeType: "topic", weight: 0.5 },
  { source: "topic:fomc-jun", target: "dealer:jpm", edgeType: "topic", weight: 0.5 },
  { source: "topic:fomc-jun", target: "dealer:ms", edgeType: "topic", weight: 0.5 },
  { source: "topic:fomc-jun", target: "dealer:citi", edgeType: "topic", weight: 0.5 },
  { source: "topic:fomc-jun", target: "dealer:bofa", edgeType: "topic", weight: 0.5 },
  { source: "topic:tariffs", target: "dealer:ms", edgeType: "topic", weight: 0.5 },
  { source: "topic:tariffs", target: "dealer:bofa", edgeType: "topic", weight: 0.5 },
  { source: "topic:oil", target: "dealer:gs", edgeType: "topic", weight: 0.5 },
  { source: "topic:oil", target: "dealer:ms", edgeType: "topic", weight: 0.5 },

  // Dealer -> Dealer (influence)
  { source: "dealer:gs", target: "dealer:jpm", edgeType: "influence", weight: 0.7 },
  { source: "dealer:ms", target: "dealer:bofa", edgeType: "influence", weight: 0.5 },
  { source: "dealer:gs", target: "dealer:citi", edgeType: "influence", weight: 0.6 },

  // Dealer -> Concern
  { source: "dealer:gs", target: "concern:inflation", edgeType: "concern", weight: 0.6 },
  { source: "dealer:gs", target: "concern:wages", edgeType: "concern", weight: 0.5 },
  { source: "dealer:jpm", target: "concern:wages", edgeType: "concern", weight: 0.7 },
  { source: "dealer:ms", target: "concern:inflation", edgeType: "concern", weight: 0.5 },
  { source: "dealer:ms", target: "concern:fci", edgeType: "concern", weight: 0.8 },
  { source: "dealer:citi", target: "concern:fci", edgeType: "concern", weight: 0.4 },
  { source: "dealer:bofa", target: "concern:inflation", edgeType: "concern", weight: 0.5 },
  { source: "dealer:bofa", target: "concern:supply-chain", edgeType: "concern", weight: 0.6 },
  { source: "dealer:ms", target: "concern:supply-chain", edgeType: "concern", weight: 0.5 },

  // Topic -> Topic (correlation)
  { source: "topic:fomc-jun", target: "topic:tariffs", edgeType: "correlation", weight: 0.4 },
  { source: "topic:tariffs", target: "topic:oil", edgeType: "correlation", weight: 0.3 },

  // Crisis -> Topic
  { source: "crisis:china-stim", target: "topic:fomc-jun", edgeType: "crisis", weight: 1 },
];

/**
 * Map a server-side graph node to the client-side GraphNode shape used by the D3 viz.
 */
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

export default function KnowledgeGraphPage() {
  const apiConfigured = !!process.env.NEXT_PUBLIC_API_URL;
  const [nodes, setNodes] = useState<GraphNode[]>(
    apiConfigured ? [] : sampleNodes,
  );
  const [edges, setEdges] = useState<GraphEdge[]>(
    apiConfigured ? [] : sampleEdges,
  );
  const [loading, setLoading] = useState(apiConfigured);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!apiConfigured) return;

    let cancelled = false;
    (async () => {
      try {
        const result = await api.graph.subgraph();
        if (cancelled) return;

        const apiNodes = (result.nodes || []).map(
          (n) => adaptApiNode(n as Parameters<typeof adaptApiNode>[0]),
        );
        const apiEdges = (result.edges || []).map(
          (e) => adaptApiEdge(e as Parameters<typeof adaptApiEdge>[0]),
        );

        // If the API returned an empty graph, fall back to sample data
        // so the page still demonstrates capability.
        if (apiNodes.length === 0) {
          setNodes(sampleNodes);
          setEdges(sampleEdges);
          setUsingFallback(true);
        } else {
          setNodes(apiNodes);
          setEdges(apiEdges);
        }
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof ApiError
            ? `${err.status}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "Failed to load graph";
        setError(msg);
        setNodes(sampleNodes);
        setEdges(sampleEdges);
        setUsingFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiConfigured]);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-base font-semibold">Knowledge Graph</h1>
          <p className="text-xs text-muted-foreground font-mono">
            {nodes.length} nodes, {edges.length} edges
            {usingFallback && (
              <span className="ml-2 text-warning">(sample data)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <Loader className="h-3 w-3 animate-spin text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Loading
              </span>
            </>
          ) : error ? (
            <>
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-warning">
                Fallback
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Live
              </span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            </>
          )}
        </div>
      </div>

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
              Run a sounding
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <KnowledgeGraph nodes={nodes} edges={edges} />
        )}

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
      </motion.div>

      <div className="border-t border-border bg-card px-6 py-3">
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
        <div
          className="h-3 w-3 rounded-full border-2"
          style={{ borderColor: color, background: "var(--card)" }}
        />
      )}
      {shape === "rect" && (
        <div
          className="h-3 w-4 rounded-sm border"
          style={{ borderColor: color, background: "var(--card)" }}
        />
      )}
      {shape === "diamond" && (
        <div
          className="h-3 w-3 rotate-45 border"
          style={{ borderColor: color, background: "var(--card)" }}
        />
      )}
      {shape === "triangle" && (
        <svg width="12" height="12" viewBox="0 0 12 12">
          <polygon
            points="6,1 11,10 1,10"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="1"
          />
        </svg>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function LegendEdge({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="2" viewBox="0 0 20 2">
        <line
          x1="0"
          y1="1"
          x2="20"
          y2="1"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={dashed ? "3,2" : "0"}
        />
      </svg>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
