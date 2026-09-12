import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve('.vercel', 'output');
const serverFunction = path.join(outputRoot, 'functions', '__server.func');
const apiFunction = path.join(outputRoot, 'functions', 'api', 'sec.func');
const outputConfigPath = path.join(outputRoot, 'config.json');

// Nitro emits the API function as a junction on Windows. Vercel's uploader
// cannot preserve that alias, so materialize a real function directory.
await rm(apiFunction, { force: true, recursive: true });
await cp(serverFunction, apiFunction, { dereference: true, recursive: true });

const outputConfig = JSON.parse(await readFile(outputConfigPath, 'utf8'));
outputConfig.routes = outputConfig.routes
  .filter((route) => route.src !== '/api/sec')
  .map((route) =>
    route.src === '/(.*)' && route.dest === '/__server'
      ? { ...route, src: '^(?!/api/sec(?:/)?$)(.*)$' }
      : route,
  );
await writeFile(outputConfigPath, JSON.stringify(outputConfig, null, 2) + '\n');

console.log('Prepared Vercel output with a portable native SEC function.');
