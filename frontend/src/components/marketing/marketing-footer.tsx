import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
                <span className="font-mono text-xs font-bold text-primary-foreground">
                  MB
                </span>
              </div>
              <span className="font-mono text-sm font-semibold">
                MarketBuzz
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Multi-agent market reaction simulator for primary dealer roundtables.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/console"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Console
                </Link>
              </li>
              <li>
                <Link
                  href="/chat"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Agent Chat
                </Link>
              </li>
              <li>
                <Link
                  href="/console/graph"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Knowledge Graph
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Company
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-muted-foreground hover:text-foreground"
                >
                  About
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
              Built On
            </h4>
            <ul className="space-y-2 text-sm">
              <li className="text-muted-foreground">AWS Bedrock</li>
              <li className="text-muted-foreground">Claude Sonnet 4.6</li>
              <li className="text-muted-foreground">AgentCore</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-border pt-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span className="font-mono">
              Simulated views -- not actual dealer commentary
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            (c) 2026 MarketBuzz -- v0.1.0
          </p>
        </div>
      </div>
    </footer>
  );
}
