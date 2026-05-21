"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  User as UserIcon,
  Sparkles,
  Sun,
  Moon,
  ArrowLeft,
  Loader,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { JarrettAvatar } from "@/components/jarrett-avatar";
import { api, ApiError, type ChatMessage } from "@/lib/api-client";
import { parseChartSpec, ChatChart } from "@/components/chat-chart";
import { parseSimulationSpec, SimLaunchCard } from "@/components/chat-simulation";
import { parseGraphQuerySpec } from "@/components/chat-graph-query";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "agent";
  agentId?: string;
  content: string;
  timestamp: number;
}

const dealers = [
  {
    id: "jarrett",
    short: "JAR",
    name: "Jarrett (All Desks)",
    bias: 0,
    color: "var(--primary)",
    intro:
      "Jarrett here — your neutral market intelligence guide. Ask me about macro, rates, or say 'run a simulation on [topic]' to launch one directly from here.",
  },
  {
    id: "gs",
    short: "GS",
    name: "Goldman Sachs",
    bias: -0.2,
    color: "var(--dovish)",
    intro:
      "Goldman Sachs research desk. Data-driven, model-heavy. Lean toward forward-looking indicators over headline prints.",
  },
  {
    id: "jpm",
    short: "JPM",
    name: "JP Morgan",
    bias: 0.1,
    color: "var(--muted-foreground)",
    intro:
      "JP Morgan Markets. Labor-market focused, methodical, balanced view. Prefer waiting for clear signals.",
  },
  {
    id: "ms",
    short: "MS",
    name: "Morgan Stanley",
    bias: 0.5,
    color: "var(--hawkish)",
    intro:
      "Morgan Stanley research. Cautious, scenario-heavy, tail-risk framing. Track financial conditions closely.",
  },
  {
    id: "citi",
    short: "Citi",
    name: "Citi",
    bias: 0.0,
    color: "var(--muted-foreground)",
    intro:
      "Citi rates strategy. Print-focused, consensus-leaning, data-series-heavy.",
  },
  {
    id: "bofa",
    short: "BofA",
    name: "Bank of America",
    bias: 0.3,
    color: "var(--hawkish)",
    intro:
      "BofA Global Research. Consumer-spending-anchored, global macro overlay.",
  },
];

const suggestedPrompts: Record<string, string[]> = {
  jarrett: [
    "Run a simulation on FOMC June rate decision",
    "Simulate US-China tariff escalation with 4 rounds",
    "Launch a simulation on oil supply shock with crisis: OPEC emergency meeting",
    "What's the consensus view across the 5 dealers on rates right now?",
  ],
  default: [
    "What's your view on the next FOMC meeting?",
    "How would tariffs impact your rate path forecast?",
    "What's the biggest tail risk you're watching?",
    "Where do you stand on QT timing?",
  ],
};

export default function AgentChatPage() {
  return (
    <Suspense fallback={null}>
      <AgentChatContent />
    </Suspense>
  );
}

function AgentChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState(dealers[0]); // defaults to Jarrett
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentFromGraph = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Auto-send question from knowledge graph ?q= param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !sentFromGraph.current) {
      sentFromGraph.current = true;
      send(decodeURIComponent(q));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectAgent(agent: (typeof dealers)[0]) {
    setSelectedAgent(agent);
    setMessages([
      {
        id: `intro-${agent.id}-${Date.now()}`,
        role: "agent",
        agentId: agent.id,
        content: agent.intro,
        timestamp: Date.now(),
      },
    ]);
  }

  async function send(text: string) {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    const priorMessages = messages;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    try {
      const apiMessages: ChatMessage[] = priorMessages
        .slice(1)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));
      apiMessages.push({ role: "user", content: text.trim() });

      const result = await api.chat.send(selectedAgent.id, apiMessages);

      // Parse graph_query block if Jarrett returned one
      const { prose: replyAfterGraph, graphQuery } = parseGraphQuerySpec(result.reply);
      const displayReply = replyAfterGraph.trim() || result.reply;

      const agentMsg: Message = {
        id: `a-${Date.now()}`,
        role: "agent",
        agentId: selectedAgent.id,
        content: displayReply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Auto-navigate to graph page and fire the query event
      if (graphQuery && selectedAgent.id === "jarrett") {
        const detail = { spec: graphQuery, naturalLanguage: text.trim() };
        router.push("/console/graph");
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("jarrett:graph", { detail }));
        }, 800);
      }
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? `${selectedAgent.short} is unavailable (${err.status}: ${err.message})`
          : err instanceof Error
            ? `${selectedAgent.short} is unavailable: ${err.message}`
            : `${selectedAgent.short} is unavailable.`;
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: "agent",
        agentId: selectedAgent.id,
        content: errorMessage,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/console"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Console</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            {/* Jarrett branding in header */}
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shadow-sm">
                <JarrettAvatar size={28} />
              </div>
              <span className="font-mono text-sm font-semibold tracking-tight">
                Jarrett
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-primary">
                <Zap className="h-2.5 w-2.5" />
                AI Market Intelligence
              </span>
            </div>
          </div>
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
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
        </div>
      </header>

      {/* Main chat area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Agent picker sidebar */}
        <aside className="hidden md:flex w-72 flex-col border-r border-border bg-card">
          {/* Jarrett sidebar identity */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shadow-md ring-2 ring-primary/20">
                <JarrettAvatar size={40} />
              </div>
              <div>
                <p className="text-sm font-semibold">Jarrett</p>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Market Intelligence
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select a dealer voice. Jarrett channels each firm&apos;s house view
              to give you direct, perspective-driven market intelligence.
            </p>
          </div>

          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-1">
              Assistant
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {dealers.map((dealer, idx) => {
              const isActive = selectedAgent.id === dealer.id;
              const isJarrett = dealer.id === "jarrett";
              return (
                <div key={dealer.id}>
                  {idx === 1 && (
                    <div className="px-1 pt-3 pb-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        Dealer Voices
                      </p>
                    </div>
                  )}
                <button
                  onClick={() => selectAgent(dealer)}
                  className={`flex w-full items-center gap-3 rounded-md p-3 text-left cursor-pointer transition-colors ${
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  } ${isJarrett ? "border border-primary/20" : ""}`}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0"
                    style={{ borderColor: dealer.color }}
                  >
                    {isJarrett ? (
                      <JarrettAvatar size={22} />
                    ) : (
                      <span className="font-mono text-[10px] font-semibold">
                        {dealer.short}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">
                        {dealer.name}
                      </span>
                      {!isJarrett && (
                        <span
                          className="font-mono text-[10px] shrink-0"
                          style={{ color: dealer.color }}
                        >
                          {dealer.bias > 0 ? "+" : ""}
                          {dealer.bias.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {isJarrett
                        ? "Neutral · Launch simulations"
                        : dealer.bias > 0.2
                          ? "Hawkish"
                          : dealer.bias < -0.1
                            ? "Dovish"
                            : "Neutral"}
                    </p>
                  </div>
                </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span>Jarrett · 5 Dealers Available</span>
            </div>
          </div>
        </aside>

        {/* Chat panel */}
        <div className="flex flex-1 flex-col">
          {/* Active agent header */}
          <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
            {/* Jarrett avatar + active dealer */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary ring-2 ring-primary/20 shadow-sm">
                <JarrettAvatar size={20} />
              </div>
              <span className="text-xs font-mono text-muted-foreground hidden sm:block">via</span>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border-2"
              style={{ borderColor: selectedAgent.color }}
            >
              <span className="font-mono text-xs font-semibold">
                {selectedAgent.short}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">
                Jarrett{" "}
                <span className="text-muted-foreground font-normal">·</span>{" "}
                {selectedAgent.name}
              </h2>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Bias{" "}
                <span style={{ color: selectedAgent.color }}>
                  {selectedAgent.bias > 0 ? "+" : ""}
                  {selectedAgent.bias.toFixed(2)}
                </span>{" "}
                {selectedAgent.bias > 0.2
                  ? " · Hawkish"
                  : selectedAgent.bias < -0.1
                    ? " · Dovish"
                    : " · Neutral"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-success">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Online
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
            {!messages.some((m) => m.role === "user") ? (
              <EmptyChat agent={selectedAgent} onSelect={(p) => send(p)} prompts={suggestedPrompts[selectedAgent.id] ?? suggestedPrompts.default} />
            ) : (
              <div className="mx-auto max-w-2xl space-y-6">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} agent={selectedAgent} />
                ))}
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <Loader className="h-3 w-3 animate-spin text-primary" />
                    </div>
                    <span className="font-mono text-xs uppercase tracking-wider">
                      Jarrett · {selectedAgent.short} is thinking...
                    </span>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card px-6 py-4">
            <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedAgent.id === "jarrett"
                    ? `Ask Jarrett about markets, or say "run a simulation on [topic]"…`
                    : `Ask Jarrett via ${selectedAgent.short} about markets, rates, risks...`
                }
                disabled={isThinking}
                className="flex-1 rounded-md border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
            <p className="mx-auto mt-2 max-w-2xl text-[10px] text-muted-foreground font-mono">
              Jarrett · Simulated views — not actual dealer commentary
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChat({
  agent,
  prompts,
  onSelect,
}: {
  agent: (typeof dealers)[0];
  prompts: string[];
  onSelect: (p: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto flex max-w-2xl flex-col items-center justify-center text-center py-12"
    >
      {/* Jarrett avatar */}
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-primary/20">
          <JarrettAvatar size={52} />
        </div>
        {/* Dealer badge overlaid */}
        <div
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card text-[9px] font-mono font-bold"
          style={{ borderColor: agent.color }}
        >
          {agent.short}
        </div>
      </div>

      <h2 className="text-2xl font-bold">
        Jarrett
      </h2>
      <p className="mt-1 text-sm font-mono uppercase tracking-widest text-muted-foreground">
        AI Market Intelligence
      </p>
      <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
        Currently channeling{" "}
        <span className="font-medium text-foreground">{agent.name}</span>.{" "}
        {agent.intro}
      </p>

      <div className="mt-8 w-full">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Suggested Questions
        </p>
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
          {prompts.map((p, i) => (
            <motion.button
              key={p}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              onClick={() => onSelect(p)}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-foreground">{p}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({
  message,
  agent,
}: {
  message: Message;
  agent: (typeof dealers)[0];
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm ring-1 ring-primary/20">
          <JarrettAvatar size={18} />
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[70%]">
        {!isUser && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pl-1">
            Jarrett · {agent.short}
          </span>
        )}
        <div
          className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (() => {
            // Parse simulate block first, then chart block from remaining prose
            const { prose: proseAfterSim, sim } = parseSimulationSpec(message.content);
            const { prose, chart } = parseChartSpec(proseAfterSim);
            return (
              <>
                <p className="whitespace-pre-wrap">{prose}</p>
                {chart && <ChatChart spec={chart} />}
                {sim && <SimLaunchCard sim={sim} />}
              </>
            );
          })()}
        </div>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}

