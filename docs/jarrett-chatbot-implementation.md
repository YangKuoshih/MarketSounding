# Implementing a Context-Aware AI Chat Assistant (Jarrett Pattern)

A complete guide to building a floating, route-aware AI chat widget backed by a multi-model Lambda, with agentic tool dispatch — extracted from the MarketBuzz implementation.

---

## What This Pattern Delivers

- A persistent FAB (floating action button) chat widget that follows the user across all pages
- Route-aware context: the assistant knows what page the user is on and adapts its intro and suggested prompts automatically
- Live data injection: the assistant fetches real app data before answering so responses are grounded
- Agentic dispatch: the AI can take actions in the app (launch a simulation, query a graph, navigate) by emitting structured JSON blocks inside its reply
- Multi-model routing: a single `/chat/jarrett` endpoint delegates to a dealer-specific model when the user asks about a specific firm
- Minimized pill state so the widget never fully interrupts workflow

---

## Architecture Overview

```
User types message
       │
       ▼
JarrettWidget (client component)
  - reads current pathname
  - fetches live app data for current route
  - builds: PAGE CONTEXT + DATA CONTEXT + user message
       │
       ▼
POST /chat/jarrett  { messages: [{role, content}] }
       │
       ▼
chat-agent Lambda
  - detectDealerIntent() → route to dealer prompt OR Jarrett prompt
  - invoke Bedrock (Claude Haiku by default)
  - return { reply, personaId, model }
       │
       ▼
JarrettWidget parses reply
  - strip ```simulate``` block → dispatch CustomEvent → page handles launch
  - strip ```graph_query``` block → navigate + dispatch CustomEvent → graph handles query
  - display remaining prose to user
```

---

## Part 1: The Backend

### Lambda Handler (`backend/lambdas/chat-agent/index.ts`)

The Lambda accepts `POST /chat/{personaId}`. `personaId` is either `"jarrett"` (the neutral guide) or a specific dealer ID (`gs`, `jpm`, `ms`, `citi`, `bofa`).

```typescript
// Route: POST /chat/{personaId}
// Body:  { messages: [{role: "user"|"assistant", content: string}] }
// Returns: { reply: string, personaId: string, model: string }

export const handler = withAuth(async (event, _session) => {
  const personaId = event.pathParameters?.personaId;

  // Validate: accept "jarrett" or any known dealer ID
  if (personaId !== 'jarrett' && !isValidPersonaId(personaId)) {
    return notFound('Persona not found');
  }

  const { messages } = ChatRequestSchema.parse(JSON.parse(event.body));

  let systemPrompt: string;
  let respondingAs = personaId;

  if (personaId === 'jarrett') {
    // Multi-agent routing: if message is specifically about one dealer, delegate
    const delegateId = detectDealerIntent(messages[messages.length - 1].content);
    if (delegateId) {
      systemPrompt = buildDealerSystemPrompt(loadPersona(delegateId));
      respondingAs = delegateId;
    } else {
      systemPrompt = buildJarrettSystemPrompt();
    }
  } else {
    systemPrompt = buildDealerSystemPrompt(loadPersona(personaId));
  }

  const reply = await invokeChatModel(systemPrompt, messages);
  return success({ reply, personaId: respondingAs, model: CHAT_MODEL_ID });
});
```

**Key design decisions:**
- Use Haiku by default for chat (fast, cheap). Override via `CHAT_MODEL_ID` env var for higher quality when needed.
- Cap history at 40 messages and content at 4,000 chars each — prevents runaway token costs.
- Multi-agent routing is transparent to the frontend: `respondingAs` tells the client which persona actually answered.

### Intent-Based Routing (`detectDealerIntent`)

