"use client";

import { type ReactNode } from "react";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
