"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { motion } from "motion/react";

interface RoundScore {
  round: number;
  score: number;
}

interface DealerTrajectory {
  personaId: string;
  shortName: string;
  scores: RoundScore[];
}

interface PositionEvolutionProps {
  trajectories: DealerTrajectory[];
}

const DEALER_COLORS: Record<string, string> = {
  gs: "#3b82f6",
  jpm: "#f97316",
  ms: "#ef4444",
  citi: "#6b7280",
  bofa: "#10b981",
};

export function PositionEvolution({ trajectories }: PositionEvolutionProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || trajectories.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 240;
    const margin = { top: 20, right: 80, bottom: 30, left: 40 };

    const maxRound = d3.max(trajectories.flatMap((t) => t.scores.map((s) => s.round))) || 3;

    const allScores = trajectories.flatMap((t) => t.scores.map((s) => s.score));
    const minScore = d3.min(allScores) ?? -1;
    const maxScore = d3.max(allScores) ?? 1;
    // Pad by 0.15 on each side so lines don't hug the edges, but keep within [-1, 1]
    const yPad = Math.max(0.15, (maxScore - minScore) * 0.2);
    const yMin = Math.max(-1, minScore - yPad);
    const yMax = Math.min(1, maxScore + yPad);

    const xScale = d3
      .scaleLinear()
      .domain([1, maxRound])
      .range([margin.left, width - margin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .range([height - margin.bottom, margin.top]);

    // Grid lines — use dynamic ticks matching the y axis
    const gridTicks = yScale.ticks(5).filter((v) => v !== 0);
    svg
      .append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(gridTicks)
      .enter()
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "2,4");

    // Zero line
    svg
      .append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", "var(--muted-foreground)")
      .attr("stroke-width", 1)
      .attr("opacity", 0.5);

    // X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(maxRound)
          .tickFormat((d) => `R${d}`),
      )
      .attr("color", "var(--muted-foreground)")
      .attr("font-family", "var(--font-fira-code)")
      .attr("font-size", "10px");

    // Y axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(5))
      .attr("color", "var(--muted-foreground)")
      .attr("font-family", "var(--font-fira-code)")
      .attr("font-size", "10px");

    // Lines
    const line = d3
      .line<RoundScore>()
      .x((d) => xScale(d.round))
      .y((d) => yScale(d.score))
      .curve(d3.curveMonotoneX);

    trajectories.forEach((trajectory) => {
      const color = DEALER_COLORS[trajectory.personaId] || "#6b7280";

      svg
        .append("path")
        .datum(trajectory.scores)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("d", line);

      // Data points
      svg
        .selectAll(`.point-${trajectory.personaId}`)
        .data(trajectory.scores)
        .enter()
        .append("circle")
        .attr("cx", (d) => xScale(d.round))
        .attr("cy", (d) => yScale(d.score))
        .attr("r", 4)
        .attr("fill", color)
        .attr("stroke", "var(--background)")
        .attr("stroke-width", 1.5);

      // Label at end
      const lastScore = trajectory.scores[trajectory.scores.length - 1];
      svg
        .append("text")
        .attr("x", xScale(lastScore.round) + 8)
        .attr("y", yScale(lastScore.score))
        .attr("dy", "0.35em")
        .attr("font-size", "10px")
        .attr("font-family", "var(--font-fira-code)")
        .attr("font-weight", "500")
        .attr("fill", color)
        .text(trajectory.shortName);
    });
  }, [trajectories]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-full"
    >
      <svg ref={svgRef} className="w-full" height={240} />
    </motion.div>
  );
}
