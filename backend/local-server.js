/**
 * Local mock server for MarketSounding — simulates all Lambda endpoints in-process.
 * No AWS calls. All state is in-memory.
 * Run: node local-server.js
 */

const http = require('http');
const crypto = require('crypto');

// ── In-memory stores ──────────────────────────────────────────────────────────
const users = new Map();        // userId → { userId, username, passwordHash }
const events = new Map();       // eventId → EventRecord
const simulations = new Map();  // simulationId → SimulationRecord
const rounds = new Map();       // simulationId → RoundRecord[]
const reactions = new Map();    // simulationId → { [roundNumber]: ReactionData[] }

const JWT_SECRET = 'local-dev-secret-do-not-use-in-prod';
const PORT = 3001;

// ── Persona data ──────────────────────────────────────────────────────────────
const PERSONAS = [
  { id: 'gs',   name: 'Goldman Sachs',   shortName: 'GS',   bias: -0.2, defaultBias: -0.2, typicalConcerns: ['Financial conditions overtightening','Labor market leading indicators softening','Inflation expectations anchoring','Global growth spillovers'] },
  { id: 'jpm',  name: 'JP Morgan',       shortName: 'JPM',  bias: 0.1,  defaultBias: 0.1,  typicalConcerns: ['Labor market tightness','Wage inflation persistence','Core services stickiness','Fed credibility'] },
  { id: 'ms',   name: 'Morgan Stanley',  shortName: 'MS',   bias: 0.5,  defaultBias: 0.5,  typicalConcerns: ['Inflation persistence','Market mispricing of terminal rate','Tail risk scenarios','Credit spread widening'] },
  { id: 'citi', name: 'Citi',            shortName: 'Citi', bias: 0.0,  defaultBias: 0.0,  typicalConcerns: ['Data surprises relative to consensus','EM spillover effects','Dollar strength headwinds','Geopolitical tail risks'] },
  { id: 'bofa', name: 'Bank of America', shortName: 'BofA', bias: 0.3,  defaultBias: 0.3,  typicalConcerns: ['Consumer resilience','Credit spread dynamics','Housing market tightness','Corporate earnings pressure'] },
];

const SAMPLE_EVENTS = [
  {
    id: 'fomc-june-2026',
    title: 'FOMC June 2026 Decision',
    summary: 'Markets pricing 25bp cut with 60% probability after softer CPI print',
    icon: 'newspaper',
  },
  {
    id: 'tariffs-china',
    title: 'US-China Tariff Escalation',
    summary: 'New 25% tariffs on $200B in goods; retaliatory measures expected within 48h',
    icon: 'trending',
  },
  {
    id: 'oil-supply-shock',
    title: 'Middle East Oil Supply Shock',
    summary: 'Strait of Hormuz disruption takes 20% of global supply offline for 72h',
    icon: 'globe',
  },
];

const SAMPLE_EVENT_DETAILS = {
  'fomc-june-2026': {
    rawText: `The Federal Reserve enters its June 2026 FOMC meeting against a backdrop of moderating inflation and softening labor market data. May headline CPI printed at 2.4% YoY (consensus 2.5%), while core CPI eased to 2.7% YoY (consensus 2.8%).\n\nJob openings have declined to 7.8M from 8.4M three months prior, and the unemployment rate has drifted higher to 4.3%. Wage growth as measured by Atlanta Fed Wage Tracker has moderated to 3.9% YoY from peaks above 5%.\n\nFed funds futures are pricing approximately 60% probability of a 25bp cut at this meeting, with full pricing of two cuts by year-end.`,
    eventDate: '2026-06-12',
  },
  'tariffs-china': {
    rawText: `The Trump administration announced new 25% tariffs covering $200B of Chinese imports, citing intellectual property concerns and persistent trade deficits. The new tariffs cover technology, machinery, automotive components, and consumer electronics.\n\nChinese officials have stated retaliatory measures will be announced within 48 hours. Equity markets opened lower with semiconductors and machinery names down 4-7%.`,
    eventDate: '2026-04-08',
  },
  'oil-supply-shock': {
    rawText: `An attack on critical oil infrastructure in the Strait of Hormuz has taken approximately 20% of global oil supply offline for at least 72 hours. Oil benchmarks have spiked: Brent up 15% to $98/bbl, WTI up 14% to $94/bbl.\n\nEquity markets are mixed: energy names sharply higher, but broader market down 2-3% on growth concerns. Treasury yields up 5-8bp on inflation reflation.`,
    eventDate: '2026-03-15',
  },
};