```typescript
function detectDealerIntent(userMessage: string): string | null {
  const dealerPatterns: Array<[string, RegExp]> = [
    ['gs', /\b(goldman\s*sachs|goldman|gs)\b/],
    ['jpm', /\b(jp\s*morgan|jpmorgan|jpm)\b/],
    ['ms', /\b(morgan\s*stanley|ms\b)/],
    ['citi', /\b(citi(group|bank)?)\b/],
    ['bofa', /\b(bank\s*of\s*america|bofa)\b/],
  ];

  const matches = dealerPatterns.filter(([, re]) => re.test(lower)).map(([id]) => id);

  // Only delegate when exactly ONE dealer is referenced
  if (matches.length !== 1) return null;

  // Don't delegate comparisons, app questions, or graph queries — Jarrett handles these
  const isComparison = /\b(compare|vs\.?|all dealers)\b/.test(lower);
  const isGraphQuery = /\b(shortest path|centrality|highlight|filter graph)\b/.test(lower);
  if (isComparison || isGraphQuery) return null;

  return matches[0];
}
```

**Adaptation note:** Replace dealer patterns with your own domain entities (e.g., product lines, regions, user personas). The key invariant is: delegate only when exactly one entity is unambiguously referenced AND the question is about that entity specifically.

### System Prompt: Jarrett (Neutral Guide)

The Jarrett system prompt has five sections:

1. **Identity and role** — who Jarrett is, what the app does, what Jarrett can and cannot answer
2. **Key metrics glossary** — definitions of every app-specific concept the user might ask about
3. **Entity profiles** — summaries of each domain entity (dealers) injected at prompt-build time
4. **Response rules** — how to handle each question type (specific entity, comparison, general, app question)
5. **Tool blocks** — structured output specs the frontend parses as actions

The tool block pattern is the most reusable part. Each tool is defined by a fenced code block format:

```
## SIMULATION TOOL — use ONLY when user explicitly asks to "run", "simulate", "launch":
Respond with 1-2 sentences, then append:
```simulate
{"topic":"<topic>","rounds":<3|4|5>,"crisis":"<text or null>"}
```
```

Never mix tool emission with ordinary prose — the condition ("ONLY when the user explicitly asks to...") prevents the AI from emitting actions unprompted.

### System Prompt: Dealer Persona

When routing to a specific dealer, the prompt changes character: instead of a neutral guide it adopts the firm's voice, framework, and analytical style. The key structural elements:

```typescript
function buildDealerSystemPrompt(persona): string {
  return `You are an AI assistant channeling the house view of ${persona.name}.

PERSONA PROFILE:
${persona.profileMd}   // injected from a markdown file per firm

SCOPE — ONLY answer questions about: [narrow domain list]

HARD LIMITS — immediately redirect if asked about: [off-limits topics]

VOICE — ${persona.name} house style:
${persona.voiceCharacteristics.map(v => `- ${v}`).join('\n')}

GUARDRAILS:
- Never invent specific numbers — use hedge language
- Never claim to represent the actual institution
- Keep responses to 2-3 short paragraphs
`;
}
```

**Adaptation note:** For non-financial contexts, replace `persona.profileMd` with any domain knowledge document. The guardrail pattern (scope → hard limits → voice → guardrails) transfers to any context where you want a focused, bounded persona.

### Bedrock Invocation

```typescript
async function invokeChatModel(systemPrompt, messages) {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    temperature: 0.7,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const command = new InvokeModelCommand({
    modelId: CHAT_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: Buffer.from(body),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content?.[0]?.text ?? '';
}
```

**Model selection guidance:**
- `claude-haiku-4-5-20251001` — use for chat (fast, low cost, quality sufficient for conversational Q&A)
- `claude-sonnet-4-6` — use if the assistant needs to reason over complex data or produce structured output reliably
- `claude-opus-4-7` — only for tasks where quality is the highest priority and latency is acceptable

---

## Part 2: The Frontend Widget

### File location

```
frontend/src/components/
  jarrett-widget.tsx     // main widget — FAB + chat window
  jarrett-avatar.tsx     // SVG avatar component
  chat-graph-query.tsx   // graph tool block parser + card UI
```

