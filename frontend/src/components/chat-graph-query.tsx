"use client";

import { Network, Loader, CheckCircle, AlertCircle } from "lucide-react";
import { useState } from "react";

export type GraphOperation =
  | "shortest_path"
  | "centrality"
  | "filter_by_type"
  | "filter_by_concern"
  | "highlight_node"
  | "subgraph";

export interface GraphQuerySpec {
  operation: GraphOperation;
  params: Record<string, unknown>;
  explanation: string;
  resultSummary: string;
}

export function parseGraphQuerySpec(text: string): {
  prose: string;
  graphQuery: GraphQuerySpec | null;
} {
  const match = text.match(/```graph_query\s*([\s\S]*?)```/);
  if (!match) return { prose: text, graphQuery: null };
  const prose = text.replace(/```graph_query[\s\S]*?```/, "").trim();
  try {
    const raw = JSON.parse(match[1].trim()) as {
      operation?: unknown;
      params?: unknown;
      explanation?: unknown;
      resultSummary?: unknown;
    };
    const validOps: GraphOperation[] = [
      "shortest_path",
      "centrality",
      "filter_by_type",
      "filter_by_concern",
      "highlight_node",
      "subgraph",
    ];
    const operation = validOps.includes(raw.operation as GraphOperation)
      ? (raw.operation as GraphOperation)
      : null;
    if (!operation) return { prose: text, graphQuery: null };
    const params =
      raw.params && typeof raw.params === "object" && !Array.isArray(raw.params)
        ? (raw.params as Record<string, unknown>)
        : {};
    const explanation =
      typeof raw.explanation === "string" ? raw.explanation : "";
    const resultSummary =
      typeof raw.resultSummary === "string" ? raw.resultSummary : "";
    return {
      prose,
      graphQuery: { operation, params, explanation, resultSummary },
    };
  } catch {
    return { prose: text, graphQuery: null };
  }
}

const OPERATION_LABELS: Record<GraphOperation, string> = {
  shortest_path: "Shortest Path",
  centrality: "Centrality Analysis",
  filter_by_type: "Filter by Type",
  filter_by_concern: "Filter by Concern",
  highlight_node: "Highlight Node",
  subgraph: "Subgraph",
};

interface GraphQueryCardProps {
  query: GraphQuerySpec;
  onApply: (query: GraphQuerySpec) => void;
  applied?: boolean;
}

export function GraphQueryCard({ query, onApply, applied }: GraphQueryCardProps) {
  const [state, setState] = useState<"ready" | "applying" | "done">("ready");

  function handleApply() {
    if (state !== "ready") return;
    setState("applying");
    setTimeout(() => {
      onApply(query);
      setState("done");
    }, 300);
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Network className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
          Graph Analysis
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">OP</span>
          <span className="text-xs font-semibold font-mono">
            {OPERATION_LABELS[query.operation]}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 pt-0.5">QUERY</span>
          <span className="text-xs leading-snug text-muted-foreground">{query.explanation}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 pt-0.5">RESULT</span>
          <span className="text-xs leading-snug">{query.resultSummary}</span>
        </div>
      </div>

      <button
        onClick={handleApply}
        disabled={state !== "ready" || applied}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
      >
        {state === "applying" ? (
          <>
            <Loader className="h-3.5 w-3.5 animate-spin" />
            Applying…
          </>
        ) : state === "done" || applied ? (
          <>
            <CheckCircle className="h-3.5 w-3.5" />
            Applied to Graph
          </>
        ) : (
          <>
            <Network className="h-3.5 w-3.5" />
            Apply to Knowledge Graph
          </>
        )}
      </button>

      {(state === "done" || applied) && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Navigate to the Knowledge Graph to see the result
        </div>
      )}
    </div>
  );
}