// ── Crypto helpers ─────────────────────────────────────────────────────────────
function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + JWT_SECRET).digest('hex');
}

function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 }));
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function b64url(data) {
  const buf = typeof data === 'string' ? Buffer.from(data) : data;
  return buf.toString('base64url');
}

function genId(len = 12) {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

// ── Simulation engine ──────────────────────────────────────────────────────────
const RATE_PATH_VIEWS = [
  'Cut 25bp in June with one additional cut by year-end; terminal rate 3.75%.',
  'Hold in June; two cuts in H2 if data confirms cooling trend.',
  'Pause at current level; data dependency requires patience before easing.',
  'Front-loaded cuts warranted given lagged monetary policy transmission.',
  'Modest easing path; 50bp total through year-end barring upside surprises.',
];

const BALANCE_SHEET_VIEWS = [
  'QT proceeds at current $60B/month pace; no change expected near-term.',
  'Balance sheet normalization on autopilot; runway through mid-2027.',
  'Slowing QT pace advisable if liquidity conditions tighten further.',
  'QT pace appropriate; reserves remain ample above $3T.',
  'Balance sheet policy should remain separate from rate decisions.',
];

const RISK_ASSET_VIEWS = [
  'Equities fairly valued; credit spreads compressed — limited upside from here.',
  'Risk assets supported by soft-landing narrative; duration headwind manageable.',
  'Credit conditions tightening at margin; high-yield spreads warrant monitoring.',
  'Risk-on bias intact; lower terminal rate supports P/E expansion.',
  'Defensive posture; rotation into quality/low-vol given macro uncertainty.',
];

const CONCERNS = [
  ['Services inflation stickiness', 'Wage growth exceeding productivity gains', 'Shelter CPI lag effect'],
  ['Labor market resilience masking underlying softness', 'Financial conditions loosening prematurely'],
  ['Fed credibility at risk if it cuts too early', 'Inflation re-acceleration scenario underpriced'],
  ['EM currency stress on dollar strength', 'Global growth drag from trade fragmentation'],
  ['Consumer credit quality deterioration', 'Commercial real estate stress spillover'],
];

const KEY_QUOTES = [
  'The data presents a compelling case for gradual normalization.',
  'We remain data-dependent; one print does not make a trend.',
  'The risk-reward favors patience over preemptive easing.',
  'Financial conditions are doing some of the heavy lifting for the Fed.',
  'The market is priced for perfection — that concerns us.',
];

function generateReaction(personaId, roundNumber, roundType, priorReactions) {
  const persona = PERSONAS.find(p => p.id === personaId);
  const seed = (personaId.charCodeAt(0) + roundNumber * 7) % 5;
  const bias = persona.defaultBias + (Math.random() - 0.5) * 0.3;
  const clampedBias = Math.max(-1, Math.min(1, bias));

  let positionShift = null;
  let influencedBy = [];
  let keyQuote = null;

  if (roundType !== 'initial' && priorReactions && priorReactions.length > 0) {
    const ownPrior = priorReactions.find(r => r.personaId === personaId);
    if (ownPrior) {
      positionShift = parseFloat((clampedBias - ownPrior.hawkishDovishScore).toFixed(2));
    }
    // Mock influence from peers
    const peers = priorReactions.filter(r => r.personaId !== personaId);
    if (peers.length > 0) {
      influencedBy = [peers[Math.floor(Math.random() * peers.length)].personaId];
      keyQuote = KEY_QUOTES[seed];
    }
  }

  return {
    personaId,
    status: 'complete',
    ratePathView: RATE_PATH_VIEWS[seed],
    balanceSheetView: BALANCE_SHEET_VIEWS[seed],
    riskAssetView: RISK_ASSET_VIEWS[seed],
    keyConcerns: CONCERNS[seed].slice(0, 2 + (roundNumber % 2)),
    hawkishDovishScore: parseFloat(clampedBias.toFixed(2)),
    confidence: parseFloat((0.6 + Math.random() * 0.35).toFixed(2)),
    reasoningMd: `**Round ${roundNumber} Analysis (${roundType})**\n\nGiven the current macro backdrop, our view is informed by ${persona.name}'s traditional focus areas. ${RATE_PATH_VIEWS[seed]}\n\nKey considerations include ${CONCERNS[seed][0].toLowerCase()} and the broader impact on our rate path thesis. ${BALANCE_SHEET_VIEWS[seed]}\n\nFrom a risk-asset perspective: ${RISK_ASSET_VIEWS[seed]}`,
    positionShift,
    influencedBy,
    keyQuote,
  };
}

function runSimulationAsync(simulationId, eventText, eventTitle, config) {
  const sim = simulations.get(simulationId);
  if (!sim) return;

  const totalRounds = config.maxRounds || 3;
  let currentRound = 0;

  function runNextRound() {
    currentRound++;
    if (currentRound > totalRounds) {
      // Complete
      sim.status = 'complete';
      sim.currentRound = totalRounds;
      sim.completedAt = new Date().toISOString();

      // Build simple graph nodes/edges
      buildGraph(simulationId);
      return;
    }

    sim.currentRound = currentRound;

    const roundType = currentRound === 1 ? 'initial'
      : (sim.crisisEvents.length > 0 && currentRound === 2) ? 'crisis_reevaluation'
      : 'peer_response';

    const priorReactionsList = currentRound > 1 ? (reactions.get(simulationId)?.[currentRound - 1] || []) : [];

    const roundReactions = PERSONAS.map(p =>
      generateReaction(p.id, currentRound, roundType, priorReactionsList)
    );

    // Store round
    const simRounds = rounds.get(simulationId) || [];
    const convergenceScore = currentRound > 1
      ? parseFloat((Math.random() * 0.15).toFixed(3))
      : parseFloat((0.3 + Math.random() * 0.2).toFixed(3));

    simRounds.push({
      simulationId,
      roundNumber: currentRound,
      roundType,
      status: 'complete',
      convergenceScore,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    rounds.set(simulationId, simRounds);

    // Store reactions
    const simReactions = reactions.get(simulationId) || {};
    simReactions[currentRound] = roundReactions;
    reactions.set(simulationId, simReactions);

    // Schedule next round (1.5s delay to simulate async work)
    setTimeout(runNextRound, 1500);
  }

  // Start after short delay
  setTimeout(runNextRound, 800);
}

function buildGraph(simulationId) {
  // Graph is built lazily when requested; nothing to persist here
}

// ── HTTP server ───────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function getAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return verifyJwt(token);
}

const server = http.createServer(async (req, res) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  // ── POST /auth/register ──────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/register') {
    const body = await parseBody(req);
    const { username, password } = body;
    if (!username || !password || username.length < 3 || password.length < 8) {
      return send(res, 400, { error: 'Username ≥3 chars and password ≥8 chars required' });
    }
    const existing = [...users.values()].find(u => u.username === username);
    if (existing) return send(res, 409, { error: 'Username already exists' });

    const userId = genId();
    const passwordHash = hashPassword(password);
    users.set(userId, { userId, username, passwordHash });
    const token = signJwt({ userId, username });
    return send(res, 201, { success: true, token, userId });
  }

  // ── POST /auth/login ─────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/login') {
    const body = await parseBody(req);
    const { username, password } = body;
    const user = [...users.values()].find(u => u.username === username);
    const hash = hashPassword(password);
    if (!user || user.passwordHash !== hash) {
      return send(res, 401, { error: 'Invalid credentials' });
    }
    const token = signJwt({ userId: user.userId, username });
    return send(res, 200, { success: true, token, userId: user.userId });
  }

  // ── GET /events/samples ──────────────────────────────────────────────────
  if (method === 'GET' && path === '/events/samples') {
    return send(res, 200, { samples: SAMPLE_EVENTS });
  }

  // ── GET /personas ────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/personas') {
    return send(res, 200, {
      personas: PERSONAS.map(p => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        bias: p.defaultBias,
      })),
    });
  }

  // ── POST /events/research ────────────────────────────────────────────────
  if (method === 'POST' && path === '/events/research') {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const body = await parseBody(req);
    const { topic } = body;
    if (!topic) return send(res, 400, { error: 'topic is required' });

    const eventId = genId();
    const now = new Date().toISOString();
    const eventRecord = {
      eventId,
      title: `Research: ${topic}`,
      source: 'researched',
      rawText: `[Mock research result for: ${topic}]\n\nThis is a locally-generated placeholder. In production this calls Tavily search + Claude synthesis.\n\nTopic: ${topic}\nGenerated: ${now}`,
      summary: `Synthesized market event brief for topic: "${topic}". Key dynamics and dealer perspectives generated by mock server.`,
      eventDate: now.slice(0, 10),
      createdAt: now,
      userId: session.userId,
    };
    events.set(eventId, eventRecord);

    return send(res, 200, {
      event: eventRecord,
      sources: [
        { title: 'Mock Source 1', url: 'https://example.com/1', snippet: 'Relevant market commentary...', publishedDate: now, domain: 'example.com', relevanceScore: 0.92 },
        { title: 'Mock Source 2', url: 'https://example.com/2', snippet: 'Additional context on the topic...', publishedDate: now, domain: 'example.com', relevanceScore: 0.85 },
      ],
      searchQueries: [`${topic} market impact`, `${topic} Fed implications`],
    });
  }

  // ── POST /simulations ───────────────────────────────────────────────────
  if (method === 'POST' && path === '/simulations') {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const body = await parseBody(req);
    const { eventId, eventText, topic, title, config: userConfig } = body;

    if (!eventId && !eventText && !topic) {
      return send(res, 400, { error: 'Either eventId, eventText, or topic is required' });
    }

    // Resolve event text
    let resolvedText = eventText || '';
    let resolvedTitle = title || topic || 'Untitled Simulation';
    let resolvedEventId = eventId || '';

    if (eventId) {
      // Check sample events first
      if (SAMPLE_EVENT_DETAILS[eventId]) {
        resolvedText = SAMPLE_EVENT_DETAILS[eventId].rawText;
        const sample = SAMPLE_EVENTS.find(s => s.id === eventId);
        resolvedTitle = title || (sample ? sample.title : eventId);
        resolvedEventId = eventId;
      } else {
        const ev = events.get(eventId);
        if (!ev) return send(res, 400, { error: `Event not found: ${eventId}` });
        resolvedText = ev.rawText;
        resolvedTitle = title || ev.title;
      }
    }

    const cfg = {
      maxRounds: Math.max(3, Math.min(5, userConfig?.maxRounds || 3)),
      convergenceThreshold: userConfig?.convergenceThreshold ?? 0.1,
      enableCrisisInjection: userConfig?.enableCrisisInjection ?? true,
      crisisWaitTimeoutSeconds: userConfig?.crisisWaitTimeoutSeconds ?? 120,
    };

    const simulationId = genId();
    const now = new Date().toISOString();

    const sim = {
      simulationId,
      eventId: resolvedEventId,
      userId: session.userId,
      status: 'running',
      personaIds: ['gs', 'jpm', 'ms', 'citi', 'bofa'],
      config: cfg,
      currentRound: 0,
      totalRounds: cfg.maxRounds,
      crisisEvents: [],
      title: resolvedTitle,
      createdAt: now,
      completedAt: null,
      error: null,
      transcriptUrl: null,
      _eventText: resolvedText,
    };

    simulations.set(simulationId, sim);
    rounds.set(simulationId, []);
    reactions.set(simulationId, {});

    // Run async simulation
    runSimulationAsync(simulationId, resolvedText, resolvedTitle, cfg);

    return send(res, 202, { simulationId });
  }

  // ── GET /simulations ────────────────────────────────────────────────────
  if (method === 'GET' && path === '/simulations') {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const userSims = [...simulations.values()]
      .filter(s => s.userId === session.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(s => ({
        simulationId: s.simulationId,
        eventId: s.eventId,
        userId: s.userId,
        status: s.status,
        personaIds: s.personaIds,
        config: s.config,
        currentRound: s.currentRound,
        totalRounds: s.totalRounds,
        eventTitle: s.title,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
        error: s.error,
      }));

    return send(res, 200, { simulations: userSims });
  }

  // ── GET /simulations/:id ────────────────────────────────────────────────
  const simGetMatch = path.match(/^\/simulations\/([^/]+)$/);
  if (method === 'GET' && simGetMatch) {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const simId = simGetMatch[1];
    const sim = simulations.get(simId);
    if (!sim || sim.userId !== session.userId) return send(res, 404, { error: 'Simulation not found' });

    const simRounds = (rounds.get(simId) || []).map(r => {
      const roundReactions = (reactions.get(simId) || {})[r.roundNumber] || [];
      return { ...r, reactions: roundReactions };
    });

    // Load event metadata
    let eventData = null;
    if (sim.eventId && SAMPLE_EVENT_DETAILS[sim.eventId]) {
      const sample = SAMPLE_EVENTS.find(s => s.id === sim.eventId);
      eventData = { title: sample?.title || sim.eventId, summary: sample?.summary || '', sources: [] };
    } else if (sim.eventId && events.get(sim.eventId)) {
      const ev = events.get(sim.eventId);
      eventData = { title: ev.title, summary: ev.summary, sources: [] };
    }

    return send(res, 200, {
      simulationId: sim.simulationId,
      status: sim.status,
      currentRound: sim.currentRound,
      totalRounds: sim.totalRounds,
      personaIds: sim.personaIds,
      config: sim.config,
      title: sim.title,
      createdAt: sim.createdAt,
      completedAt: sim.completedAt,
      error: sim.error,
      crisisEvents: sim.crisisEvents,
      event: eventData,
      rounds: simRounds,
      transcriptUrl: sim.transcriptUrl,
    });
  }

  // ── POST /simulations/:id/crisis ────────────────────────────────────────
  const crisisMatch = path.match(/^\/simulations\/([^/]+)\/crisis$/);
  if (method === 'POST' && crisisMatch) {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const simId = crisisMatch[1];
    const sim = simulations.get(simId);
    if (!sim || sim.userId !== session.userId) return send(res, 404, { error: 'Simulation not found' });

    if (sim.status !== 'running') {
      return send(res, 409, { error: 'Simulation is not running' });
    }

    const body = await parseBody(req);
    const { crisisText } = body;
    if (!crisisText) return send(res, 400, { error: 'crisisText is required' });

    const crisisId = genId();
    sim.crisisEvents.push({
      crisisId,
      crisisText,
      injectedAfterRound: sim.currentRound,
      injectedAt: new Date().toISOString(),
    });

    return send(res, 200, { acknowledged: true, crisisId });
  }

  // ── GET /graph/subgraph ─────────────────────────────────────────────────
  if (method === 'GET' && path.startsWith('/graph/subgraph')) {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const nodes = [];
    const edges = [];
    const now = new Date().toISOString();

    // Dealer nodes
    PERSONAS.forEach(p => {
      nodes.push({ nodeId: `dealer-${p.id}`, nodeType: 'dealer', label: p.name, metadata: { avgHawkishDovishScore: p.defaultBias }, updatedAt: now });
    });

    // Topic nodes from simulations
    const completedSims = [...simulations.values()].filter(s => s.status === 'complete' && s.userId === session.userId);
    completedSims.forEach(sim => {
      const topicId = `topic-${sim.simulationId}`;
      nodes.push({ nodeId: topicId, nodeType: 'topic', label: sim.title, metadata: { simulationId: sim.simulationId }, updatedAt: now });

      PERSONAS.forEach(p => {
        edges.push({
          sourceNodeId: topicId,
          targetNodeId: `dealer-${p.id}`,
          edgeType: 'topic',
          weight: 0.5 + Math.random() * 0.5,
          simulationId: sim.simulationId,
          metadata: {},
          createdAt: now,
        });
      });
    });

    // Concern nodes
    const concerns = ['Inflation persistence', 'Labor market softening', 'Financial conditions', 'Credit spreads', 'EM spillovers'];
    concerns.forEach((c, i) => {
      const concernId = `concern-${i}`;
      nodes.push({ nodeId: concernId, nodeType: 'concern', label: c, metadata: { category: 'macro' }, updatedAt: now });

      PERSONAS.slice(0, 3).forEach(p => {
        edges.push({
          sourceNodeId: `dealer-${p.id}`,
          targetNodeId: concernId,
          edgeType: 'concern',
          weight: 0.3 + Math.random() * 0.7,
          simulationId: '',
          metadata: {},
          createdAt: now,
        });
      });
    });

    return send(res, 200, { nodes, edges });
  }

  // ── POST /chat/:personaId ───────────────────────────────────────────────
  const chatMatch = path.match(/^\/chat\/([^/]+)$/);
  if (method === 'POST' && chatMatch) {
    const session = getAuth(req);
    if (!session) return send(res, 401, { error: 'Unauthorized' });

    const personaId = chatMatch[1];
    const persona = PERSONAS.find(p => p.id === personaId);
    if (!persona) return send(res, 404, { error: `Unknown persona: ${personaId}` });

    const body = await parseBody(req);
    const { messages } = body;
    if (!messages || !messages.length) return send(res, 400, { error: 'messages is required' });

    const lastMsg = messages[messages.length - 1]?.content || '';
    const biasLabel = persona.defaultBias < -0.1 ? 'dovish' : persona.defaultBias > 0.1 ? 'hawkish' : 'neutral';

    const replies = [
      `From ${persona.name}'s perspective, the data warrants a ${biasLabel} interpretation. ${lastMsg.includes('rate') ? 'On rates specifically: our base case aligns with one to two cuts this cycle.' : 'We remain data-dependent and focused on labor market evolution.'}`,
      `${persona.shortName} view: The current macro environment is consistent with our ${biasLabel} bias. Key risk: ${persona.typicalConcerns[0].toLowerCase()}.`,
      `Our read at ${persona.name}: Given the trajectory of recent prints, we maintain our positioning. ${persona.typicalConcerns[1] || 'Inflation dynamics'} remain the primary concern.`,
    ];

    const reply = replies[Math.floor(Math.random() * replies.length)];
    return send(res, 200, { reply, personaId, model: 'mock-local' });
  }

  // ── 404 ─────────────────────────────────────────────────────────────────
  send(res, 404, { error: `Not found: ${method} ${path}` });
});

server.listen(PORT, () => {
  console.log(`\n✓ MarketSounding mock API running on http://localhost:${PORT}`);
  console.log('  Endpoints:');
  console.log('    POST /auth/register');
  console.log('    POST /auth/login');
  console.log('    GET  /events/samples');
  console.log('    POST /events/research');
  console.log('    GET  /personas');
  console.log('    POST /simulations');
  console.log('    GET  /simulations');
  console.log('    GET  /simulations/:id');
  console.log('    POST /simulations/:id/crisis');
  console.log('    GET  /graph/subgraph');
  console.log('    POST /chat/:personaId');
  console.log('\n  All state is in-memory — restarting clears all data.\n');
});
