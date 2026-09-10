# Deployment plan

## Recommended topology

1. **GitHub — canonical source.** Create a private GitHub repository and push the local `main` history. GitHub’s documented flow supports adding an existing local repository and pushing it with GitHub CLI or Git.
2. **Sites — private product preview.** Keep the current private Sites deployment for review while the product is still in early development.
3. **Vercel — public app candidate.** Vercel supports Git-connected Vite deployments and creates preview deployments for commits and pull requests. The current app is Vinext with a server route, so the exact Vercel build/runtime compatibility should be verified before switching production traffic.
4. **Render — static or service option.** Render’s static-site path is a good fit for the fixture-only frontend (`npm run build`, publish `dist`), but the current `/api/sec` route needs a compatible server runtime. Use Render after either adding a Node adapter or intentionally shipping a static-only mode.

## Current readiness

- `npm run build` produces a Cloudflare-compatible Worker build with `/api/sec`.
- `npm run preflight` verifies the hosting manifest, SEC fixture/route, and required Worker artifacts after the build.
- App-specific lint is covered by CI; the generated component catalog remains outside that check because it carries starter lint findings.
- The SEC route is live-optional and falls back to the local fixture.
- No GitHub repository has been created or pushed to yet.
- No Vercel or Render project has been connected.

## Safe rollout order

1. Create the GitHub repository as private and push `main`.
2. Connect GitHub to a preview environment first.
3. Verify `/` and `/api/sec?cik=0000789019` in the preview.
4. Choose Vercel for the server-capable app, or Render static only if the live route is disabled.
5. Add a custom domain and production secrets only after the preview is healthy.

## Local release gate

Run the following before connecting a provider or creating a release:

```bash
npm ci
npx oxlint app lib scripts
npm run build
npm run preflight
```

The preflight is intentionally offline. It catches incomplete local builds and missing deployment metadata without exporting source or calling a hosting provider.

Deployment remains intentionally separate from the research product scope: no broker credentials, trading endpoints, or production data writes are included.
