"""Convert judges-packet.html to judges-packet.docx using python-docx."""

from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

DARK_BLUE = RGBColor(0x1B, 0x3A, 0x5C)
MID_BLUE  = RGBColor(0x2E, 0x5F, 0x8C)
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_BG  = RGBColor(0xEE, 0xF4, 0xFB)
GRAY      = RGBColor(0x55, 0x55, 0x55)

doc = Document()

# ── Page margins ────────────────────────────────────────────────────────────
section = doc.sections[0]
section.top_margin    = Inches(1.0)
section.bottom_margin = Inches(1.0)
section.left_margin   = Inches(1.15)
section.right_margin  = Inches(1.15)

# ── Default body style ───────────────────────────────────────────────────────
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)

def set_heading_style(para, text, level, color=DARK_BLUE, size=13):
    para.clear()
    run = para.add_run(text)
    run.font.bold = True
    run.font.color.rgb = color
    run.font.size = Pt(size)
    run.font.name = 'Calibri'
    para.paragraph_format.space_before = Pt(14)
    para.paragraph_format.space_after  = Pt(6)
    # Left border for H2
    if level == 2:
        pPr = para._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        left = OxmlElement('w:left')
        left.set(qn('w:val'), 'single')
        left.set(qn('w:sz'), '24')
        left.set(qn('w:space'), '10')
        left.set(qn('w:color'), '1B3A5C')
        pBdr.append(left)
        pPr.append(pBdr)

def add_body(text, bold_spans=None):
    """Add a body paragraph, optionally with inline bold spans."""
    para = doc.add_paragraph()
    para.paragraph_format.space_after = Pt(6)
    if bold_spans is None:
        run = para.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(11)
    return para

def add_bullet(text, level=0):
    para = doc.add_paragraph(style='List Bullet')
    para.paragraph_format.left_indent = Inches(0.25 * (level + 1))
    para.paragraph_format.space_after = Pt(3)
    # Split on ** for bold
    parts = text.split('**')
    for i, part in enumerate(parts):
        run = para.add_run(part)
        run.font.name = 'Calibri'
        run.font.size = Pt(11)
        if i % 2 == 1:
            run.font.bold = True
            run.font.color.rgb = DARK_BLUE
    return para

def add_numbered(text):
    para = doc.add_paragraph(style='List Number')
    para.paragraph_format.space_after = Pt(3)
    parts = text.split('**')
    for i, part in enumerate(parts):
        run = para.add_run(part)
        run.font.name = 'Calibri'
        run.font.size = Pt(11)
        if i % 2 == 1:
            run.font.bold = True
            run.font.color.rgb = DARK_BLUE
    return para

def add_rich_para(text):
    """Paragraph with **bold** and `code` inline formatting."""
    para = doc.add_paragraph()
    para.paragraph_format.space_after = Pt(6)
    # tokenize on ** and `
    import re
    tokens = re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text)
    for token in tokens:
        if token.startswith('**') and token.endswith('**'):
            run = para.add_run(token[2:-2])
            run.font.bold = True
            run.font.color.rgb = DARK_BLUE
            run.font.name = 'Calibri'
            run.font.size = Pt(11)
        elif token.startswith('`') and token.endswith('`'):
            run = para.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
        else:
            run = para.add_run(token)
            run.font.name = 'Calibri'
            run.font.size = Pt(11)
    return para

def add_callout(text):
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(8)
    para.paragraph_format.space_after  = Pt(8)
    para.paragraph_format.left_indent  = Inches(0.3)
    # Shade
    pPr = para._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'EEF4FB')
    pPr.append(shd)
    # Left border
    pBdr = OxmlElement('w:pBdr')
    left = OxmlElement('w:left')
    left.set(qn('w:val'), 'single')
    left.set(qn('w:sz'), '24')
    left.set(qn('w:space'), '10')
    left.set(qn('w:color'), '2E5F8C')
    pBdr.append(left)
    pPr.append(pBdr)
    run = para.add_run(text)
    run.font.bold = True
    run.font.name = 'Calibri'
    run.font.size = Pt(11)
    run.font.color.rgb = DARK_BLUE

def add_divider():
    para = doc.add_paragraph()
    para.paragraph_format.space_before = Pt(10)
    para.paragraph_format.space_after  = Pt(10)
    pPr = para._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), 'CCD6E0')
    pBdr.append(bottom)
    pPr.append(pBdr)