### State model

```typescript
const [open, setOpen] = useState(false);          // chat window visible
const [minimized, setMinimized] = useState(false); // collapsed to pill
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [sending, setSending] = useState(false);
const [initialized, setInitialized] = useState(false); // first open seeded?
const [currentPage, setCurrentPage] = useState(pathname);
```

Five states the widget can be in:
1. **Closed** — only FAB visible
2. **Open** — full chat window
3. **Minimized** — collapsed pill (user hid it temporarily)
4. **Sending** — waiting for API response, shows typing indicator
5. **Hidden** — `return null` on auth pages and dedicated chat pages

### Route-Aware Context (`getPageContext`)

This is the core of the "context-aware" behaviour. Every page has a `context` string (injected as a system prefix) and an `intro` message (displayed to the user on first open).

```typescript
function getPageContext(pathname: string): { label: string; context: string; intro: string } {
  if (pathname === "/console") {
    return {
      label: "Dashboard",
      context: "The user is on the Dashboard. They can search for a topic to start a simulation...",
      intro: "I'm Jarrett, your market intelligence guide. You're on the **Dashboard** — ...",
    };
  }
  if (pathname.startsWith("/console/sounding/new")) {
    return {
      label: "New Simulation",
      context: "The user is on the New Simulation page. When they tell you what to simulate, " +
               "output a simulate block immediately.",
      intro: "Tell me what you want to simulate and I'll launch it for you automatically.",
    };
  }
  // ... one branch per route
  return { label: "App", context: "Generic fallback context.", intro: "How can I help?" };
}
```

**How to adapt:** Add one branch per route in your app. The `context` string should tell the AI what the user can do on this page and any special behaviours (e.g., "output the simulate block immediately when the user provides a topic"). The `intro` is shown to the user — make it feel like the assistant is already oriented.

### Route Change Handling

```typescript
// Re-seed context when route changes
useEffect(() => {
  if (pathname !== currentPage) {
    setCurrentPage(pathname);
    if (open) {
      // Widget is open: inject a navigation message so the conversation flows naturally
      const { intro } = getPageContext(pathname);
      setMessages(prev => [
        ...prev,
        { id: `nav-${Date.now()}`, role: "jarrett",
          content: `*(Navigated to ${getPageContext(pathname).label})* ${intro}` }
      ]);
    } else {
      // Widget is closed: reset so next open gets a fresh intro for the new page
      setInitialized(false);
    }
  }
}, [pathname, currentPage, open]);
```

### Live Data Injection

Before sending to the API, the widget fetches real app data and appends it to the user's message:

```typescript
async function handleSend(e) {
  // ...
  const { context } = getPageContext(pathname);
  let dataContext = "";

  try {
    if (pathname === "/console" || pathname.startsWith("/console/graph")) {
      // On dashboard/graph: inject simulation list as context
      const sims = await api.simulations.list();
      dataContext = `\n\nSIMULATION DATA:\n${sims.map(formatSim).join("\n")}`;
    } else if (pathname.startsWith("/console/sounding/")) {
      // On a specific simulation: inject that simulation's current data
      const simId = pathname.split("/console/sounding/")[1]?.split("/")[0];
      if (simId !== "new") {
        const sim = await api.simulations.get(simId);
        dataContext = `\n\nCURRENT SIMULATION: "${sim.event?.title}" | ...`;
      }
    }
  } catch {
    // Non-critical — proceed without data context if fetch fails
  }

  // Compose the full message: page context + data context + user's question
  const fullMessage = `PAGE CONTEXT: ${context}${dataContext}\n\nUser question: ${text}`;
  const apiMessages = [...history, { role: "user", content: fullMessage }];

  const result = await api.chat.send("jarrett", apiMessages);
  // ...
}
```

**Key point:** The user's visible message is just `text`. The full message with context is only sent to the API — the user's chat history in the UI stays clean.

### Agentic Tool Block Parsing

