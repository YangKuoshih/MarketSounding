"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { api, setToken } from "@/lib/api-client";

const features = [
  "5 AI dealer agents with distinct house views",
  "Multi-round debate with convergence detection",
  "Crisis injection mid-simulation",
  "Knowledge graph of dealer influence",
  "Jarrett — AI market intelligence chat",
];

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      setError("Username must be 3-50 characters, alphanumeric and underscore only");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.register(username, password);
      if (result.success && result.token) {
        setToken(result.token);
        router.push("/console");
      } else {
        setError(result.error || "Registration failed");
      }
    } catch {
      setError("Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-card border-r border-border p-12">
        <Link href="/" className="flex items-center gap-3 cursor-pointer">
          <Image src="/logo.png" alt="MarketBuzz" width={36} height={36} className="rounded" />
          <span className="font-mono text-base font-semibold tracking-tight">
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
              What you get
            </p>
            <h2 className="text-3xl font-bold tracking-tight leading-snug mb-8">
              Market intelligence,<br />
              <span className="text-primary">agent-powered.</span>
            </h2>
            <ul className="space-y-3">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.07 }}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                    ✓
                  </span>
                  {f}
                </motion.li>
              ))}
            </ul>
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
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Image src="/logo.png" alt="MarketBuzz" width={28} height={28} className="rounded" />
            <span className="font-mono text-sm font-semibold">
              <span className="text-foreground">Market</span><span className="text-primary">Buzz</span>
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Get started with the console in seconds
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
                placeholder="3–50 chars, alphanumeric + underscore"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                placeholder="Minimum 8 characters"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              <UserPlus className="h-4 w-4" />
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