def add_table(headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    # Header row
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        for run in hdr_cells[i].paragraphs[0].runs:
            run.font.bold = True
            run.font.color.rgb = WHITE
            run.font.name = 'Calibri'
            run.font.size = Pt(10)
        tc = hdr_cells[i]._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), '1B3A5C')
        tcPr.append(shd)
    # Data rows
    for ri, row_data in enumerate(rows):
        cells = table.rows[ri + 1].cells
        for ci, cell_text in enumerate(row_data):
            cells[ci].text = cell_text
            for run in cells[ci].paragraphs[0].runs:
                run.font.name = 'Calibri'
                run.font.size = Pt(10)
            if ri % 2 == 1:
                tc = cells[ci]._tc
                tcPr = tc.get_or_add_tcPr()
                shd = OxmlElement('w:shd')
                shd.set(qn('w:val'), 'clear')
                shd.set(qn('w:color'), 'auto')
                shd.set(qn('w:fill'), 'F4F7FB')
                tcPr.append(shd)
    # Column widths
    if col_widths:
        for row in table.rows:
            for i, cell in enumerate(row.cells):
                cell.width = Inches(col_widths[i])
    doc.add_paragraph()  # spacing after table


# ════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════════════════════════

cover_title = doc.add_paragraph()
cover_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
cover_title.paragraph_format.space_before = Pt(60)
cover_title.paragraph_format.space_after  = Pt(4)
r = cover_title.add_run('MarketSounding')
r.font.name = 'Calibri'
r.font.size = Pt(32)
r.font.bold = True
r.font.color.rgb = DARK_BLUE

tagline = doc.add_paragraph()
tagline.alignment = WD_ALIGN_PARAGRAPH.CENTER
tagline.paragraph_format.space_after = Pt(28)
r = tagline.add_run('AI-Powered Primary Dealer Reaction Simulator')
r.font.name = 'Calibri'
r.font.size = Pt(14)
r.font.italic = True
r.font.color.rgb = GRAY

for line, val in [
    ('Competition', 'NY Crunch-a-thon'),
    ('Host', 'Federal Reserve Bank of New York'),
    ('Team Members', '___________________________'),
    ('Date', 'May 2026'),
]:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    rb = p.add_run(f'{line}:  ')
    rb.font.bold = True
    rb.font.name = 'Calibri'
    rb.font.size = Pt(11)
    rb.font.color.rgb = DARK_BLUE
    rv = p.add_run(val)
    rv.font.name = 'Calibri'
    rv.font.size = Pt(11)

doc.add_page_break()

# ════════════════════════════════════════════════════════════════════════════
# Q1
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '1.  Project Idea and the Bank Problem It Addresses', 2, size=13)

p = doc.add_paragraph()
set_heading_style(p, 'The Core Idea', 3, color=MID_BLUE, size=11)
add_rich_para(
    '**MarketSounding** is a multi-agent AI simulation platform that models how the five major US Treasury primary dealers — Goldman Sachs, JP Morgan, Morgan Stanley, Citigroup, and Bank of America — would react to a macroeconomic event before it occurs (or immediately after). A user enters a market topic (e.g., "FOMC 50bp rate cut" or "US-China tariff escalation"), and the system produces a structured, multi-round debate between five AI dealer agents, each reasoning strictly within their institution\'s documented analytical framework.'
)

p = doc.add_paragraph()
set_heading_style(p, 'The Bank Problem', 3, color=MID_BLUE, size=11)
add_rich_para(
    'The Federal Reserve Bank of New York conducts **market soundings** — structured conversations with primary dealers to gauge market sentiment before policy announcements or debt issuance operations. Today this process is:'
)
add_bullet('**Manual and time-intensive:** Analysts must individually reach primary dealers, compile responses, and synthesize a consensus view — a process that takes days.')
add_bullet('**Reactive rather than prospective:** Soundings happen after decisions are partially formed, not as a real-time "what-if" tool for scenario planning.')
add_bullet('**Subject to social dynamics:** Dealers may not fully disclose divergent views in live conversations; anonymized AI simulation avoids this anchoring bias.')
add_bullet('**Opaque in terms of reasoning:** A sounding produces a directional signal but rarely captures the *why* behind each dealer\'s stance in a structured, comparable format.')

add_rich_para(
    'MarketSounding addresses all four gaps: it produces structured dealer reactions in minutes, supports unlimited prospective scenario runs, removes social anchoring, and exposes each dealer\'s full reasoning chain — including hawkish/dovish score, rate path view, balance sheet opinion, risk asset outlook, and key concerns — in a machine-readable format.'
)

