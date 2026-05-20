"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Zap, Minimize2, MessageSquare } from "lucide-react";
import { JarrettAvatar } from "./jarrett-avatar";
import { api, type ChatMessage } from "@/lib/api-client";

interface Message {
  id: string;
  role: "user" | "jarrett";
  content: string;
}

// Per-route context injected as system context into Jarrett's first message
function getPageContext(pathname: string): { label: string; context: string; intro: string } {
  if (pathname === "/console") {
    return {
      label: "Dashboard",
      context: "The user is on the MarketBuzz Console Dashboard. They can search for a market topic to start a simulation, or pick a sample event. The system runs 5 primary dealer AI agents (GS, JPM, MS, Citi, BofA) through multi-round debates.",
      intro: "I'm Jarrett, your market intelligence guide. You're on the **Dashboard** — enter any market topic to run a dealer roundtable, or pick a sample to see how it works. What can I help you with?",
    };
  }
  if (pathname.startsWith("/console/sounding/new")) {
    return {
      label: "New Sounding",
      context: "The user is creating a new sounding. They need to enter a market topic or event for the 5 dealer agents to debate.",
      intro: "You're setting up a new sounding. Try topics like 'FOMC rate decision', 'China tariff escalation', or 'oil supply shock'. The more specific, the richer the debate. What's on your mind?",
    };
  }
  if (pathname.startsWith("/console/sounding/")) {
    return {
      label: "Simulation",
      context: "The user is viewing a live or completed simulation showing how 5 dealer agents (GS, JPM, MS, Citi, BofA) debated a market event across multiple rounds. Results include an H/D spectrum, position evolution chart, dealer table, and discussion transcript.",
      intro: "You're in a simulation view. I can help you interpret the **H/D spectrum**, explain why dealers shifted positions, or summarise the discussion transcript. What do you want to understand?",
    };
  }
  if (pathname.startsWith("/console/graph")) {
    return {
      label: "Knowledge Graph",
      context: "The user is viewing the Knowledge Graph — a force-directed graph showing dealer nodes, topic nodes, concern nodes, and crisis nodes, connected by influence, topic participation, concern, correlation, and crisis edges.",
      intro: "You're on the **Knowledge Graph**. I can explain what the nodes and edges mean, identify which dealers cluster around topics, or highlight influence patterns. What do you want to explore?",
    };
  }
  if (pathname.startsWith("/console/history")) {
    return {
      label: "History",
      context: "The user is on the Simulation History page, showing a list of past simulations with their status, rounds, consensus score, and trajectory.",
      intro: "This is your **Simulation History**. I can help you compare simulations, explain consensus scores, or guide you to find a specific past event. What are you looking for?",
    };
  }
  if (pathname.startsWith("/about")) {
    return {
      label: "About",
      context: "The user is on the About page which explains the MarketBuzz system, its 5 dealer personas (GS, JPM, MS, Citi, BofA), tech stack, and mission.",
      intro: "Welcome — you're exploring the **About** page. I can tell you more about how the dealer personas are calibrated, how the multi-round protocol works, or how to get started. What's your question?",
    };
  }
  if (pathname === "/" || pathname.startsWith("/#")) {
    return {
      label: "Home",
      context: "The user is on the MarketBuzz home page, learning about the product.",
      intro: "Hi, I'm **Jarrett** — MarketBuzz's market intelligence guide. I can explain how the system works, walk you through what a simulation looks like, or help you get started. What do you want to know?",
    };
  }
  return {
    label: "MarketBuzz",
    context: "The user is using MarketBuzz, a multi-agent market reaction simulator.",
    intro: "Hi, I'm **Jarrett** — ask me anything about MarketBuzz, the dealer agents, or how to interpret results.",
  };
}

