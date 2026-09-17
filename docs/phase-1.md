# Catalyst roadmap

## Current release — evidence-backed research workspace

The shipped vertical slice now covers the core research loop end to end: start with a deterministic Microsoft SEC fixture, refresh live SEC company facts when available, inspect the event stream, annotate evidence, maintain hypotheses and studies, and export the resulting workspace or study packet.

The current release includes:

- Normalized SEC metrics, annual history, filing metadata, source provenance, and data-quality checks.
- Event, signal, and analyst-label filters with local notes and evidence links.
- Editable hypotheses and studies with queue/status controls.
- Derived operating transforms, metric-history CSV, event-review CSV, Markdown brief, workspace JSON, and study-packet exports.
- Live SEC comparison for an alternate company, with period-alignment warnings and comparison export.
- Local persistence for research state and reproducible study-run history with captured inputs and stable signatures.

## Next — durable workspaces and company context

- Add a server-backed workspace API with authentication and explicit workspace ownership.
- Add safe company/workspace switching so research state cannot leak between companies.
- Keep local export/import as an offline recovery path.
- Add conflict handling and a visible “last saved” state before multi-device use.

## Later — reproducible evaluation

- Add point-in-time study runs that select only facts available by an as-of date.
- Add event-study and backtest primitives with explicit look-ahead and filing-period rules.
- Add factor/exposure views, paper portfolios, experiment tracking, and review gates.

Broker connectivity, live trading, alerts, and production data writes remain intentionally out of scope until the research and review controls are mature.