After receiving a reply, parse out any action blocks before displaying:

```typescript
// Parse simulate block
const simMatch = result.reply.match(/```simulate\s*([\s\S]*?)```/);

// Parse graph_query block (using the shared parser)
const { prose: replyAfterGraph, graphQuery } = parseGraphQuerySpec(
  result.reply.replace(/```simulate[\s\S]*?```/, "")
);

// Display only the prose — strip the tool blocks from the visible message
const displayReply = replyAfterGraph.trim() || result.reply;
setMessages(prev => [...prev, { id: `j-${Date.now()}`, role: "jarrett", content: displayReply }]);

// Dispatch simulate action
if (simMatch && pathname.startsWith("/console/sounding/new")) {
  const spec = JSON.parse(simMatch[1].trim());
  window.dispatchEvent(new CustomEvent("jarrett:simulate", { detail: spec }));
}

// Dispatch graph query action
if (graphQuery) {
  if (pathname.startsWith("/console/graph")) {
    window.dispatchEvent(new CustomEvent("jarrett:graph", { detail: { spec: graphQuery, naturalLanguage: text } }));
  } else {
    router.push("/console/graph");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("jarrett:graph", { detail: { spec: graphQuery, naturalLanguage: text } }));
    }, 800); // allow page to mount before firing
  }
}
```

**The CustomEvent pattern:** Pages listen for `window.addEventListener("jarrett:simulate", handler)` and `window.addEventListener("jarrett:graph", handler)`. This decouples the widget from page internals — the widget never imports page-specific logic.

### Suggested Prompts

Before the user types anything, display route-specific starter prompts:

```typescript
// Only shown before the user has sent any message
{!messages.some(m => m.role === "user") && (
  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
    {getSuggestedPrompts(pathname).map(prompt => (
      <button key={prompt} onClick={() => setInput(prompt)}
        className="rounded-full border px-2.5 py-1 text-[10px] hover:border-primary/40">
        {prompt}
      </button>
    ))}
  </div>
)}

function getSuggestedPrompts(pathname: string): string[] {
  if (pathname === "/console")
    return ["How does a simulation work?", "What dealers are included?", "Show me a sample topic"];
  if (pathname.startsWith("/console/sounding/new"))
    return ["Simulate FOMC rate cut", "Run oil supply shock, 4 rounds", "China tariffs with crisis"];
  // ...
}
```

### History Filtering for Multi-Turn Context

Only user messages are sent as history. The page-context prefix injected per-message would bloat the context window if sent repeatedly:

```typescript
const history: ChatMessage[] = messages
  .filter(m => m.role === "user")
  .map(m => ({ role: "user", content: m.content }));
// Note: Jarrett's replies are NOT sent back — the system prompt is re-sent with each request.
// This keeps the context clean and avoids the AI seeing its own injected context strings.
```

---

## Part 3: UI/UX Design

### The Three-State Widget

```
CLOSED                    OPEN                     MINIMIZED
┌──────────┐             ┌──────────────────┐      ┌──────────────────────┐
│          │             │ Jarrett  [−] [×] │      │ 🐝 Jarrett    💬     │
│          │             ├──────────────────┤      └──────────────────────┘
│          │             │                  │      (click to restore)
│          │             │  messages...     │
│          │             │                  │
│   🐝     │             ├──────────────────┤
│  (FAB)   │             │ suggested prompts│
└──────────┘             ├──────────────────┤
• green dot              │ [input] [send]   │
• pulse animation        └──────────────────┘
```

**Why minimized matters:** Users sometimes open the widget mid-task, get a partial answer, and want to keep the page visible. The pill state lets them "park" the chat without closing it.

### Avatar Design

The Jarrett avatar is a white bee SVG on a brand-primary circle background. The bee motif:
- Is immediately distinctive (not a generic chat bubble)
- Scales cleanly from 20px (message list) to 32px (FAB) without losing detail
- Has no text so it renders identically across all sizes