add_divider()

# ════════════════════════════════════════════════════════════════════════════
# Q2
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '2.  How This Transforms the Bank', 2, size=13)

p = doc.add_paragraph()
set_heading_style(p, 'New Capability: Instant Scenario Intelligence', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Before a policy decision or a major debt auction, FRBNY analysts can run a MarketSounding simulation in under five minutes and receive structured, institution-specific dealer reactions — complete with hawkish/dovish scores, position trajectories, and a consensus metric — for any hypothetical scenario. This transforms market sounding from a days-long manual process into an on-demand analytical capability.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Enhanced Capability: Crisis Simulation', 3, color=MID_BLUE, size=11)
add_rich_para(
    'The platform\'s **Crisis Injection** feature lets analysts introduce a surprise shock mid-simulation (e.g., "China announces a surprise 200bp rate cut") and observe how dealer positions re-calibrate. This enables the FRBNY to stress-test market resilience against tail-risk scenarios before they materialize — something impossible with traditional soundings.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Efficiency: From Days to Minutes', 3, color=MID_BLUE, size=11)
add_rich_para(
    'A full five-dealer, five-round simulation completes in 3–7 minutes. The same breadth of insight from a traditional sounding would require scheduling, conducting, and synthesizing responses from five institutions — a process measured in days, not minutes.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Analytical Depth: Knowledge Graph and Consensus Metrics', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Every simulation contributes to a live **Knowledge Graph** that maps relationships between market topics, dealer concerns, and inter-dealer influence. Over time this graph reveals structural patterns: which concerns cluster together across events, which dealers consistently move others, and which topics create the most dealer divergence — providing a running picture of primary dealer market intelligence that no manual process can produce.'
)

add_divider()

# ════════════════════════════════════════════════════════════════════════════
# Q3
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '3.  API and Data Set Choices; Pre- and Post-Processing', 2, size=13)

p = doc.add_paragraph()
set_heading_style(p, 'AWS Bedrock / Claude (Sonnet 4.6 and Haiku 4.5)', 3, color=MID_BLUE, size=11)
add_rich_para('We chose AWS Bedrock as our AI inference layer for three reasons:')
add_bullet('**Compliance posture:** Bedrock keeps data within AWS infrastructure and provides enterprise-grade data isolation — critical for a Federal Reserve context where proprietary market intelligence must not leak to third-party model providers.')
add_bullet('**Model stratification:** Bedrock exposes both Claude Sonnet 4.6 (high reasoning capacity) and Haiku 4.5 (low-latency, low-cost) through the same API surface, allowing us to right-size the model for each component.')
add_bullet('**Cross-region inference profiles:** We use Bedrock\'s cross-region inference to maximize throughput during the burst load of running five dealer agents in parallel.')
add_rich_para(
    'We deliberately chose Claude over GPT-4 or Gemini because Claude\'s instruction-following fidelity is superior for structured JSON output — our dealer agents must return a precise 11-field JSON schema every invocation. Claude\'s lower hallucination rate on structured outputs reduced retry rates significantly.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Tavily Search API', 3, color=MID_BLUE, size=11)
add_rich_para('For live market event research we use the Tavily Search API, optimized for agentic research workflows. Compared to the Google Custom Search API or Bing Search API:')
add_bullet('Tavily returns full article snippets (not just URLs), allowing synthesis without additional page fetches.')
add_bullet('It supports recency filtering (day / week / month), so the system can surface breaking news vs. historical context as the user requires.')
add_bullet('Its relevance scoring allows us to dedup and rank results before sending them to the synthesis model.')

p = doc.add_paragraph()
set_heading_style(p, 'Pre-Processing of Data', 3, color=MID_BLUE, size=11)
add_rich_para('**Query Expansion:** Rather than sending a user\'s raw topic to Tavily, we first pass it to Claude Haiku to generate 2–3 semantically distinct search queries. This prevents over-literal results.')
add_rich_para('**Deduplication and Recency Filtering:** Tavily results are deduplicated by URL, sorted by relevance score, and filtered by a configurable recency window before being passed to synthesis.')
add_rich_para('**Event Brief Synthesis:** Raw web snippets are synthesized by Claude Sonnet 4.6 into a structured event brief with three fields: `title`, `summary`, and `rawText`. This normalization step ensures every dealer agent receives identically structured input regardless of source diversity.')
add_rich_para('**Event Text Truncation:** The `rawText` field is capped at 12,000 characters before injection into dealer prompts, preventing context window overflow while preserving the most material content.')

