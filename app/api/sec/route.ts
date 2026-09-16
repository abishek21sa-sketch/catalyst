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
    const concepts = ['Revenues', 'OperatingIncomeLoss', 'NetIncomeLoss'].filter((concept) => concept in usGaap);
    const metricConcepts = { revenue: 'Revenues', operatingIncome: 'OperatingIncomeLoss', netIncome: 'NetIncomeLoss' } as const;
    const metrics = Object.fromEntries(Object.entries(metricConcepts).flatMap(([key, concept]) => {
      const rows = usGaap[concept]?.units?.USD ?? [];
      const annual = rows.filter((row) => row.form === '10-K' && row.fp === 'FY').sort((a, b) => `${b.filed ?? ''}${b.end ?? ''}`.localeCompare(`${a.filed ?? ''}${a.end ?? ''}`))[0];
      return annual ? [[key, annual.val]] : [];
    }));
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
    return Response.json({ mode: 'live', entityName: payload.entityName ?? 'Unknown filer', cik, concepts, metrics, filings, sourceUrl, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    const fallback = loadSecFixture();
    return Response.json({ mode: 'fixture-fallback', entityName: fallback.company.name, cik: fallback.company.cik, concepts: fallback.metrics.map((metric) => metric.concept), filings: fallback.filings, sourceUrl: fallback.filings[0].sourceUrl, fetchedAt: fallback.provenance.capturedAt }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
