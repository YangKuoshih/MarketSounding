"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { X, MessageSquare } from "lucide-react";
import type { GraphQuerySpec } from "@/components/chat-graph-query";

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: "dealer" | "topic" | "concern" | "crisis";
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  edgeType: "influence" | "concern" | "topic" | "correlation" | "crisis";
  weight: number;
}

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeQuery?: GraphQuerySpec | null;
}

const NODE_COLORS: Record<GraphNode["type"], string> = {
  dealer: "var(--primary)",
  topic: "var(--muted-foreground)",
  concern: "var(--accent)",
  crisis: "var(--warning)",
};

const NODE_SIZES: Record<GraphNode["type"], number> = {
  dealer: 22,
  topic: 18,
  concern: 14,
  crisis: 16,
};

function nodeQuestion(node: GraphNode): string {
  const meta = node.metadata || {};
  if (node.type === "dealer") {
    return `What is ${node.label}'s current macro view and typical concerns about rates and the Fed?`;
  }
  if (node.type === "topic") {
    return `How do the dealers typically react to "${node.label}"? Who anchors the consensus?`;
  }
  if (node.type === "concern") {
    const dealers = (meta.dealerIds as string[] | undefined)?.join(", ") || "the dealers";
    return `Why do ${dealers} cite "${node.label}" as a key concern? How does it affect their H/D positioning?`;
  }
  if (node.type === "crisis") {
    return `How would a crisis event like "${node.label}" change dealer positions and the H/D spectrum?`;
  }
  return `Tell me about "${node.label}" in the context of macro markets.`;
}

// BFS shortest path between two node IDs; returns array of nodeIds on the path (inclusive) or null
function bfsPath(
  nodeId: string,
  targetId: string,
  nodes: GraphNode[],
  edges: GraphEdge[]
): string[] | null {
  const nodeSet = new Set(nodes.map((n) => n.id));
  if (!nodeSet.has(nodeId) || !nodeSet.has(targetId)) return null;

  // Build adjacency list (undirected)
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
    const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
    adj.get(s)?.add(t);
    adj.get(t)?.add(s);
  }

  const visited = new Map<string, string | null>(); // nodeId -> parent
  visited.set(nodeId, null);
  const queue = [nodeId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === targetId) {
      // Reconstruct path
      const path: string[] = [];
      let c: string | null = curr;
      while (c !== null) {
        path.unshift(c);
        c = visited.get(c) ?? null;
      }
      return path;
    }
    for (const neighbor of adj.get(curr) ?? []) {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, curr);
        queue.push(neighbor);
      }
    }
  }
  return null; // disconnected
}

// Degree centrality: returns map nodeId -> degree
function degreeCentrality(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const n of nodes) deg.set(n.id, 0);
  for (const e of edges) {
    const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
    const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
    deg.set(s, (deg.get(s) ?? 0) + 1);
    deg.set(t, (deg.get(t) ?? 0) + 1);
  }
  return deg;
}

// Compute highlighted nodes and edges from a GraphQuerySpec
function computeHighlights(
  query: GraphQuerySpec,
  nodes: GraphNode[],
  edges: GraphEdge[]
): { highlightedNodes: Set<string>; highlightedEdges: Set<string>; dimAll: boolean } {
  const highlightedNodes = new Set<string>();
  const highlightedEdges = new Set<string>();
  let dimAll = false;

  const edgeKey = (e: GraphEdge) => {
    const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
    const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
    return `${s}::${t}`;
  };

  switch (query.operation) {
    case "shortest_path": {
      const src = query.params.source as string;
      const tgt = query.params.target as string;
      const path = bfsPath(src, tgt, nodes, edges);
      if (path) {
        path.forEach((id) => highlightedNodes.add(id));
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i];
          const b = path[i + 1];
          for (const e of edges) {
            const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
            const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
            if ((s === a && t === b) || (s === b && t === a)) {
              highlightedEdges.add(edgeKey(e));
            }
          }
        }
        dimAll = true;
      }
      break;
    }

    case "centrality": {
      const metric = (query.params.metric as string) || "degree";
      const topN = (query.params.topN as number) || 5;
      const deg = degreeCentrality(nodes, edges);
      const sorted = [...deg.entries()].sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, topN).map(([id]) => id);
      top.forEach((id) => highlightedNodes.add(id));
      // highlight edges between top nodes
      for (const e of edges) {
        const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        if (highlightedNodes.has(s) && highlightedNodes.has(t)) {
          highlightedEdges.add(edgeKey(e));
        }
      }
      dimAll = true;
      break;
    }

    case "filter_by_type": {
      const types = (query.params.nodeTypes as string[]) || [];
      for (const n of nodes) {
        if (types.includes(n.type)) highlightedNodes.add(n.id);
      }
      for (const e of edges) {
        const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        if (highlightedNodes.has(s) && highlightedNodes.has(t)) {
          highlightedEdges.add(edgeKey(e));
        }
      }
      dimAll = true;
      break;
    }

    case "filter_by_concern": {
      const kw = ((query.params.concern as string) || "").toLowerCase();
      const matchingConcerns = new Set<string>();
      for (const n of nodes) {
        if (n.type === "concern" && n.label.toLowerCase().includes(kw)) {
          matchingConcerns.add(n.id);
          highlightedNodes.add(n.id);
        }
      }
      // Also highlight nodes connected to matching concerns
      for (const e of edges) {
        const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        if (matchingConcerns.has(s) || matchingConcerns.has(t)) {
          highlightedNodes.add(s);
          highlightedNodes.add(t);
          highlightedEdges.add(edgeKey(e));
        }
      }
      dimAll = true;
      break;
    }

    case "highlight_node": {
      const nodeId = query.params.nodeId as string;
      highlightedNodes.add(nodeId);
      for (const e of edges) {
        const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        if (s === nodeId || t === nodeId) {
          highlightedNodes.add(s === nodeId ? t : s);
          highlightedEdges.add(edgeKey(e));
        }
      }
      dimAll = true;
      break;
    }

    case "subgraph": {
      const ids = (query.params.nodeIds as string[]) || [];
      const idSet = new Set(ids);
      ids.forEach((id) => highlightedNodes.add(id));
      for (const e of edges) {
        const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
        const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
        if (idSet.has(s) && idSet.has(t)) {
          highlightedEdges.add(edgeKey(e));
        }
      }
      dimAll = true;
      break;
    }
  }

  return { highlightedNodes, highlightedEdges, dimAll };
}

