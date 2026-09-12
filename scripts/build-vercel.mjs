import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const functionDirectory = path.join(process.cwd(), '.vercel', 'output', 'functions', 'api', 'sec.func');

const functionSource = String.raw`const fixture = {
  mode: 'fixture-fallback',
  entityName: 'Microsoft Corporation',
  cik: '0000789019',
  concepts: ['Revenues', 'OperatingIncomeLoss', 'NetIncomeLoss'],
  sourceUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000095017024087843/msft-20240630.htm',
  fetchedAt: '2024-07-30T16:06:22Z',
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

export default async function handler(request) {
  const cik = new URL(request.url).searchParams.get('cik') ?? '';
  if (!/^\d{10}$/.test(cik)) return json({ error: 'Expected a 10-digit SEC CIK.' }, 400);

  const sourceUrl = 'https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json';
  try {
    const response = await fetch(sourceUrl, { headers: { 'User-Agent': 'Catalyst research client' } });
    if (!response.ok) throw new Error('SEC responded with ' + response.status);
    const payload = await response.json();
    const usGaap = payload.facts?.['us-gaap'] ?? {};
    const concepts = ['Revenues', 'OperatingIncomeLoss', 'NetIncomeLoss'].filter((concept) => concept in usGaap);
    const metricConcepts = { revenue: 'Revenues', operatingIncome: 'OperatingIncomeLoss', netIncome: 'NetIncomeLoss' };
    const metrics = Object.fromEntries(Object.entries(metricConcepts).flatMap(([key, concept]) => {
      const rows = usGaap[concept]?.units?.USD ?? [];
      const annual = rows.filter((row) => row.form === '10-K' && row.fp === 'FY').sort((a, b) => ((b.filed ?? '') + (b.end ?? '')).localeCompare((a.filed ?? '') + (a.end ?? '')))[0];
      return annual ? [[key, annual.val]] : [];
    }));
    return json({ mode: 'live', entityName: payload.entityName ?? 'Unknown filer', cik, concepts, metrics, sourceUrl, fetchedAt: new Date().toISOString() });
  } catch {
    return json({ ...fixture, cik, sourceUrl: fixture.sourceUrl }, 200, { 'Cache-Control': 'no-store' });
  }
}
`;

await mkdir(functionDirectory, { recursive: true });
await writeFile(path.join(functionDirectory, '.vc-config.json'), JSON.stringify({ runtime: 'edge', entrypoint: 'index.mjs' }, null, 2) + '\n');
await writeFile(path.join(functionDirectory, 'index.mjs'), functionSource);

const outputConfigPath = path.join(process.cwd(), '.vercel', 'output', 'config.json');
const outputConfig = JSON.parse(await readFile(outputConfigPath, 'utf8'));
outputConfig.routes = [
  { src: '^/api/sec(?:/)?$', dest: '/api/sec' },
  ...(outputConfig.routes ?? []),
];
await writeFile(outputConfigPath, JSON.stringify(outputConfig, null, 2) + '\n');
console.log('Added Vercel Edge Function: /api/sec');
