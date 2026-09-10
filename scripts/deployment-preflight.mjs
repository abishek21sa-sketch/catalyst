import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function requireFile(relativePath, description) {
  if (!fs.existsSync(absolute(relativePath))) {
    failures.push(`${description}: missing ${relativePath}`);
  }
}

function readJson(relativePath, description) {
  const filePath = absolute(relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    failures.push(`${description}: unable to read ${relativePath} (${error.message})`);
    return null;
  }
}

const packageJson = readJson('package.json', 'package metadata');
if (packageJson && typeof packageJson.scripts?.build !== 'string') {
  failures.push('package metadata: npm build script is missing');
}

const hosting = readJson('.openai/hosting.json', 'hosting manifest');
if (hosting && typeof hosting.project_id !== 'string') {
  failures.push('hosting manifest: project_id is missing');
}

const fixture = readJson('fixtures/sec/msft-fy24.json', 'SEC fixture');
if (fixture) {
  if (fixture.cik !== '0000789019') failures.push('SEC fixture: expected Microsoft CIK 0000789019');
  if (typeof fixture.sourceUrl !== 'string' || !fixture.sourceUrl.startsWith('https://www.sec.gov/')) {
    failures.push('SEC fixture: sourceUrl must point to sec.gov');
  }
}

requireFile('app/api/sec/route.ts', 'SEC route source');
requireFile('dist/server/index.js', 'server build');
requireFile('dist/server/wrangler.json', 'Worker runtime manifest');
requireFile('dist/.openai/hosting.json', 'built hosting manifest');

if (failures.length > 0) {
  console.error('Catalyst deployment preflight failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Catalyst deployment preflight passed.');
  console.log('- source manifest: valid');
  console.log('- SEC fixture and route: present');
  console.log('- Worker build artifacts: present');
  console.log('- hosting manifest: present');
}
