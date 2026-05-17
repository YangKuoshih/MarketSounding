"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Bot,
  User as UserIcon,
  Sparkles,
  MessagesSquare,
  Sun,
  Moon,
  ArrowLeft,
  Loader,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { api, ApiError, type ChatMessage } from "@/lib/api-client";

interface Message {
  id: string;
  role: "user" | "agent";
  agentId?: string;
  content: string;
  timestamp: number;
}

const dealers = [
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

const suggestedPrompts = [
  "What's your view on the next FOMC meeting?",
  "How would tariffs impact your rate path forecast?",
  "What's the biggest tail risk you're watching?",
  "Where do you stand on QT timing?",
];

export default function AgentChatPage() {
  const [selectedAgent, setSelectedAgent] = useState(dealers[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

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

    // Snapshot the conversation BEFORE adding the new user message,
    // so we can build the chat history sent to the backend
    const priorMessages = messages;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    const apiConfigured = !!process.env.NEXT_PUBLIC_API_URL;

    if (!apiConfigured) {
      // Fallback to mock response when no backend is wired
      setTimeout(() => {
        const agentMsg: Message = {
          id: `a-${Date.now()}`,
          role: "agent",
          agentId: selectedAgent.id,
          content: generateMockResponse(selectedAgent, text),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsThinking(false);
      }, 1200 + Math.random() * 800);
      return;
    }

    // Real backend call
    try {
      // Build the message history for the API:
      // - Include only user/assistant messages (skip the agent intro at index 0)
      // - Skip the initial intro message (first agent message has no user prompt)
      const apiMessages: ChatMessage[] = priorMessages
        .slice(1) // skip intro
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));
      apiMessages.push({ role: "user", content: text.trim() });

      const result = await api.chat.send(selectedAgent.id, apiMessages);
      const agentMsg: Message = {
        id: `a-${Date.now()}`,
        role: "agent",
        agentId: selectedAgent.id,
        content: result.reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, agentMsg]);
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
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm font-semibold">
                Agent Chat
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
          <div className="border-b border-border p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Select Dealer
            </p>
            <p className="text-xs text-muted-foreground">
              Each agent maintains a distinct house view.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {dealers.map((dealer) => {
              const isActive = selectedAgent.id === dealer.id;
              return (
                <button
                  key={dealer.id}
                  onClick={() => selectAgent(dealer)}
                  className={`flex w-full items-center gap-3 rounded-md p-3 text-left cursor-pointer transition-colors ${
                    isActive
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0"
                    style={{ borderColor: dealer.color }}
                  >
                    <span className="font-mono text-[10px] font-semibold">
                      {dealer.short}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {dealer.name}
                      </span>
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: dealer.color }}
                      >
                        {dealer.bias > 0 ? "+" : ""}
                        {dealer.bias.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {dealer.bias > 0.2
                        ? "Hawkish"
                        : dealer.bias < -0.1
                          ? "Dovish"
                          : "Neutral"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span>5 / 5 Agents Online</span>
            </div>
          </div>
        </aside>

        {/* Chat panel */}
        <div className="flex flex-1 flex-col">
          {/* Active agent header */}
          <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border-2"
              style={{ borderColor: selectedAgent.color }}
            >
              <span className="font-mono text-xs font-semibold">
                {selectedAgent.short}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold">{selectedAgent.name}</h2>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                Bias{" "}
                <span style={{ color: selectedAgent.color }}>
                  {selectedAgent.bias > 0 ? "+" : ""}
                  {selectedAgent.bias.toFixed(2)}
                </span>{" "}
                {selectedAgent.bias > 0.2
                  ? " - Hawkish"
                  : selectedAgent.bias < -0.1
                    ? " - Dovish"
                    : " - Neutral"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-success">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Online
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <EmptyChat agent={selectedAgent} onSelect={(p) => send(p)} prompts={suggestedPrompts} />
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
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0"
                      style={{ borderColor: selectedAgent.color }}
                    >
                      <Loader className="h-3 w-3 animate-spin" />
                    </div>
                    <span className="font-mono text-xs uppercase tracking-wider">
                      {selectedAgent.short} is thinking...
                    </span>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card px-6 py-4">
            <form
              onSubmit={handleSubmit}
              className="mx-auto flex max-w-2xl gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${selectedAgent.short} about markets, rates, risks...`}
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
              Simulated views -- not actual dealer commentary
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
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2"
        style={{ borderColor: agent.color }}
      >
        <span className="font-mono text-sm font-semibold">{agent.short}</span>
      </div>
      <h2 className="text-xl font-semibold">Talk to {agent.name}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        {agent.intro}
      </p>
      <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
        {prompts.map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            onClick={() => onSelect(p)}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm hover:border-primary/40 hover:bg-card/80 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground">{p}</span>
          </motion.button>
        ))}
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
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: agent.color }}
        >
          <span className="font-mono text-[10px] font-semibold">
            {agent.short}
          </span>
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}

function generateMockResponse(agent: (typeof dealers)[0], _input: string): string {
  const responses: Record<string, string[]> = {
    gs: [
      "Our models suggest the lagged effects of monetary policy are still working through the system. Forward-looking indicators are softening faster than headline prints suggest, which supports our view that the next move is a cut, not a hike.",
      "Probabilistically, we'd assign 40% to a cut at the next meeting, conditional on the labor data. Our GS Financial Conditions Index is signaling that policy is restrictive enough.",
    ],
    jpm: [
      "We take a more balanced view than consensus. Wage growth above 4% is inconsistent with the 2% target -- the labor market remains tight by historical standards. Our base case is hold through Q3.",
      "We need clear evidence of labor market weakening before we move. JOLTS quits rate and payrolls breadth are the indicators we're watching most closely.",
    ],
    ms: [
      "Our scenario analysis assigns 25% probability to an additional rate hike if core PCE stays above 2.8%. Financial conditions have eased meaningfully -- this is counterproductive to the Fed's objectives.",
      "We're more hawkish than consensus. Tail risks from sticky shelter inflation and re-acceleration in services are not priced into the curve.",
    ],
    citi: [
      "Recession risks are materially underpriced. Initial claims trending higher, ISM services contracting, and consumer confidence falling all point to an economy that needs rate relief sooner.",
      "Three cuts by year-end is our base case. The data prints support our view that the economy is slowing faster than the Fed acknowledges.",
    ],
    bofa: [
      "Our proprietary card spending data shows no signs of the slowdown others are forecasting. The savings drawdown narrative is overstated when you account for asset appreciation.",
      "One cut maximum in 2026, and even that is data-dependent. Consumer resilience is the dominant factor in our view -- the economy is running hotter than headline indicators suggest.",
    ],
  };

  const pool = responses[agent.id] || responses.gs;
  return pool[Math.floor(Math.random() * pool.length)];
}
