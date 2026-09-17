# Deployment plan

## Recommended topology

1. **GitHub — canonical source.** The canonical repository is [abishek21sa-sketch/catalyst](https://github.com/abishek21sa-sketch/catalyst), with the production source on `main`.
2. **Sites — private product preview.** Keep the current private Sites deployment for review while the product is still in early development.
3. **Vercel — production app.** The public deployment is [catalyst-quant-research.vercel.app](https://catalyst-quant-research.vercel.app). Vercel runs the Nitro build and exposes the native `/api/sec` server route.
4. **Render — static or service option.** Render’s static-site path is a good fit for the fixture-only frontend (`npm run build`, publish `dist`), but the current `/api/sec` route needs a compatible server runtime. Use Render after either adding a Node adapter or intentionally shipping a static-only mode.

## Current readiness

- `npm run build` produces a Cloudflare-compatible Worker build with `/api/sec`.
- `npm run build:vercel` produces the Nitro `.output` build used by Vercel and includes the `/api/sec` server route in the Nitro function.
- `npm run preflight` verifies the hosting manifest, SEC fixture/route, and required Worker artifacts after the build.
- App-specific lint is covered by CI; the generated component catalog remains outside that check because it carries starter lint findings.
- The SEC route is live-optional and falls back to the local fixture.
- The GitHub repository is connected to Vercel; pushes to `main` use the checked-in Vercel build settings.
- Production smoke checks cover `/`, live Microsoft SEC facts, and an alternate-company CIK response.
- Render remains unconnected and is still a future alternative.

## Safe rollout order

1. Keep `main` green with the local release gate.
2. Verify `/` and `/api/sec?cik=0000789019` after each production deploy.
3. Use Vercel for the server-capable app; use Render only after adding a compatible server runtime or intentionally shipping static-only mode.
4. Add a custom domain and production secrets only after durable workspace persistence is ready.

## Local release gate

Run the following before connecting a provider or creating a release:

```bash
npm ci
npx oxlint app lib scripts
npm run build
npm run preflight
# For Vercel compatibility, also run: npm run build:vercel
```

The preflight is intentionally offline. It catches incomplete local builds and missing deployment metadata without exporting source or calling a hosting provider.

Deployment remains intentionally separate from the research product scope: no broker credentials, trading endpoints, or production data writes are included.
