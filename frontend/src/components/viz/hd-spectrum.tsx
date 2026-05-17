"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { motion } from "motion/react";

interface DealerPosition {
  personaId: string;
  shortName: string;
  hawkishDovishScore: number;
}

interface HDSpectrumProps {
  dealers: DealerPosition[];
}

export function HDSpectrum({ dealers }: HDSpectrumProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || dealers.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth;
    const height = 80;
    const margin = { left: 40, right: 40 };

    const xScale = d3
      .scaleLinear()
      .domain([-1, 1])
      .range([margin.left, width - margin.right]);

    // Gradient background strip
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", "hd-gradient")
      .attr("x1", "0%")
      .attr("x2", "100%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "var(--dovish)");
    gradient
      .append("stop")
      .attr("offset", "50%")
      .attr("stop-color", "var(--muted-foreground)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "var(--hawkish)");

    // Strip background
    svg
      .append("rect")
      .attr("x", margin.left)
      .attr("y", 30)
      .attr("width", width - margin.left - margin.right)
      .attr("height", 8)
      .attr("rx", 4)
      .attr("fill", "url(#hd-gradient)")
      .attr("opacity", 0.3);

    // Center line
    svg
      .append("line")
      .attr("x1", xScale(0))
      .attr("x2", xScale(0))
      .attr("y1", 24)
      .attr("y2", 44)
      .attr("stroke", "var(--muted-foreground)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2");

    // Labels
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 68)
      .attr("fill", "var(--dovish)")
      .attr("font-size", "10px")
      .attr("font-family", "var(--font-fira-code)")
      .text("Dovish");

    svg
      .append("text")
      .attr("x", width - margin.right)
      .attr("y", 68)
      .attr("text-anchor", "end")
      .attr("fill", "var(--hawkish)")
      .attr("font-size", "10px")
      .attr("font-family", "var(--font-fira-code)")
      .text("Hawkish");

    // Dealer markers
    const markers = svg
      .selectAll(".dealer-marker")
      .data(dealers)
      .enter()
      .append("g")
      .attr("class", "dealer-marker")
      .attr("transform", (d) => `translate(${xScale(d.hawkishDovishScore)}, 34)`);

    markers
      .append("circle")
      .attr("r", 14)
      .attr("fill", "var(--card)")
      .attr("stroke", (d) =>
        d.hawkishDovishScore > 0 ? "var(--hawkish)" : "var(--dovish)",
      )
      .attr("stroke-width", 2);

    markers
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("font-family", "var(--font-fira-code)")
      .attr("fill", "var(--foreground)")
      .text((d) => d.shortName);
  }, [dealers]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full"
    >
      <svg ref={svgRef} className="w-full" height={80} />
    </motion.div>
  );
}