```typescript
// JarrettAvatar accepts a size prop — use consistently:
<JarrettAvatar size={20} />  // in message list
<JarrettAvatar size={28} />  // in chat header
<JarrettAvatar size={32} />  // in FAB
```

The status indicator on the FAB (green pulsing dot) signals "online and ready" — it is always visible when the widget is closed, reinforcing that Jarrett is always available.

### Typography and Spacing

The chat uses `text-xs` (12px) for message content — one size below the page body text. This creates visual separation between the chat overlay and the underlying page without feeling cramped.

```
Header:  text-sm font-semibold (Jarrett name)
         text-[10px] font-mono uppercase tracking-widest (page label)
Messages: text-xs leading-relaxed
Prompts: text-[10px]
Input:   text-xs placeholder:text-muted-foreground
```

The monospace page label (`DASHBOARD`, `KNOWLEDGE GRAPH`) is a deliberate choice — it reads like a terminal status indicator, reinforcing the "intelligent tool" personality rather than a consumer chatbot feel.

### Animation

All transitions use `motion/react` (Motion for React). Three animation contexts:

```typescript
// Chat window: slide up + fade on open/close
initial={{ opacity: 0, y: 16, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 16, scale: 0.95 }}
transition={{ duration: 0.2, ease: "easeOut" }}

// FAB icon swap (X ↔ avatar): rotate out/in
initial={{ opacity: 0, rotate: -90 }}
animate={{ opacity: 1, rotate: 0 }}
exit={{ opacity: 0, rotate: 90 }}
transition={{ duration: 0.15 }}

// Minimized pill: slide up from below
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: 8 }}
```

Keep durations short (150–200ms). Chat widgets are ambient UI — the animation should feel instant, not theatrical.

### Typing Indicator

Three dots with staggered `animate-bounce` and `animation-delay` — the standard chat typing indicator pattern:

```tsx
<div className="flex gap-1 items-center h-4">
  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
</div>
```

The indicator appears on a Jarrett avatar row (same layout as a real message) so it feels like Jarrett is composing a reply, not a generic loading state.

### Message Alignment

```
Jarrett messages:          User messages:
[🐝] [message bubble]     [message bubble] (right-aligned, primary color)

flex-row                   flex-row-reverse
bg-muted text-foreground   bg-primary text-primary-foreground
```

Standard chat convention: agent left, user right. The primary colour on user messages creates a clear visual distinction and matches the rest of the app's action colour.

### Inline Markdown Rendering

Rather than importing a full markdown library, use a lightweight inline parser for the common patterns (`**bold**`, `*italic*`):

```typescript
function renderContent(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i} className="text-muted-foreground text-[10px]">{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}
```

The italic style (`text-muted-foreground text-[10px]`) is used by the navigation messages `*(Navigated to Dashboard)*` — italics signal system messages vs. conversational replies.

### Where to Mount the Widget

Mount in the root layout, outside all page content — it should follow the user across every route:

```typescript
// app/console/layout.tsx (or root app/layout.tsx if you want it on all pages)
export default function ConsoleLayout({ children }) {
  return (
    <div>
      {children}
      <JarrettWidget />  {/* always rendered, controls its own visibility */}
    </div>
  );
}
```

The widget hides itself (`return null`) on pages where it doesn't belong (auth, dedicated chat pages).

---

## Part 4: Connecting Widget to Page Actions

The widget dispatches `CustomEvent`s on `window`. Pages listen for them.

### Simulate action (New Simulation page)

The New Simulation page listens for `jarrett:simulate` and fills + submits its form:

```typescript
// In the New Simulation page component:
useEffect(() => {
  function onJarrettSimulate(e: CustomEvent) {
    const { topic, rounds, crisis } = e.detail;
    setTopic(topic);
    setRounds(rounds ?? 3);
    if (crisis) setCrisis(crisis);
    // Optionally auto-submit:
    handleSubmit();
  }
  window.addEventListener("jarrett:simulate", onJarrettSimulate as EventListener);
  return () => window.removeEventListener("jarrett:simulate", onJarrettSimulate as EventListener);
}, []);
```

