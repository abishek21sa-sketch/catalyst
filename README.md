# Catalyst

Catalyst is an event-driven quantitative research workspace for turning filings into auditable signals, hypotheses, and study packets. The current release is local-first: it combines a deterministic Microsoft fixture with optional live SEC company-facts data, then keeps analyst work on the device until it is explicitly exported.

## Run locally

```bash
npm install
npm run dev
```

The workspace starts from a deterministic Microsoft FY24 SEC EDGAR fixture through `lib/sec-adapter.ts`. Use **Refresh source** to request live SEC facts when the deployment has network access; the app falls back to the checked-in fixture if the request is unavailable. Use **Compare SEC** to load a live alternate company by its zero-padded CIK.

## Shipped capabilities

- Domain model for companies, filings, events, metrics, hypotheses, studies, and evidence.
- Dark research-terminal app shell and design tokens.
- Normalized SEC facts with visible provenance, source links, period alignment, and data-quality checks.
- Event stream filters for kind, signal, and analyst label, with local notes and evidence links.
- Editable hypotheses and studies with local status/state workflows.
- Annual metric history, derived operating transforms, CSV exports, Markdown briefs, and auditable study packets.
- Live SEC company comparison with cross-company period checks and exportable comparison snapshots.
- Reproducible study-run snapshots that capture current inputs, source quality, and a stable input signature.
- Workspace JSON export/import plus local persistence for research state.

## Product boundary

The current app is intentionally local-first. Durable server-backed workspaces, authentication, multi-company workspace switching, event-study/backtest primitives, and portfolio context are planned next. Broker connectivity, live trading, and production data writes remain out of scope.

See [`docs/phase-1.md`](docs/phase-1.md) for the boundary and next phases.

See [`docs/deployment.md`](docs/deployment.md) for the GitHub, Vercel, Render, and Sites deployment plan.