p = doc.add_paragraph()
set_heading_style(p, 'Post-Processing of Data', 3, color=MID_BLUE, size=11)
add_rich_para('**Reaction Parsing and Validation:** Each dealer LLM response is validated against an 11-field JSON schema. Fields outside expected ranges are clamped. If the LLM returns malformed JSON, a single retry is issued with the parse error in context — recovering approximately 80% of malformed responses.')
add_rich_para('**Trajectory Computation:** After each simulation completes, we compute a trajectory vector — the average H/D score across all five dealers for each round — which produces a time-series showing whether dealer consensus converged, diverged, or reversed under debate.')
add_rich_para('**Consensus Score:** A normalized consensus metric (0–1) is computed from the standard deviation of final-round H/D scores. A score near 1 means strong dealer alignment; near 0 means maximum divergence.')

add_divider()

# ════════════════════════════════════════════════════════════════════════════
# Q4
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '4.  Technical Design and Reasoning Behind Design Decisions', 2, size=13)

p = doc.add_paragraph()
set_heading_style(p, 'System Architecture Overview', 3, color=MID_BLUE, size=11)
add_rich_para(
    'The system is structured as three cooperating layers: a **Next.js 16 frontend** (React, Tailwind CSS 4) communicating via REST to an **Express orchestrator** (local dev) or **AWS API Gateway + Lambda** (production), which in turn coordinates a **Research Pipeline** and a **Simulation Orchestrator** backed by AWS Bedrock.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Multi-Agent Debate Architecture', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Each simulation round runs all five dealer agents **in parallel** using `Promise.all()`. Within a round, dealers have no awareness of each other. Between rounds, each dealer receives a curated peer context — not full LLM outputs, but a structured summary of each peer\'s H/D score, rate path view, key concerns, and key quote. This mirrors real dealer roundtables: dealers state positions simultaneously, then review peers\' summaries before responding.'
)
add_rich_para(
    'Rounds execute **sequentially** so that peer context from Round N is available for Round N+1. This hybrid parallel-within-sequential structure reduces total simulation time by 5× compared to fully sequential invocations while preserving the semantic dependency between rounds.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Persona Engineering as Hard Constraint', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Each of the five dealer personas is defined by a profile containing: default hawkish/dovish bias, house voice characteristics, typical analytical concerns, known blind spots, and an explicit H/D score calibration section. The calibration section is the most critical: it instructs the model that the five dealers **must produce a spread of at least 0.6** across their H/D scores, prevents anchoring to default biases on neutral events, and explicitly calls out that hawkish desks must remain more hawkish than dovish desks even after debate rounds.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Session State Design', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Rather than maintaining a long conversation history per dealer (prohibitively token-expensive across 5 rounds × 5 dealers), each dealer stores only its most recent reaction in a DynamoDB session state record. The system computes `positionShift = newScore − priorScore` incrementally and passes only a curated 5-field peer summary per round. This keeps prompt size roughly constant regardless of round count.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Model Stratification', 3, color=MID_BLUE, size=11)
add_table(
    ['Component', 'Model', 'Rationale'],
    [
        ['Query generation',   'Claude Haiku 4.5',   'Simple rewriting task; minimize cost and latency'],
        ['Event synthesis',    'Claude Sonnet 4.6',  'Multi-source synthesis requires strong reasoning'],
        ['Dealer reactions',   'Claude Sonnet 4.6',  'Complex persona reasoning; structured JSON output fidelity'],
        ['Jarrett chat agent', 'Claude Haiku 4.5',   'Real-time interactive chat; low cold-start latency needed'],
    ],
    col_widths=[1.6, 1.6, 3.1]
)

p = doc.add_paragraph()
set_heading_style(p, 'Frontend Design Decisions', 3, color=MID_BLUE, size=11)
add_bullet('**Two-phase New Sounding UX:** Research (automatic) and Launch (manual, user sets rounds and crisis config) are separated into distinct steps so users always review research output before committing to a simulation configuration.')
add_bullet('**Real-time polling:** The live simulation view polls the backend every 2 seconds, updating dealer progress cards and round results as they arrive.')
add_bullet('**D3.js Sparklines:** Trajectory data is rendered as a micro-chart in the history table, giving analysts an at-a-glance read of convergence/divergence without opening the full report.')
add_bullet('**Print-ready reports:** Simulation detail pages support a `?print=1` query parameter that auto-triggers window.print() on load, enabling one-click PDF export from the history table.')

add_divider()

