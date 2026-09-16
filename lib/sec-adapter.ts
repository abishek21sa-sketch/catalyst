import type { Event, ResearchSnapshot } from './domain';

type RawFact = { concept: string; label: string; value: number; unit: string; period: string; filed: string; form: string; accession: string };
const filingUrl = 'https://www.sec.gov/Archives/edgar/data/789019/000095017024087843/msft-20240630.htm';
const accession = '0000950170-24-087843';

// Small, checked-in fallback captured from SEC EDGAR for deterministic local runs.
const rawFacts: RawFact[] = [
  { concept: 'Revenues', label: 'Revenue', value: 245122000000, unit: 'USD', period: 'FY 2024', filed: '2024-07-30', form: '10-K', accession },
  { concept: 'OperatingIncomeLoss', label: 'Operating income', value: 109433000000, unit: 'USD', period: 'FY 2024', filed: '2024-07-30', form: '10-K', accession },
  { concept: 'NetIncomeLoss', label: 'Net income', value: 88136000000, unit: 'USD', period: 'FY 2024', filed: '2024-07-30', form: '10-K', accession },
];
const asBillions = (value: number) => value / 1_000_000_000;
const money = (value: number) => `$${asBillions(value).toFixed(1)}B`;

export function loadSecFixture(): ResearchSnapshot {
  const [revenue, operatingIncome, netIncome] = rawFacts;
  const filingEvidence = (label: string, fact: RawFact) => ({ label, concept: fact.concept, value: money(fact.value), unit: fact.unit, sourceUrl: filingUrl, sourceLabel: `SEC EDGAR · ${fact.form} · ${fact.filed}` });
  const events: Event[] = [
    { id: 'filing-10k-2024', date: '2024-07-30', kind: 'filing', title: 'FY24 10-K filed', summary: 'Annual filing lands with a complete, machine-readable operating snapshot.', signal: 'neutral', sourceLabel: 'SEC EDGAR · filing metadata', confidence: 1, evidence: [{ label: 'Period of report', concept: 'DocumentPeriodEndDate', value: '2024-06-30', unit: 'date', sourceUrl: filingUrl, sourceLabel: 'SEC EDGAR · 10-K · 2024-07-30' }, filingEvidence('Revenue', revenue)] },
    { id: 'metric-growth-2024', date: '2024-06-30', kind: 'metric', title: 'Scale compounds into the close', summary: 'Revenue reaches $245.1B while operating income clears $109.4B.', signal: 'positive', sourceLabel: 'SEC EDGAR · normalized company facts', confidence: 0.96, evidence: [filingEvidence('Revenue', revenue), filingEvidence('Operating income', operatingIncome)] },
    { id: 'metric-margin-2024', date: '2024-06-30', kind: 'metric', title: 'Profit conversion stays resilient', summary: 'Net income holds at $88.1B, implying a 35.9% net margin on the fixture.', signal: 'positive', sourceLabel: 'SEC EDGAR · normalized company facts', confidence: 0.93, evidence: [filingEvidence('Net income', netIncome), filingEvidence('Revenue denominator', revenue)] },
    { id: 'hypothesis-ai-capex', date: '2024-05-21', kind: 'hypothesis', title: 'AI infrastructure can widen the moat', summary: 'Working hypothesis: capex intensity converts into durable cloud pricing power.', signal: 'watch', sourceLabel: 'Catalyst research · hypothesis queue', confidence: 0.58, evidence: [{ label: 'Anchor filing', concept: 'AccessionNumber', value: accession, unit: 'identifier', sourceUrl: filingUrl, sourceLabel: 'SEC EDGAR · linked anchor' }] },
  ];
  return {
    company: { id: 'company-msft', ticker: 'MSFT', name: 'Microsoft Corporation', cik: '0000789019', exchange: 'NASDAQ', sector: 'Software infrastructure' },
    filings: [{ id: 'filing-msft-10k-2024', form: '10-K', filedAt: '2024-07-30', periodEnd: '2024-06-30', accession, sourceUrl: filingUrl, status: 'fixture' }],
    metrics: [
      { id: 'revenue', label: 'Revenue', concept: revenue.concept, value: revenue.value, unit: 'USD', period: revenue.period, yoy: 16 },
      { id: 'operating-income', label: 'Operating income', concept: operatingIncome.concept, value: operatingIncome.value, unit: 'USD', period: operatingIncome.period, yoy: 24 },
      { id: 'net-income', label: 'Net income', concept: netIncome.concept, value: netIncome.value, unit: 'USD', period: netIncome.period, yoy: 21 },
    ], events, hypotheses: [
      { id: 'h-ai-moat', title: 'AI infrastructure can widen the moat', status: 'testing', description: 'Track capex, Azure growth, and margin response across subsequent filings.', evidenceIds: ['hypothesis-ai-capex'] },
      { id: 'h-breadth', title: 'Growth broadens beyond the cloud', status: 'parked', description: 'Needs segment-level evidence before it can move into a study.', evidenceIds: [] },
    ], studies: [
      { id: 'study-cloud', title: 'Cloud monetization watch', owner: 'AT', state: 'active', updatedAt: '2h ago' },
      { id: 'study-margin', title: 'Margin durability screen', owner: 'ML', state: 'queued', updatedAt: 'Yesterday' },
    ], provenance: { adapter: 'SEC EDGAR company-facts / filing adapter', capturedAt: '2024-07-30T16:06:22Z', fixture: 'fixtures/sec/msft-fy24.json' },
  };
}
export function formatMetric(value: number) { return `$${asBillions(value).toFixed(1)}B`; }
export function margin(netIncome: number, revenue: number) { return ((netIncome / revenue) * 100).toFixed(1); }
