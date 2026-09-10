# Catalyst

Catalyst is a standalone, event-driven quantitative research system. Phase 1 establishes the product foundation and one evidence-backed vertical slice.

## Run locally

```bash
npm install
npm run dev
```

The workspace loads a deterministic Microsoft FY24 SEC EDGAR fixture through `lib/sec-adapter.ts`. The adapter keeps the app usable without network access while preserving the shape needed for a future live SEC fetch.

## Phase 1 scope

- Domain model for companies, filings, events, metrics, hypotheses, studies, and evidence.
- Dark research-terminal app shell and design tokens.
- Normalized SEC fixture with visible provenance and links back to the source filing.
- Timeline-to-detail interaction for one evidence-backed event at a time.

Explicitly out of scope: live ingestion, authentication, persistence, portfolio construction, trading, alerts, and a full backtesting engine.

See [`docs/phase-1.md`](docs/phase-1.md) for the boundary and next phases.

See [`docs/deployment.md`](docs/deployment.md) for the GitHub, Vercel, Render, and Sites deployment plan.
