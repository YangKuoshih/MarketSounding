"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ values, width = 80, height = 24 }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || values.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const padding = 2;
    const x = d3
      .scaleLinear()
      .domain([0, values.length - 1])
      .range([padding, width - padding]);

    const y = d3
      .scaleLinear()
      .domain([-1, 1])
      .range([height - padding, padding]);

    const line = d3
      .line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    // Center reference line
    svg
      .append("line")
      .attr("x1", padding)
      .attr("x2", width - padding)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "var(--border)")
      .attr("stroke-dasharray", "1,2");

    // Trajectory
    const finalScore = values[values.length - 1];
    const color =
      finalScore > 0
        ? "var(--hawkish)"
        : finalScore < 0
          ? "var(--dovish)"
          : "var(--muted-foreground)";

    svg
      .append("path")
      .datum(values)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("d", line);

    // End dot
    svg
      .append("circle")
      .attr("cx", x(values.length - 1))
      .attr("cy", y(finalScore))
      .attr("r", 2)
      .attr("fill", color);
  }, [values, width, height]);

  return <svg ref={svgRef} width={width} height={height} />;
}