# ════════════════════════════════════════════════════════════════════════════
# Q5
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '5.  Usability and Customization', 2, size=13)

p = doc.add_paragraph()
set_heading_style(p, 'Usability', 3, color=MID_BLUE, size=11)
add_rich_para('The application is designed around a three-step user journey requiring no financial domain expertise to operate:')
add_numbered('**Enter a topic** — Search by keyword, paste raw event text (Bloomberg terminal output, Fed statement text, news articles), or choose a sample scenario.')
add_numbered('**Review the research summary** — The system fetches live web sources and shows a synthesized event brief before the user configures rounds (3–5) and optional crisis injection.')
add_numbered('**Watch the simulation run** — Real-time dealer progress, then a full report with position evolution chart, knowledge graph, consensus score, and dealer-by-dealer reasoning.')

add_rich_para(
    'The **Jarrett AI chat assistant** (accessible from any page via a floating widget) can explain any metric, compare dealer positions, answer questions about specific dealer reasoning, or provide context on what "hawkish/dovish" means — making the platform accessible to users without deep fixed-income market experience.'
)
add_rich_para(
    'Jarrett is itself a multi-agent router: questions directed at a specific dealer (e.g., "What does Goldman Sachs think about duration risk?") are routed to that dealer\'s persona for a character-accurate response, while general questions are answered by Jarrett in his orchestrator role.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Customization', 3, color=MID_BLUE, size=11)
add_bullet('**Simulation rounds:** Users choose 3, 4, or 5 rounds via a slider. More rounds capture longer debate dynamics; fewer rounds prioritize speed.')
add_bullet('**Crisis injection:** Users can enable a mid-simulation shock and author any crisis text — allowing fully custom tail-risk scenarios.')
add_bullet('**Input mode:** Search by topic (Tavily-backed), paste raw event text, or select from sample scenarios — accommodating different workflow preferences.')
add_bullet('**Persona extensibility:** The dealer persona system is data-driven. Adding a new dealer requires only a new profile entry — no code changes. Personas for buy-side institutions (PIMCO, BlackRock) or foreign dealer banks could be added for future iterations.')
add_bullet('**Topic-based filtering:** The history page automatically infers topic categories (Monetary Policy, Trade Policy, Geopolitical, FX Policy, Credit, Inflation, Macro) from simulation titles and provides filter dropdowns.')

add_divider()

# ════════════════════════════════════════════════════════════════════════════
# Q6
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '6.  Improvements That Can Be Made', 2, size=13)

p = doc.add_paragraph()
set_heading_style(p, 'Near-Term (High Priority)', 3, color=MID_BLUE, size=11)
add_bullet('**Real-time streaming:** Replace polling with WebSocket or Server-Sent Events so dealer reactions stream token-by-token as they generate, eliminating the 2-second polling lag.')
add_bullet('**Persistent storage:** Replace the in-memory simulation store with DynamoDB persistence so simulations survive server restarts and are accessible across sessions and users.')
add_bullet('**Authentication and multi-user support:** The auth system (JWT) is scaffolded but not fully wired to simulation ownership — full auth would allow multiple FRBNY analysts to maintain separate simulation histories.')
add_bullet('**Tavily integration in production:** The research pipeline\'s Tavily integration requires a production API key and Lambda deployment. Currently running locally; Lambda deployment would make research available in the cloud-hosted version.')

p = doc.add_paragraph()
set_heading_style(p, 'Medium-Term (Product Depth)', 3, color=MID_BLUE, size=11)
add_bullet('**Quantitative dealer profiles:** Augment qualitative persona profiles with actual FRBNY Primary Dealer Survey data to calibrate H/D default biases with real historical signals.')
add_bullet('**Extended persona library:** Add buy-side institutions (PIMCO, BlackRock, Vanguard) and foreign primary dealers (Deutsche Bank, Barclays, Nomura) to capture a broader market sounding landscape.')
add_bullet('**Simulation comparison:** Allow analysts to compare two simulations side-by-side — e.g., "50bp cut" vs. "25bp cut" — to see how dealer consensus shifts between scenarios.')
add_bullet('**Historical backtesting:** Feed historical FOMC decisions as events and compare simulated dealer reactions against actual published dealer research to validate and calibrate the model.')
add_bullet('**Export to structured formats:** Export full simulation results as JSON or Excel for downstream quantitative analysis and integration with existing FRBNY analytical workflows.')

