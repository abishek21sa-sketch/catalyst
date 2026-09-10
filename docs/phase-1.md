# Catalyst roadmap

## Phase 1 — Foundation + thin vertical slice (current)

Phase 1 proves the core research loop: load a small SEC EDGAR fixture, normalize it into domain objects, render the company timeline, and open a detail view whose evidence links back to the filing. The checked-in fixture is intentionally deterministic and local-first.

The current slice does not claim to be a complete research platform. It is a product and data contract that later ingestion and study workflows can build on.

## Phase 2 — Live ingestion and persistence

- Add a rate-limited SEC adapter with user-agent configuration and retries.
- Persist raw payloads, normalized facts, filings, and provenance records.
- Add company selection and filing history beyond the fixture.
- Add validation for duplicate facts, amended filings, and period alignment.

## Phase 3 — Research workflows

- Create/edit hypotheses and studies.
- Add event labeling, analyst notes, and evidence collections.
- Add reproducible study runs and metric transformations.
- Add comparison views across companies and filing periods.

## Phase 4 — Evaluation and portfolio context

- Add event-study and backtest primitives with explicit point-in-time data rules.
- Add factor/exposure views, paper portfolios, and experiment tracking.
- Add review gates before any live or broker-connected workflow.

Live trading is intentionally not part of the current build.
