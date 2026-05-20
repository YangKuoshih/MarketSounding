"use client";

import { useEffect, useRef } from "react";
import type { Options } from "highcharts";

export interface ChartSpec {
  type: "bar" | "line" | "column";
  title: string;
  xAxis: string[];
  series: { name: string; data: number[] }[];
}

export function parseChartSpec(text: string): { prose: string; chart: ChartSpec | null } {
  const match = text.match(/```chart\s*([\s\S]*?)```/);
  if (!match) return { prose: text, chart: null };
  const prose = text.replace(/```chart[\s\S]*?```/, "").trim();
  try {
    const chart = JSON.parse(match[1].trim()) as ChartSpec;
    return { prose, chart };
  } catch {
    return { prose: text, chart: null };
  }
}

export function ChatChart({ spec }: { spec: ChartSpec }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let chart: Highcharts.Chart | null = null;
    import("highcharts").then((Highcharts) => {
      if (!containerRef.current) return;
      const options: Options = {
        chart: { type: spec.type, backgroundColor: "transparent", height: 220 },
        title: { text: spec.title, style: { fontSize: "11px", fontWeight: "600", color: "var(--foreground)" } },
        xAxis: { categories: spec.xAxis, labels: { style: { fontSize: "10px", color: "var(--muted-foreground)" } } },
        yAxis: { title: { text: null }, labels: { style: { fontSize: "10px", color: "var(--muted-foreground)" } }, gridLineColor: "var(--border)" },
        legend: { itemStyle: { fontSize: "10px", color: "var(--foreground)" } },
        series: spec.series.map((s) => ({ type: spec.type as "bar" | "line" | "column", name: s.name, data: s.data })),
        credits: { enabled: false },
        plotOptions: { series: { animation: { duration: 400 } } },
        colors: ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"],
      };
      chart = Highcharts.default.chart(containerRef.current!, options);
    });
    return () => { chart?.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-3 overflow-hidden">
      <div ref={containerRef} />
    </div>
  );
}