function renderContent(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="text-muted-foreground text-[10px]">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function JarrettWidget() {
  const pathname = usePathname();

  // Hide on auth pages and the dedicated /chat page
  const hidden =
    pathname.startsWith("/auth/") || pathname.startsWith("/chat");

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [currentPage, setCurrentPage] = useState(pathname);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Re-seed context message when route changes
  useEffect(() => {
    if (pathname !== currentPage) {
      setCurrentPage(pathname);
      if (open) {
        const { intro } = getPageContext(pathname);
        setMessages((prev) => [
          ...prev,
          {
            id: `nav-${Date.now()}`,
            role: "jarrett",
            content: `*(Navigated to ${getPageContext(pathname).label})* ${intro}`,
          },
        ]);
      } else {
        // reset so next open gets fresh intro for new page
        setInitialized(false);
      }
    }
  }, [pathname, currentPage, open]);

  // Seed intro on first open
  useEffect(() => {
    if (open && !initialized) {
      const { intro } = getPageContext(pathname);
      setMessages([{ id: "intro", role: "jarrett", content: intro }]);
      setInitialized(true);
    }
  }, [open, initialized, pathname]);

  // Auto-scroll after user sends (not on intro)
  useEffect(() => {
    if (messages.some((m) => m.role === "user")) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text },
    ]);
    setInput("");
    setSending(true);

    try {
      const { context } = getPageContext(pathname);
      const history: ChatMessage[] = messages
        .filter((m) => m.role === "user")
        .map((m) => ({ role: "user", content: m.content }));

      const fullMessage = `PAGE CONTEXT: ${context}\n\nUser question: ${text}`;
      const apiMessages: ChatMessage[] = [
        ...history,
        { role: "user", content: fullMessage },
      ];

      const result = await api.chat.send("jarrett", apiMessages);
      setMessages((prev) => [
        ...prev,
        { id: `j-${Date.now()}`, role: "jarrett", content: result.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `j-err-${Date.now()}`,
          role: "jarrett",
          content: "I couldn't reach the API right now. Try again in a moment.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (hidden) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      <AnimatePresence>
        {open && !minimized && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
            style={{ height: 460 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0 bg-card">
              <div className="flex items-center gap-2">
                <div className="relative shrink-0" style={{ width: 28, height: 28 }}>
                  <JarrettAvatar size={28} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                    <Zap className="h-1.5 w-1.5 text-primary-foreground" />
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">Jarrett</p>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                    {getPageContext(pathname).label}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(true)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted cursor-pointer text-muted-foreground"
                >
                  <Minimize2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted cursor-pointer text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {msg.role === "jarrett" && (
                    <div className="shrink-0 mt-0.5">
                      <JarrettAvatar size={20} />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-xs leading-relaxed max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-2 items-start">
                  <div className="shrink-0 mt-0.5">
                    <JarrettAvatar size={20} />
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2">
                    <div className="flex gap-1 items-center h-4">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts before first user message */}
            {!messages.some((m) => m.role === "user") && (
              <div className="px-4 pb-3 flex flex-wrap gap-1.5 shrink-0">
                {getSuggestedPrompts(pathname).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-border px-3 py-3 shrink-0"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Jarrett anything…"
                className="flex-1 bg-transparent text-xs placeholder:text-muted-foreground focus:outline-none"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB toggle button */}
      <motion.button
        onClick={() => {
          if (open && !minimized) {
            setOpen(false);
          } else {
            setOpen(true);
            setMinimized(false);
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg hover:bg-primary/90 transition-colors cursor-pointer"
        aria-label="Ask Jarrett"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open && !minimized ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-5 w-5 text-primary-foreground" />
            </motion.div>
          ) : (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <JarrettAvatar size={32} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread dot when closed */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success border-2 border-background">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          </span>
        )}
      </motion.button>

      {/* Minimized pill */}
      <AnimatePresence>
        {open && minimized && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            onClick={() => setMinimized(false)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <JarrettAvatar size={20} className="shrink-0" />
            <span className="text-xs font-medium">Jarrett</span>
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function getSuggestedPrompts(pathname: string): string[] {
  if (pathname === "/console") {
    return ["How does a simulation work?", "What dealers are included?", "Show me a sample topic"];
  }
  if (pathname.startsWith("/console/sounding/") && !pathname.includes("new")) {
    return ["Explain the H/D spectrum", "Why did dealers shift?", "Who is the anchor dealer?"];
  }
  if (pathname.startsWith("/console/graph")) {
    return ["Explain the influence edges", "Which dealers share concerns?", "What does consensus score mean?"];
  }
  if (pathname.startsWith("/console/history")) {
    return ["What is a consensus score?", "How do I re-run a simulation?"];
  }
  if (pathname.startsWith("/about")) {
    return ["How are personas calibrated?", "What is the roundtable protocol?"];
  }
  return ["How does MarketBuzz work?", "What is Jarrett?", "How do I get started?"];
}
