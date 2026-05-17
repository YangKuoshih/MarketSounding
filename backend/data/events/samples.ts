/**
 * Pre-configured sample events for the dashboard and New Sounding page.
 * Accessible via GET /events/samples without authentication.
 *
 * These give users a way to try the simulation without running web research.
 */

export interface SampleEvent {
  id: string;
  title: string;
  summary: string;
  rawText: string;
  eventDate: string;
  category: 'monetary_policy' | 'trade_policy' | 'geopolitical' | 'fx_policy' | 'credit';
  icon: 'newspaper' | 'trending' | 'globe';
}

export const sampleEvents: SampleEvent[] = [
  {
    id: 'fomc-june-2026',
    title: 'FOMC June 2026 Decision',
    summary:
      'Markets pricing 25bp cut with 60% probability after softer CPI print',
    rawText: `The Federal Reserve enters its June 2026 FOMC meeting against a backdrop of moderating inflation and softening labor market data. May headline CPI printed at 2.4% YoY (consensus 2.5%), while core CPI eased to 2.7% YoY (consensus 2.8%).

Job openings have declined to 7.8M from 8.4M three months prior, and the unemployment rate has drifted higher to 4.3%. Wage growth as measured by Atlanta Fed Wage Tracker has moderated to 3.9% YoY from peaks above 5%.

Fed funds futures are pricing approximately 60% probability of a 25bp cut at this meeting, with full pricing of two cuts by year-end. The dot plot from the March SEP showed median FOMC participant expecting two cuts in 2026 and three cuts in 2027.

Key questions for dealers: Does the recent data justify a cut, or is the Fed inclined to wait for more confirmation? How will the dot plot evolve? What signals will the Chair give about the path beyond June?`,
    eventDate: '2026-06-12',
    category: 'monetary_policy',
    icon: 'newspaper',
  },
  {
    id: 'tariffs-china',
    title: 'US-China Tariff Escalation',
    summary:
      'New 25% tariffs on $200B in goods; retaliatory measures expected within 48h',
    rawText: `The Trump administration announced new 25% tariffs covering $200B of Chinese imports, citing intellectual property concerns and persistent trade deficits. The new tariffs cover technology, machinery, automotive components, and consumer electronics, with implementation effective in 30 days.

Chinese officials have stated retaliatory measures will be announced within 48 hours, with reports suggesting tariffs on US agricultural products, aircraft, and energy exports. Currency markets are watching CNY/USD closely as PBoC may allow further depreciation as a partial offset.

Equity markets opened lower with semiconductors and machinery names down 4-7%. Treasury yields fell 8-10bp on flight-to-quality flows. The 2s10s curve flattened modestly.

Key questions for dealers: How will the tariff escalation flow through to inflation? Does this change the Fed's reaction function? What is the likelihood of further escalation vs. negotiated resolution?`,
    eventDate: '2026-04-08',
    category: 'trade_policy',
    icon: 'trending',
  },
  {
    id: 'oil-supply-shock',
    title: 'Middle East Oil Supply Shock',
    summary:
      'Strait of Hormuz disruption takes 20% of global supply offline for 72h',
    rawText: `An attack on critical oil infrastructure in the Strait of Hormuz has taken approximately 20% of global oil supply offline for at least 72 hours. Oil benchmarks have spiked: Brent up 15% to $98/bbl, WTI up 14% to $94/bbl. Insurance and shipping rates for the Persian Gulf are surging.

Equity markets are mixed: energy names sharply higher, but broader market down 2-3% on growth concerns. Treasury yields up 5-8bp on inflation reflation, with breakevens widening 12-15bp. The dollar is firmer on safe-haven demand.

White House has signaled potential SPR releases, and IEA member coordination on emergency stockpile draws is reportedly under discussion. Saudi Arabia has stated it can ramp spare capacity within 7-10 days.

Key questions for dealers: Is this a transitory supply shock or sustained? How does the Fed think about supply-side inflation pressures? Does this raise recession probability through the consumer-spending channel?`,
    eventDate: '2026-03-15',
    category: 'geopolitical',
    icon: 'globe',
  },
];

export function getSampleEvent(id: string): SampleEvent | null {
  return sampleEvents.find((e) => e.id === id) || null;
}
