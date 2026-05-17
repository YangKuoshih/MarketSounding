"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  Network,
  Clock,
  MessagesSquare,
  Sun,
  Moon,
  User,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { motion, AnimatePresence } from "motion/react";

const navItems = [
  { href: "/console", label: "Dashboard", icon: LayoutDashboard },
  { href: "/console/sounding/new", label: "New Sounding", icon: Plus },
  { href: "/chat", label: "Agent Chat", icon: MessagesSquare },
  { href: "/console/graph", label: "Knowledge Graph", icon: Network },
  { href: "/console/history", label: "History", icon: Clock },
];

export function ConsoleHeader() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Logo + Status */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
              <span className="font-mono text-xs font-bold text-primary-foreground">
                MS
              </span>
            </div>
            <span className="font-mono text-sm font-semibold tracking-tight">
              MarketSounding
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span>System Ready</span>
          </div>
        </div>

        {/* Center nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/console"
                ? pathname === "/console"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted cursor-pointer transition-colors"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {resolvedTheme === "dark" ? (
                <motion.div
                  key="moon"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="sun"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <button
            className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 hover:bg-muted cursor-pointer transition-colors"
            aria-label="User menu"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}
