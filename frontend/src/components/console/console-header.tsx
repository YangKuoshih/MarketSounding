"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  LogOut,
  Settings,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { motion, AnimatePresence } from "motion/react";
import { clearToken } from "@/lib/api-client";

const navItems = [
  { href: "/console", label: "Dashboard", icon: LayoutDashboard },
  { href: "/console/sounding/new", label: "New Simulation", icon: Plus },
  { href: "/chat", label: "Jarrett", icon: MessagesSquare },
  { href: "/console/graph", label: "Knowledge Graph", icon: Network },
  { href: "/console/history", label: "History", icon: Clock },
];

export function ConsoleHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("ms-token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUsername(payload.username ?? null);
      } catch {
        // malformed token — ignore
      }
    }
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleSignOut() {
    clearToken();
    router.push("/auth/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Logo + Status */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <Image
              src="/logo.png"
              alt="MarketBuzz"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="font-mono text-sm font-semibold tracking-tight">
              <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
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

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 cursor-pointer transition-colors ${
                menuOpen
                  ? "border-primary/40 bg-primary/10"
                  : "border-border hover:bg-muted"
              }`}
              aria-label="User menu"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
                <User className="h-3 w-3 text-primary" />
              </div>
              {username && (
                <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate">
                  {username}
                </span>
              )}
              <ChevronDown
                className={`h-3 w-3 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-50"
                >
                  {/* Account info */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {username ?? "Analyst"}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                          Console Access
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      href="/console"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/console/history"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      My Simulations
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">soon</span>
                    </button>
                  </div>

                  {/* Sign out */}
                  <div className="border-t border-border py-1">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
