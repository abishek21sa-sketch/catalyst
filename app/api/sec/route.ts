import { loadSecFixture } from '../../../lib/sec-adapter';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cik = new URL(request.url).searchParams.get('cik') ?? '';
  if (!/^\d{10}$/.test(cik)) {
    return Response.json({ error: 'Expected a 10-digit SEC CIK.' }, { status: 400 });
  }

  const sourceUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'User-Agent': 'Catalyst research client' },
      cf: { cacheTtl: 300 },
    } as RequestInit);
    if (!response.ok) throw new Error(`SEC responded with ${response.status}`);
    type FactRow = { val: number; end?: string; filed?: string; form?: string; fp?: string; fy?: number; accn?: string };
    const payload = (await response.json()) as { entityName?: string; facts?: Record<string, Record<string, { units?: Record<string, FactRow[]> }>> };
    const usGaap = payload.facts?.['us-gaap'] ?? {};
    const annualRows = (concept: string) => (usGaap[concept]?.units?.USD ?? [])
      .filter((row) => row.form === '10-K' && row.fp === 'FY')
      .sort((a, b) => `${b.filed ?? ''}${b.end ?? ''}`.localeCompare(`${a.filed ?? ''}${a.end ?? ''}`));
    const metricCandidates = {
      revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues'],
      operatingIncome: ['OperatingIncomeLoss'],
      netIncome: ['NetIncomeLoss'],
    } as const;
    const metricConcepts = Object.fromEntries(Object.entries(metricCandidates).map(([key, candidates]) => [key, candidates.find((concept) => annualRows(concept).length > 0) ?? candidates[0]])) as Record<keyof typeof metricCandidates, string>;
    const concepts = Object.values(metricConcepts).filter((concept) => concept in usGaap);
    const metrics = Object.fromEntries(Object.entries(metricConcepts).flatMap(([key, concept]) => {
      const annual = annualRows(concept)[0];
      return annual ? [[key, annual.val]] : [];
    }));
    const priorMetrics = Object.fromEntries(Object.entries(metricConcepts).flatMap(([key, concept]) => {
      const prior = annualRows(concept)[1];
      return prior ? [[key, prior.val]] : [];
    }));
    const periods = Object.fromEntries(Object.entries(metricConcepts).flatMap(([key, concept]) => {
      const annual = annualRows(concept)[0];
      return annual ? [[key, annual.fy ? `FY ${annual.fy}` : annual.end ?? annual.filed ?? 'Annual']] : [];
    }));
    const currentPeriodEnds = Object.values(metricConcepts).map((concept) => annualRows(concept)[0]?.end).filter((value): value is string => Boolean(value));
    const priorPeriodEnds = Object.values(metricConcepts).map((concept) => annualRows(concept)[1]?.end).filter((value): value is string => Boolean(value));
    const duplicateFacts = Object.values(metricConcepts).reduce((total, concept) => {
      const keys = annualRows(concept).map((row) => `${row.accn ?? ''}|${row.end ?? ''}|${row.filed ?? ''}|${row.val}`);
      return total + keys.length - new Set(keys).size;
    }, 0);
    const amendedFilings = Object.values(metricConcepts).reduce((total, concept) => total + (usGaap[concept]?.units?.USD ?? []).filter((row) => row.form === '10-K/A' && row.fp === 'FY').length, 0);
    const quality = {
      status: currentPeriodEnds.length === Object.keys(metricConcepts).length && new Set(currentPeriodEnds).size === 1 && duplicateFacts === 0 ? 'pass' as const : 'review' as const,
      currentPeriod: currentPeriodEnds[0] ?? null,
      priorPeriod: priorPeriodEnds[0] ?? null,
      alignedCurrentPeriod: currentPeriodEnds.length === Object.keys(metricConcepts).length && new Set(currentPeriodEnds).size === 1,
      alignedPriorPeriod: priorPeriodEnds.length === Object.keys(metricConcepts).length && new Set(priorPeriodEnds).size === 1,
      duplicateFacts,
      amendedFilings,
      missingMetrics: Object.keys(metricConcepts).length - Object.keys(metrics).length,
    };
    const filingRows = new Map<string, FactRow>();
    for (const concept of Object.values(metricConcepts)) {
      for (const row of usGaap[concept]?.units?.USD ?? []) {
        if (row.form === '10-K' && row.fp === 'FY' && row.accn && row.filed) filingRows.set(row.accn, row);
      }
    }
    const filings = Array.from(filingRows.entries())
      .sort(([, a], [, b]) => `${b.filed ?? ''}${b.end ?? ''}`.localeCompare(`${a.filed ?? ''}${a.end ?? ''}`))
      .slice(0, 6)
      .map(([accession, row]) => ({
        id: `filing-${accession}`,
        form: row.form ?? '10-K',
        filedAt: row.filed ?? row.end ?? '',
        periodEnd: row.end ?? row.filed ?? '',
        accession,
        sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll('-', '')}/${accession}-index.html`,
        status: 'verified' as const,
      }));
    return Response.json({ mode: 'live', entityName: payload.entityName ?? 'Unknown filer', cik, concepts, metrics, priorMetrics, periods, quality, filings, sourceUrl, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    const fallback = loadSecFixture();
    return Response.json({ mode: 'fixture-fallback', entityName: fallback.company.name, cik: fallback.company.cik, concepts: fallback.metrics.map((metric) => metric.concept), quality: { status: 'fixture' as const, currentPeriod: '2024-06-30', priorPeriod: null, alignedCurrentPeriod: true, alignedPriorPeriod: false, duplicateFacts: 0, amendedFilings: 0, missingMetrics: 0 }, filings: fallback.filings, sourceUrl: fallback.filings[0].sourceUrl, fetchedAt: fallback.provenance.capturedAt }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
