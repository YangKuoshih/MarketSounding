"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { X, MessageSquare } from "lucide-react";

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

export function KnowledgeGraph({ nodes, edges }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Defs for arrow markers
    const defs = svg.append("defs");
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

    // Zoom container
    const root = svg.append("g").attr("class", "graph-root");

    // Edge styles
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

    // Force simulation
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

    // Edges
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

    // Nodes
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

    // Render nodes by type
    nodeGroup.each(function (d) {
      const g = d3.select(this);
      const size = NODE_SIZES[d.type];
      const color = NODE_COLORS[d.type];

      if (d.type === "dealer") {
        // Circle for dealer
        g.append("circle")
          .attr("r", size)
          .attr("fill", "var(--card)")
          .attr("stroke", color)
          .attr("stroke-width", 2.5);
      } else if (d.type === "topic") {
        // Rounded rect for topic
        const w = Math.max(60, d.label.length * 6.5);
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
        // Diamond for concern
        const points = `0,${-size} ${size},0 0,${size} ${-size},0`;
        g.append("polygon")
          .attr("points", points)
          .attr("fill", "var(--card)")
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      } else if (d.type === "crisis") {
        // Triangle for crisis
        const points = `0,${-size} ${size},${size * 0.7} ${-size},${size * 0.7}`;
        g.append("polygon")
          .attr("points", points)
          .attr("fill", "var(--warning)")
          .attr("fill-opacity", 0.2)
          .attr("stroke", color)
          .attr("stroke-width", 1.5);
      }

      // Label
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("font-size", d.type === "dealer" ? "10px" : "9px")
        .attr("font-weight", d.type === "dealer" ? "600" : "500")
        .attr("font-family", "var(--font-fira-code)")
        .attr("fill", "var(--foreground)")
        .style("pointer-events", "none")
        .text(d.label);
    });

    // Tick handler
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
      });

    svg.call(zoom);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

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
