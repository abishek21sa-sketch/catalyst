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
    const payload = (await response.json()) as { entityName?: string; facts?: Record<string, Record<string, { units?: Record<string, Array<{ val: number; end?: string; filed?: string; form?: string; fp?: string; fy?: number }>> }>> };
    const usGaap = payload.facts?.['us-gaap'] ?? {};
    const concepts = ['Revenues', 'OperatingIncomeLoss', 'NetIncomeLoss'].filter((concept) => concept in usGaap);
    const metricConcepts = { revenue: 'Revenues', operatingIncome: 'OperatingIncomeLoss', netIncome: 'NetIncomeLoss' } as const;
    const metrics = Object.fromEntries(Object.entries(metricConcepts).flatMap(([key, concept]) => {
      const rows = usGaap[concept]?.units?.USD ?? [];
      const annual = rows.filter((row) => row.form === '10-K' && row.fp === 'FY').sort((a, b) => `${b.filed ?? ''}${b.end ?? ''}`.localeCompare(`${a.filed ?? ''}${a.end ?? ''}`))[0];
      return annual ? [[key, annual.val]] : [];
    }));
    return Response.json({ mode: 'live', entityName: payload.entityName ?? 'Unknown filer', cik, concepts, metrics, sourceUrl, fetchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    const fallback = loadSecFixture();
    return Response.json({ mode: 'fixture-fallback', entityName: fallback.company.name, cik: fallback.company.cik, concepts: fallback.metrics.map((metric) => metric.concept), sourceUrl: fallback.filings[0].sourceUrl, fetchedAt: fallback.provenance.capturedAt }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