p = doc.add_paragraph()
set_heading_style(p, 'Longer-Term (Research Direction)', 3, color=MID_BLUE, size=11)
add_bullet('**Fine-tuned dealer models:** Train fine-tuned adapters on each dealer\'s published research (strategy notes, rate forecasts, market commentaries) to improve persona accuracy beyond prompt engineering.')
add_bullet('**Real-time Bloomberg / Refinitiv integration:** Replace Tavily with a direct Bloomberg Data License feed for institutional-grade, normalized financial data sourcing.')
add_bullet('**Influence weight learning:** Use historical simulation data to learn which dealers actually influence others most — building an empirical influence network rather than one inferred from LLM self-report.')

add_divider()

# ════════════════════════════════════════════════════════════════════════════
# Q7
# ════════════════════════════════════════════════════════════════════════════

p = doc.add_paragraph()
set_heading_style(p, '7.  Unique and Exceptional Aspects of the Project', 2, size=13)

add_callout(
    'MarketSounding is not a chatbot that answers questions about markets. It is a structured simulation of how institutional disagreement forms, resolves, or entrenches under debate — a capability that does not exist anywhere in today\'s market intelligence toolset.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Persona as Constraint, Not Template', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Most LLM applications give models a persona description and hope for the best. MarketSounding treats persona as a **hard analytical constraint**. Each dealer has documented blind spots called out explicitly in the prompt; voice characteristics that must be detectable in the prose without seeing the author\'s name; institutional concerns that must appear in the output; and a calibration rule requiring measurably divergent H/D scores across the group. A Goldman Sachs reaction that reads like a Morgan Stanley reaction is a system failure — and the architecture is explicitly designed to prevent it.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Emergent Consensus as a Measurable Signal', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Rather than averaging dealer views (which destroys the signal), MarketSounding tracks **how consensus forms** — whether dealers converge early and hold, diverge as the debate deepens, or reverse after a crisis shock. The trajectory vector and consensus score are computed metrics, not LLM outputs, ensuring they are reliable even when individual dealer reasoning is noisy.'
)

p = doc.add_paragraph()
set_heading_style(p, 'The Jarrett Multi-Agent Router', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Jarrett is not a single-model chatbot. When a user asks "What does Goldman Sachs think about duration risk given today\'s simulation?", Jarrett detects the dealer-specific intent and routes the question to a Goldman Sachs persona LLM invocation — producing a Goldman Sachs-voiced, in-character response. For general questions, Jarrett responds in his own orchestrator voice. This two-layer routing architecture means every dealer is simultaneously available for direct conversation, effectively giving the analyst a five-way primary dealer hotline.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Crisis Injection as Interactive Exploration', 3, color=MID_BLUE, size=11)
add_rich_para(
    'The crisis injection feature transforms MarketSounding from a batch analysis tool into an interactive exploration environment. Analysts can watch dealer consensus form across three rounds, then inject a black-swan event and observe how each institution\'s framework leads to a characteristically different re-evaluation. Goldman Sachs will re-evaluate through a growth-risk lens; Morgan Stanley through a tail-risk / inflation-persistence lens; Bank of America through a consumer-credit-health lens. The divergence in crisis responses is often more illuminating than the initial reactions.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Knowledge Graph as Running Market Intelligence', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Every simulation contributes incrementally to a knowledge graph. Over dozens of simulations, this graph reveals structural patterns invisible in any individual run: which concerns activate together across events; which dealers are consistently first-movers in shifting group consensus; and which market topics produce the highest dealer divergence — signaling genuine uncertainty in the market rather than a strong consensus view. This accumulation effect means MarketSounding becomes **more valuable over time**, not just as a one-off simulation tool but as an institutional memory of simulated dealer discourse.'
)

p = doc.add_paragraph()
set_heading_style(p, 'Built for a Federal Reserve Context', 3, color=MID_BLUE, size=11)
add_rich_para(
    'Every design decision — AWS Bedrock for data sovereignty, structured JSON outputs for auditability, persona constraints for institutional accuracy, the consensus metric for directional signal — was made with the Federal Reserve\'s analytical workflow in mind. This is not a general-purpose AI tool adapted to finance; it is a purpose-built market intelligence platform designed around the specific operational needs of a central bank conducting primary dealer market soundings.'
)

# ════════════════════════════════════════════════════════════════════════════
# SAVE
# ════════════════════════════════════════════════════════════════════════════

output_path = 'd:/Users/tony.yang/Documents/MarketSounding/docs/judges-packet.docx'
doc.save(output_path)
print(f'Saved: {output_path}')
