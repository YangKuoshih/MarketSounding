"use client";

import { useState, Fragment } from "react";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ReactionData } from "@/lib/api-client";

interface DealerTableProps {
  reactions: ReactionData[];
}

const DEALER_NAMES: Record<string, string> = {
  gs: "Goldman Sachs",
  jpm: "JP Morgan",
  ms: "Morgan Stanley",
  citi: "Citi",
  bofa: "Bank of America",
};

export function DealerTable({ reactions }: DealerTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Dealer
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Rate Path
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              H/D Score
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Confidence
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Shift
            </th>
          </tr>
        </thead>
        <tbody>
          {reactions.map((reaction) => {
            const isExpanded = expandedRow === reaction.personaId;
            const shiftIcon =
              reaction.positionShift === null ? (
                <Minus className="h-3 w-3 text-muted-foreground" />
              ) : reaction.positionShift > 0 ? (
                <TrendingUp className="h-3 w-3 text-hawkish" />
              ) : reaction.positionShift < 0 ? (
                <TrendingDown className="h-3 w-3 text-dovish" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              );

            return (
              <Fragment key={reaction.personaId}>
                <tr
                  className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedRow(isExpanded ? null : reaction.personaId)
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {DEALER_NAMES[reaction.personaId] || reaction.personaId}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {reaction.ratePathView}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span
                      className={
                        reaction.hawkishDovishScore > 0
                          ? "text-hawkish"
                          : reaction.hawkishDovishScore < 0
                            ? "text-dovish"
                            : "text-muted-foreground"
                      }
                    >
                      {reaction.hawkishDovishScore > 0 ? "+" : ""}
                      {reaction.hawkishDovishScore.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {(reaction.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {shiftIcon}
                      {reaction.positionShift !== null && (
                        <span className="font-mono text-xs">
                          {reaction.positionShift > 0 ? "+" : ""}
                          {reaction.positionShift.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded row */}
                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 bg-muted/20">
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="space-y-3"
                      >
                        {/* Views */}
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">
                              Balance Sheet:
                            </span>
                            <p className="mt-0.5">
                              {reaction.balanceSheetView}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Risk Assets:
                            </span>
                            <p className="mt-0.5">{reaction.riskAssetView}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Key Concerns:
                            </span>
                            <ul className="mt-0.5 list-disc list-inside">
                              {reaction.keyConcerns.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Reasoning */}
                        <div className="border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Reasoning
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {reaction.reasoningMd}
                          </p>
                        </div>

                        {/* Influence badges */}
                        {reaction.influencedBy.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Influenced by:
                            </span>
                            {reaction.influencedBy.map((id) => (
                              <span
                                key={id}
                                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {DEALER_NAMES[id] || id}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Key quote */}
                        {reaction.keyQuote && (
                          <blockquote className="border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground">
                            {reaction.keyQuote}
                          </blockquote>
                        )}
                      </motion.div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
