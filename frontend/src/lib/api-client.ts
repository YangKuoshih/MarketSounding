const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ms-token");
}

function setToken(token: string) {
  localStorage.setItem("ms-token", token);
}

function clearToken() {
  localStorage.removeItem("ms-token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || res.statusText);
  }

  return res.json();
}

export const api = {
  auth: {
    register(username: string, password: string) {
      return request<{ success: boolean; token?: string; userId?: string; error?: string }>(
        "/auth/register",
        { method: "POST", body: JSON.stringify({ username, password }) },
      );
    },
    login(username: string, password: string) {
      return request<{ success: boolean; token?: string; userId?: string; error?: string }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ username, password }) },
      );
    },
    me() {
      return request<{ userId: string; username: string }>("/auth/me");
    },
  },
  events: {
    research(topic: string, maxSources?: number, recency?: string) {
      return request<{ event: EventRecord; sources: Source[] }>(
        "/events/research",
        { method: "POST", body: JSON.stringify({ topic, maxSources, recency }) },
      );
    },
    samples() {
      return request<SampleEvent[]>("/events/samples");
    },
  },
  simulations: {
    create(params: CreateSimulationParams) {
      return request<{ simulationId: string }>("/simulations", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    get(id: string) {
      return request<SimulationView>(`/simulations/${id}`);
    },
    list() {
      return request<SimulationSummary[]>("/simulations");
    },
    injectCrisis(id: string, crisisText: string) {
      return request<{ acknowledged: boolean }>(`/simulations/${id}/crisis`, {
        method: "POST",
        body: JSON.stringify({ crisisText }),
      });
    },
  },
  graph: {
    subgraph(filters?: GraphFilters) {
      const params = new URLSearchParams();
      if (filters?.nodeType) params.set("nodeType", filters.nodeType);
      if (filters?.timeRange) params.set("timeRange", filters.timeRange);
      const qs = params.toString();
      return request<{ nodes: GraphNode[]; edges: GraphEdge[] }>(
        `/graph/subgraph${qs ? `?${qs}` : ""}`,
      );
    },
    saveQuery(q: SaveGraphQueryParams) {
      return request<GraphQueryRecord>("/graph/queries", {
        method: "POST",
        body: JSON.stringify(q),
      });
    },
    listQueries() {
      return request<{ queries: GraphQueryRecord[] }>("/graph/queries").then((r) => r.queries);
    },
    deleteQuery(queryId: string) {
      return request<{ deleted: boolean }>(`/graph/queries/${queryId}`, {
        method: "DELETE",
      });
    },
  },
  personas: {
    list() {
      return request<Persona[]>("/personas");
    },
  },
  chat: {
    send(personaId: string, messages: ChatMessage[]) {
      return request<{ reply: string; personaId: string; model: string }>(
        `/chat/${personaId}`,
        {
          method: "POST",
          body: JSON.stringify({ messages }),
        },
      );
    },
  },
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export { setToken, clearToken, getToken, ApiError };

// Types
export interface EventRecord {
  eventId: string;
  title: string;
  summary: string;
  rawText: string;
  eventDate: string;
  source: "pasted" | "sample" | "researched";
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string;
  domain: string;
  relevanceScore: number;
}

export interface SampleEvent {
  id: string;
  title: string;
  summary: string;
  icon: string;
}

export interface CreateSimulationParams {
  eventText?: string;
  eventId?: string;
  title?: string;
  topic?: string;
  config?: {
    maxRounds: number;
    convergenceThreshold: number;
    enableCrisisInjection: boolean;
    crisisText?: string;
  };
}

export interface SimulationSummary {
  simulationId: string;
  eventTitle: string;
  status: "running" | "complete" | "failed";
  currentRound: number;
  totalRounds: number;
  createdAt: string;
  trajectory?: number[];
  consensus?: number;
}

export interface SimulationView {
  simulationId: string;
  status: "running" | "complete" | "failed";
  currentRound: number;
  totalRounds: number;
  event: {
    title: string;
    summary: string;
    sources?: Source[];
  };
  rounds: RoundData[];
  transcript?: string;
  crisisEvents?: CrisisEvent[];
}

export interface RoundData {
  roundNumber: number;
  roundType: "initial" | "peer_response" | "crisis_reevaluation";
  reactions: ReactionData[];
  convergenceScore?: number;
}

export interface ReactionData {
  personaId: string;
  status: "complete" | "failed";
  ratePathView: string;
  balanceSheetView: string;
  riskAssetView: string;
  keyConcerns: string[];
  hawkishDovishScore: number;
  confidence: number;
  reasoningMd: string;
  positionShift: number | null;
  influencedBy: string[];
  keyQuote: string | null;
}

export interface CrisisEvent {
  crisisId: string;
  crisisText: string;
  injectedAfterRound: number;
  injectedAt: string;
}

export interface GraphNode {
  nodeId: string;
  nodeType: "dealer" | "topic" | "concern" | "crisis";
  label: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: "influence" | "concern" | "topic" | "correlation" | "crisis";
  weight: number;
  metadata: Record<string, unknown>;
}

export interface GraphFilters {
  nodeType?: string;
  timeRange?: string;
}

export interface Persona {
  id: string;
  name: string;
  shortName: string;
  bias: number;
}

export interface SaveGraphQueryParams {
  naturalLanguage: string;
  operation: string;
  params: Record<string, unknown>;
  explanation: string;
  resultSummary: string;
}

export interface GraphQueryRecord {
  queryId: string;
  userId: string;
  createdAt: string;
  naturalLanguage: string;
  operation: string;
  params: Record<string, unknown>;
  explanation: string;
  resultSummary: string;
}