### Graph query action (Knowledge Graph page)

```typescript
// In the Knowledge Graph page component:
useEffect(() => {
  function onJarrettGraph(e: CustomEvent) {
    const { spec, naturalLanguage } = e.detail;
    applyGraphQuery(spec);  // your graph query handler
    saveQuery({ ...spec, naturalLanguage });  // optional: persist to history
  }
  window.addEventListener("jarrett:graph", onJarrettGraph as EventListener);
  return () => window.removeEventListener("jarrett:graph", onJarrettGraph as EventListener);
}, []);
```

**Why CustomEvents and not a shared state store?** The widget and the pages are mounted at different levels of the component tree. Using `window` events avoids prop-drilling, context threading, or a global store just for this use case. It also means the widget has zero imports from page modules — it stays fully self-contained.

---

## Part 5: Checklist for Adapting to a New Project

### Backend

- [ ] Create `POST /chat/{agentId}` Lambda (or equivalent endpoint)
- [ ] Define valid agent IDs for your domain (`jarrett` equivalent + any specialized personas)
- [ ] Write a system prompt for your neutral guide with: identity, app knowledge, metrics glossary, entity profiles, response rules, tool block specs
- [ ] Write system prompts for specialized personas (if applicable)
- [ ] Implement intent detection to route to specialized personas (if applicable)
- [ ] Define tool block formats for any agentic actions the AI should trigger
- [ ] Set `CHAT_MODEL_ID` env var (start with Haiku, upgrade if quality isn't sufficient)
- [ ] Apply rate limiting at the API layer (100 req/s is a reasonable default)

### Frontend

- [ ] Create the avatar component (SVG, scales cleanly 20–32px)
- [ ] Implement `getPageContext(pathname)` with one branch per route
- [ ] Implement `getSuggestedPrompts(pathname)` with 2–3 prompts per route
- [ ] Implement route-change detection with open/closed handling
- [ ] Implement live data injection for each route (non-critical — wrap in try/catch)
- [ ] Implement tool block parsers for each action type
- [ ] Dispatch `CustomEvent`s for each action type
- [ ] Mount the widget in root layout
- [ ] Add `return null` guards for routes where the widget shouldn't appear
- [ ] Test the three-state widget (open/minimized/closed) on mobile viewports

### Pages

- [ ] Add `window.addEventListener` for each action event the AI can dispatch
- [ ] Handle the delayed-navigation case (widget navigates first, then fires event after 800ms)

---

## Common Pitfalls

**The AI emits tool blocks unprompted.**  
Cause: the system prompt condition is too loose. Fix: use "ONLY when the user explicitly asks to X" and test with messages that should NOT trigger the block.

**Context window grows too large.**  
Cause: sending full message objects (with the injected context prefix) as history. Fix: only send user-visible content as history, not the prefixed messages sent to the API.

**Route change doesn't update the AI's context.**  
Cause: `initialized` flag is not reset when the route changes with the widget closed. Fix: set `setInitialized(false)` in the route-change effect when `!open`.

**The widget blocks page content on mobile.**  
Cause: `fixed bottom-6 right-6` with a 320px wide window. Fix: on small screens, either reduce the width (`w-72` on sm) or render the widget as a bottom sheet instead.

**Delayed navigation + CustomEvent fires before the page mounts.**  
Cause: 800ms delay is too short for slow connections. Fix: make the listening page also check for a pending query in sessionStorage on mount, and apply it if found.

**Tool block JSON is malformed and the AI emits partial blocks.**  
Cause: temperature too high or max_tokens too low (truncated output). Fix: lower temperature to 0.5 for Jarrett, and ensure `max_tokens` is at least 1024. Wrap all JSON.parse in try/catch and fall through gracefully.
