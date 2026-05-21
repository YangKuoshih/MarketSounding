"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { motion } from "motion/react";
import { api, setToken } from "@/lib/api-client";

const dealers = ["GS", "JPM", "MS", "Citi", "BofA"];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/console";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.auth.login(username, password);
      if (result.success && result.token) {
        setToken(result.token);
        router.push(next);
      } else {
        setError(result.error || "Invalid credentials");
      }
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-card border-r border-border p-12">
        <Link href="/" className="flex items-center gap-3 cursor-pointer">
          <Image src="/logo.png" alt="MarketBuzz" width={52} height={52} className="rounded-lg" />
          <span className="font-mono text-xl font-semibold tracking-tight">
            <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
          </span>
        </Link>

        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Multi-Agent Market Intelligence
            </p>
            <h2 className="text-3xl font-bold tracking-tight leading-snug mb-6">
              Watch five dealer desks<br />
              debate in real time.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              MarketBuzz simulates how primary dealers react to market events —
              consensus forming, dissent emerging, and crises shifting positions
              across multiple AI-powered rounds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-10 flex flex-wrap gap-2"
          >
            {dealers.map((d) => (
              <span
                key={d}
                className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-mono text-muted-foreground"
              >
                {d}
              </span>
            ))}
          </motion.div>
        </div>

        <p className="text-[10px] font-mono text-muted-foreground/60">
          Simulated views — not actual dealer commentary
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Image src="/logo.png" alt="MarketBuzz" width={44} height={44} className="rounded-lg" />
            <span className="font-mono text-xl font-semibold">
              <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to access the console
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={3}
                maxLength={50}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={8}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer mt-2"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/auth/register" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