export function KnowledgeGraph({ nodes, edges, activeQuery }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const router = useRouter();

  const applyHighlights = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (!activeQuery) {
      // Reset all highlights
      svg.selectAll<SVGLineElement, GraphEdge>("line")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", (d) => Math.max(1, d.weight * 3));
      svg.selectAll<SVGGElement, GraphNode>(".node")
        .style("opacity", 1)
        .each(function () {
          const g = d3.select<SVGGElement, GraphNode>(this);
          g.selectAll<SVGElement, unknown>("circle, rect, polygon")
            .attr("filter", null)
            .attr("stroke-width", "1.5");
          g.selectAll<SVGCircleElement, unknown>("circle").attr("stroke-width", "2.5");
        });
      return;
    }

    const { highlightedNodes, highlightedEdges, dimAll } = computeHighlights(
      activeQuery,
      nodes,
      edges
    );

    const edgeKey = (e: GraphEdge) => {
      const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
      const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
      return `${s}::${t}`;
    };

    svg
      .selectAll<SVGLineElement, GraphEdge>("line")
      .attr("stroke-opacity", (d) => {
        if (!dimAll) return 0.5;
        return highlightedEdges.has(edgeKey(d)) ? 0.9 : 0.05;
      })
      .attr("stroke-width", (d) => {
        if (highlightedEdges.has(edgeKey(d))) return Math.max(2, d.weight * 4);
        return Math.max(1, d.weight * 3);
      });

    svg
      .selectAll<SVGGElement, GraphNode>(".node")
      .style("opacity", (d) => {
        if (!dimAll) return 1;
        return highlightedNodes.has(d.id) ? 1 : 0.15;
      });

    // Add glow filter to highlighted nodes
    svg
      .selectAll<SVGGElement, GraphNode>(".node")
      .each(function (d) {
        const g = d3.select<SVGGElement, GraphNode>(this);
        const isHighlighted = highlightedNodes.has(d.id);
        g.selectAll<SVGElement, unknown>("circle, rect, polygon").attr(
          "filter",
          isHighlighted ? "url(#glow)" : null
        );
        if (isHighlighted) {
          g.selectAll<SVGCircleElement, unknown>("circle").attr("stroke-width", "3.5");
          g.selectAll<SVGRectElement, unknown>("rect").attr("stroke-width", "2.5");
          g.selectAll<SVGPolygonElement, unknown>("polygon").attr("stroke-width", "2.5");
        } else {
          g.selectAll<SVGCircleElement, unknown>("circle").attr("stroke-width", "2.5");
          g.selectAll<SVGRectElement, unknown>("rect, polygon").attr("stroke-width", "1.5");
        }
      });
  }, [activeQuery, nodes, edges]);

  // Re-apply highlights whenever activeQuery changes (without re-running simulation)
  useEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");

    // Arrow marker
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "currentColor");

    // Glow filter for highlighted nodes
    const filter = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const root = svg.append("g").attr("class", "graph-root");

    const edgeStrokes: Record<GraphEdge["edgeType"], string> = {
      influence: "var(--primary)",
      concern: "var(--muted-foreground)",
      topic: "var(--border)",
      correlation: "var(--accent)",
      crisis: "var(--warning)",
    };

    const edgeDashArray: Record<GraphEdge["edgeType"], string> = {
      influence: "0",
      concern: "4,3",
      topic: "0",
      correlation: "1,3",
      crisis: "0",
    };

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(110)
          .strength(0.6),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3
          .forceCollide<GraphNode>()
          .radius((d) => NODE_SIZES[d.type] + 8),
      );

    const link = root
      .append("g")
      .attr("class", "edges")
      .selectAll("line")
      .data(edges)
      .enter()
      .append("line")
      .attr("stroke", (d) => edgeStrokes[d.edgeType])
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (d) => Math.max(1, d.weight * 3))
      .attr("stroke-dasharray", (d) => edgeDashArray[d.edgeType])
      .attr("marker-end", (d) =>
        d.edgeType === "influence" ? "url(#arrow)" : null,
      );

    const nodeGroup = root
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        setSelectedNode(d);
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    nodeGroup.each(function (d) {
      const g = d3.select(this);
      const size = NODE_SIZES[d.type];
      const color = NODE_COLORS[d.type];

      if (d.type === "dealer") {
        g.append("circle")
          .attr("r", size)
          .attr("fill", "var(--card)")
          .attr("stroke", color)
          .attr("stroke-width", 2.5);
      } else if (d.type === "topic") {
        const maxCharsForSize = 22;
        const displayLen = Math.min(d.label.length, maxCharsForSize);
        const w = Math.max(60, displayLen * 6.5);
        const h = 28;
        g.append("rect")
          .attr("x", -w / 2)
          .attr("y", -h / 2)
          .attr("width", w)
          .attr("height", h)
          .attr("rx", 6)
          .attr("fill", "var(--card)")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      } else if (d.type === "concern") {
        const points = `0,${-size} ${size},0 0,${size} ${-size},0`;
        g.append("polygon")
          .attr("points", points)
          .attr("fill", "var(--card)")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      } else if (d.type === "crisis") {
        const points = `0,${-size} ${size},${size * 0.7} ${-size},${size * 0.7}`;
        g.append("polygon")
          .attr("points", points)
          .attr("fill", "var(--warning)")
          .attr("fill-opacity", 0.2)
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      }

      const maxChars = d.type === "dealer" ? 6 : d.type === "topic" ? 22 : 14;
      const labelText = d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + "…" : d.label;
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", d.type === "dealer" ? "10px" : "9px")
        .attr("font-weight", d.type === "dealer" ? "600" : "500")
        .attr("font-family", "var(--font-fira-code)")
        .attr("fill", "var(--foreground)")
        .style("pointer-events", "none")
        .text(labelText);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Apply initial highlights after simulation starts
    simulation.on("end", applyHighlights);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });

    svg.call(zoom);

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, applyHighlights]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute right-4 top-4 z-10 w-80 rounded-lg border border-border bg-card p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {selectedNode.type}
                </p>
                <h3 className="text-base font-semibold">
                  {selectedNode.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted cursor-pointer"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <NodeDetails node={selectedNode} />

            <button
              onClick={() => {
                const q = encodeURIComponent(nodeQuestion(selectedNode));
                router.push(`/chat?q=${q}`);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask Jarrett about this
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NodeDetails({ node }: { node: GraphNode }) {
  const meta = node.metadata || {};

  if (node.type === "dealer") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Avg H/D Score</p>
          <p className="font-mono font-semibold">
            {(meta.avgHawkishDovishScore as number)?.toFixed(2) ?? "N/A"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Simulations</p>
          <p className="font-mono">
            {(meta.simulationCount as number) ?? 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Top Concerns</p>
          <div className="flex flex-wrap gap-1">
            {((meta.topConcerns as string[]) ?? []).map((c) => (
              <span
                key={c}
                className="rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (node.type === "topic") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Event Date</p>
          <p className="font-mono">{(meta.eventDate as string) ?? "N/A"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Consensus Score</p>
          <p className="font-mono font-semibold">
            {(meta.consensusScore as number)?.toFixed(2) ?? "N/A"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {(meta.eventTitle as string) ?? ""}
        </p>
      </div>
    );
  }

  if (node.type === "concern") {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Frequency</p>
          <p className="font-mono">{(meta.frequency as number) ?? 0} mentions</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Category</p>
          <p className="font-mono uppercase">
            {(meta.category as string) ?? "general"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Cited By</p>
          <div className="flex flex-wrap gap-1">
            {((meta.dealerIds as string[]) ?? []).map((id) => (
              <span
                key={id}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono uppercase text-primary"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-muted-foreground">
      <p>{(meta.crisisText as string) ?? "No additional details"}</p>
    </div>
  );
}
