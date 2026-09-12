'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Database,
  FileText,
  FlaskConical,
  Layers3,
  Menu,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { formatMetric, loadSecFixture, margin } from '../lib/sec-adapter';
import type { Event } from '../lib/domain';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const snapshot = loadSecFixture();
const nav = [
  ['Overview', Activity],
  ['Event stream', Layers3],
  ['Filings', FileText],
  ['Metrics', BarChart3],
  ['Hypotheses', BrainCircuit],
] as const;
const kindLabel: Record<Event['kind'], string> = {
  filing: 'Filing',
  metric: 'Metric signal',
  hypothesis: 'Hypothesis',
};
type EventFilter = 'all' | 'filing' | 'metric' | 'hypothesis';
type NavLabel = (typeof nav)[number][0];
type SearchResult = {
  id: string;
  kind: 'event' | 'hypothesis' | 'study';
  title: string;
  meta: string;
};

function EventRow({
  event,
  selected,
  onSelect,
}: {
  event: Event;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full gap-4 border-b border-slate-800/80 px-1 py-4 text-left last:border-0 ${selected ? 'bg-emerald-300/[.04]' : 'hover:bg-white/[.025]'}`}
    >
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[#0a1117] ${event.signal === 'positive' ? 'bg-emerald-300 shadow-[0_0_11px_#7de4bb]' : event.signal === 'watch' ? 'bg-amber-300' : 'bg-slate-400'}`}
      />
      <span className="grid min-w-0 flex-1 gap-1.5">
        <span className="flex justify-between gap-3 text-[10px] font-bold uppercase tracking-[.13em] text-emerald-300">
          <span>{kindLabel[event.kind]}</span>
          <span className="font-normal tracking-normal text-slate-500">
            {event.date}
          </span>
        </span>
        <strong className="text-sm font-semibold text-slate-200">
          {event.title}
        </strong>
        <span className="text-xs leading-5 text-slate-400">
          {event.summary}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Database size={12} /> {event.sourceLabel}
        </span>
      </span>
      <ArrowUpRight
        size={17}
        className={`mt-1 shrink-0 text-slate-600 ${selected ? 'text-emerald-300' : 'group-hover:text-slate-300'}`}
      />
    </button>
  );
}

export default function CatalystView() {
  const [selectedId, setSelectedId] = useState(snapshot.events[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sourceState, setSourceState] = useState<
    'fixture' | 'loading' | 'live' | 'fallback'
  >('fixture');
  const [metrics, setMetrics] = useState(snapshot.metrics);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [activeNav, setActiveNav] = useState<NavLabel>('Overview');
  const [draftKind, setDraftKind] = useState<'hypothesis' | 'study' | null>(
    null,
  );
  const [hypotheses, setHypotheses] = useState(snapshot.hypotheses);
  const [studies, setStudies] = useState(snapshot.studies);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'hypothesis' | 'study'; id: string; title: string } | null>(null);
  useEffect(() => {
    try {
      const savedHypotheses = window.localStorage.getItem('catalyst:hypotheses');
      const savedStudies = window.localStorage.getItem('catalyst:studies');
      if (savedHypotheses) {
        const parsedHypotheses = JSON.parse(savedHypotheses);
        setTimeout(() => setHypotheses(parsedHypotheses), 0);
      }
      if (savedStudies) {
        const parsedStudies = JSON.parse(savedStudies);
        setTimeout(() => setStudies(parsedStudies), 0);
      }
    } catch {
      // Device storage is optional; the fixture remains the safe default.
    }
  }, []);
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);
  const selected = useMemo(
    () =>
      snapshot.events.find((event) => event.id === selectedId) ??
      snapshot.events[0],
    [selectedId],
  );
  const visibleEvents = useMemo(
    () =>
      eventFilter === 'all'
        ? snapshot.events
        : snapshot.events.filter((event) => event.kind === eventFilter),
    [eventFilter],
  );
  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    const results: SearchResult[] = [
      ...snapshot.events.map((event) => ({
        id: event.id,
        kind: 'event' as const,
        title: event.title,
        meta: `${kindLabel[event.kind]} · ${event.date}`,
      })),
      ...hypotheses.map((hypothesis) => ({
        id: hypothesis.id,
        kind: 'hypothesis' as const,
        title: hypothesis.title,
        meta: `Hypothesis · ${hypothesis.status}`,
      })),
      ...studies.map((study) => ({
        id: study.id,
        kind: 'study' as const,
        title: study.title,
        meta: `Study · ${study.state}`,
      })),
    ];
    return query
      ? results.filter((result) => `${result.title} ${result.meta}`.toLowerCase().includes(query)).slice(0, 8)
      : results.slice(0, 8);
  }, [hypotheses, searchQuery, studies]);
  function changeEventFilter(nextFilter: EventFilter) {
    setEventFilter(nextFilter);
    setActiveNav(nextFilter === 'all' ? 'Event stream' : nextFilter === 'filing' ? 'Filings' : nextFilter === 'metric' ? 'Metrics' : 'Hypotheses');
    const nextEvents = nextFilter === 'all' ? snapshot.events : snapshot.events.filter((event) => event.kind === nextFilter);
    if (!nextEvents.some((event) => event.id === selectedId) && nextEvents[0]) setSelectedId(nextEvents[0].id);
  }
  function navigateTo(label: NavLabel) {
    setActiveNav(label);
    setMenuOpen(false);
    if (label === 'Overview') {
      changeEventFilter('all');
      setActiveNav('Overview');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (label === 'Filings') changeEventFilter('filing');
    if (label === 'Metrics') changeEventFilter('metric');
    if (label === 'Event stream') changeEventFilter('all');
    const targetId = label === 'Hypotheses' ? 'hypotheses-panel' : 'event-stream';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function selectSearchResult(result: SearchResult) {
    setSearchOpen(false);
    setSearchQuery('');
    if (result.kind === 'event') {
      setSelectedId(result.id);
      setEventFilter('all');
      setActiveNav('Event stream');
      document.getElementById('event-stream')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setActiveNav('Hypotheses');
    document.getElementById(result.kind === 'study' ? 'research-queue' : 'hypotheses-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const netMargin = margin(metrics[2].value, metrics[0].value);
  async function refreshSource() {
    setSourceState('loading');
    try {
      const response = await fetch(`/api/sec?cik=${snapshot.company.cik}`);
      const payload = (await response.json()) as {
        mode?: string;
        metrics?: {
          revenue?: number;
          operatingIncome?: number;
          netIncome?: number;
        };
      };
      if (payload.mode === 'live' && payload.metrics) {
        setMetrics(
          snapshot.metrics.map((metric) => ({
            ...metric,
            value:
              payload.metrics?.[
                metric.id === 'revenue'
                  ? 'revenue'
                  : metric.id === 'operating-income'
                    ? 'operatingIncome'
                    : 'netIncome'
              ] ?? metric.value,
          })),
        );
        setSourceState('live');
      } else {
        setMetrics(snapshot.metrics);
        setSourceState('fallback');
      }
    } catch {
      setMetrics(snapshot.metrics);
      setSourceState('fallback');
    }
  }
  function saveDraft(title: string, description: string) {
    if (draftKind === 'hypothesis') {
      setHypotheses((items) => {
        const next = [...items, { id: `h-local-${Date.now()}`, title, status: 'testing' as const, description: description || 'Draft hypothesis queued for evidence.' }];
        window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
        return next;
      });
    } else if (draftKind === 'study') {
      setStudies((items) => {
        const next = [...items, { id: `study-local-${Date.now()}`, title, owner: 'AT', state: 'active' as const, updatedAt: 'Just now' }];
        window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
        return next;
      });
    }
    setDraftKind(null);
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'hypothesis') {
      setHypotheses((items) => {
        const next = items.filter((item) => item.id !== deleteTarget.id);
        window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
        return next;
      });
    } else {
      setStudies((items) => {
        const next = items.filter((item) => item.id !== deleteTarget.id);
        window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
        return next;
      });
    }
    setDeleteTarget(null);
  }
  return (
    <>
      <main className="min-h-screen bg-[#090e13] text-slate-100 antialiased selection:bg-emerald-300 selection:text-slate-950">
        {menuOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 bg-slate-950/70 lg:hidden"
          />
        )}
        <aside
          id="primary-navigation"
          className={`fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-800 bg-[#090e13] px-4 py-6 transition-transform lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
        >
          <div className="flex items-center gap-2 px-2 pb-8 text-lg font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-300 text-slate-950 shadow-[0_0_24px_rgba(125,228,187,.24)]">
              <Sparkles size={15} />
            </span>
            Catalyst
            <span className="ml-auto text-[9px] tracking-[.08em] text-slate-600">
              PHASE 01
            </span>
          </div>
          <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">
            Workspace
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-800 bg-[#111b22] p-2.5 text-left"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-800 text-sm font-extrabold text-emerald-100">
              M
            </span>
            <span className="grid flex-1 gap-0.5">
              <strong className="text-[13px]">Microsoft</strong>
              <small className="text-[11px] text-slate-500">
                MSFT · NASDAQ
              </small>
            </span>
            <ChevronDown size={15} className="text-slate-500" />
          </button>
          <nav className="mt-7 grid gap-1" aria-label="Primary navigation">
            {nav.map(([label, Icon]) => (
              <button
                type="button"
                key={label}
                aria-current={label === activeNav ? 'page' : undefined}
                onClick={() => navigateTo(label)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] ${label === activeNav ? 'bg-[#16232a] text-slate-100 shadow-[inset_2px_0_#7de4bb]' : 'text-slate-400 hover:bg-white/[.03] hover:text-slate-100'}`}
              >
                <Icon size={17} />
                <span>{label}</span>
                {label === 'Event stream' && (
                  <em className="ml-auto text-[10px] not-italic text-emerald-300">
                    04
                  </em>
                )}
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <div className="mb-4 ml-2 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#7de4bb]" />
            <span className="grid gap-0.5">
              <strong className="text-xs font-semibold">Local fixture</strong>
              <small className="text-[11px] text-slate-500">
                EDGAR adapter ready
              </small>
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-slate-400 hover:bg-white/[.03] hover:text-slate-100"
          >
            <CircleHelp size={17} />
            Documentation
          </button>
        </aside>
        <section className="min-w-0 lg:ml-0 lg:flex-1">
          <header className="flex h-[70px] items-center justify-between border-b border-slate-800/80 px-4 sm:px-8">
            <button
              type="button"
              className="mr-3 text-slate-300 lg:hidden"
              aria-label="Open navigation"
              aria-controls="primary-navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3 text-[13px] text-slate-500">
              <span>Research</span>
              <span className="text-slate-700">/</span>
              <strong className="font-semibold text-slate-300">
                {snapshot.company.ticker}
              </strong>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-xs text-slate-500"
              >
                <Search size={16} />
                <span className="hidden sm:inline">Search research</span>
                <kbd className="hidden rounded border border-slate-700 px-1 text-[10px] sm:inline">
                  ⌘ K
                </kbd>
              </button>
              <button
                type="button"
                aria-label="Documentation"
                className="hidden h-8 w-8 place-items-center rounded-lg border border-slate-800 bg-[#101a21] text-slate-400 sm:grid"
              >
                <BookOpen size={17} />
              </button>
              <span className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-[#705a4a] text-[10px] font-bold text-orange-100">
                AT
              </span>
              <strong className="hidden text-xs font-semibold text-slate-400 sm:block">
                Alex Torres
              </strong>
            </div>
          </header>
          <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-8 lg:px-11">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#7de4bb]" />{' '}
                  Company overview <span className="text-slate-700">·</span>{' '}
                  Updated 2 min ago
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-.055em] sm:text-[39px]">
                  Microsoft{' '}
                  <span className="font-normal text-slate-500">
                    Corporation
                  </span>
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  An event-first view of filings, operating signals, and open
                  research questions.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraftKind('hypothesis')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-[#101a21] px-3 py-2.5 text-xs font-semibold text-slate-300"
                >
                  <Target size={15} /> Add hypothesis
                </button>
                <button
                  type="button"
                  onClick={() => setDraftKind('study')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-300 px-3 py-2.5 text-xs font-semibold text-slate-950"
                >
                  <FlaskConical size={15} /> New study
                </button>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {[
                [`Revenue`, formatMetric(metrics[0].value), '↗ 16.0% YoY'],
                [
                  'Operating income',
                  formatMetric(metrics[1].value),
                  '↗ 24.0% YoY',
                ],
                ['Net margin', `${netMargin}%`, '↗ 150 bps YoY'],
                [
                  'Data coverage',
                  '1 filing',
                  sourceState === 'live'
                    ? 'Live · SEC source'
                    : 'Fixture · verified source',
                ],
              ].map(([label, value, delta], i) => (
                <div
                  key={label}
                  className="relative min-h-[132px] overflow-hidden rounded-xl border border-slate-800 bg-[#101820]/80 p-4"
                >
                  <span className="text-xs text-slate-400">
                    {label}{' '}
                    <small className="ml-1 text-[10px] text-slate-600">
                      {i < 3 ? 'FY24' : ''}
                    </small>
                  </span>
                  <strong className="mt-4 block text-2xl tracking-tight">
                    {value}
                  </strong>
                  <em
                    className={`mt-1.5 block text-[11px] not-italic ${i === 3 ? 'text-slate-400' : 'text-emerald-300'}`}
                  >
                    {delta}
                  </em>
                  {i < 3 ? (
                    <span className="absolute bottom-4 right-3 h-7 w-20 rotate-[-8deg] border-b-2 border-emerald-400/70 opacity-80" />
                  ) : (
                    <span className="absolute bottom-5 left-4 right-4 h-1 rounded-full bg-slate-700">
                      <span className="block h-full w-1/5 rounded-full bg-emerald-300" />
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(330px,.66fr)]">
              <section id="event-stream" className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#101820]/75 p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">
                      SIGNAL MAP
                    </span>
                    <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
                      Event stream
                    </h2>
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-[11px] text-slate-400">
                    <span className="sr-only">Filter event stream</span>
                    <select
                      value={eventFilter}
                    onChange={(event) => changeEventFilter(event.target.value as EventFilter)}
                      className="bg-transparent text-[11px] text-slate-400 outline-none"
                    >
                      <option value="all">All events</option>
                      <option value="filing">Filings</option>
                      <option value="metric">Metric signals</option>
                      <option value="hypothesis">Hypotheses</option>
                    </select>
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span>
                    <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Positive
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                    Watch
                  </span>
                  <span>
                    <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Filing
                  </span>
                  <span className="text-slate-600">
                    {String(visibleEvents.length).padStart(2, '0')} events
                  </span>
                </div>
                <div className="relative mt-1 pl-0 before:absolute before:bottom-5 before:left-[5px] before:top-5 before:border-l before:border-dashed before:border-slate-700">
                  {visibleEvents.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      selected={selected.id === event.id}
                      onSelect={() => setSelectedId(event.id)}
                    />
                  ))}
                </div>
              </section>
              <aside
                className="rounded-xl border border-slate-800 bg-[#101820]/75 p-4 sm:p-5"
                aria-live="polite"
              >
                <div className="flex justify-between">
                  <div>
                    <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">
                      SELECTED EVENT
                    </span>
                    <span
                      className={`mt-2 block w-fit rounded px-1.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${selected.signal === 'watch' ? 'bg-amber-300/15 text-amber-300' : selected.signal === 'neutral' ? 'bg-slate-700 text-slate-300' : 'bg-emerald-300/15 text-emerald-300'}`}
                    >
                      {kindLabel[selected.kind]}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset detail"
                    onClick={() => setSelectedId(snapshot.events[0].id)}
                    className="h-7 w-7 text-slate-500 hover:text-slate-200"
                  >
                    <X size={16} />
                  </button>
                </div>
                <h2 className="mt-5 text-[23px] font-semibold leading-tight tracking-tight">
                  {selected.title}
                </h2>
                <p className="mt-2 text-[13px] leading-5 text-slate-400">
                  {selected.summary}
                </p>
                <div className="mt-5 grid grid-cols-[1fr_auto] gap-1.5 text-[11px] text-slate-500">
                  <span>Confidence</span>
                  <strong className="text-emerald-300">
                    {Math.round(selected.confidence * 100)}%
                  </strong>
                  <span className="col-span-2 h-1 overflow-hidden rounded bg-slate-700">
                    <span
                      className="block h-full rounded bg-emerald-300"
                      style={{ width: `${selected.confidence * 100}%` }}
                    />
                  </span>
                </div>
                <div className="mt-6 flex items-baseline justify-between border-b border-slate-800 pb-2 text-xs font-semibold text-slate-300">
                  <span>Evidence</span>
                  <small className="font-normal text-slate-500">
                    {selected.evidence.length} linked sources
                  </small>
                </div>
                <div>
                  {selected.evidence.map((item) => (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      key={`${item.concept}-${item.label}`}
                      className="grid grid-cols-[27px_minmax(0,1fr)_auto_14px] items-center gap-2 border-b border-slate-800/80 py-3 no-underline hover:[&>span:nth-child(2)>strong]:text-emerald-300"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-md border border-emerald-900 bg-emerald-950/40 text-emerald-300">
                        <FileText size={14} />
                      </span>
                      <span className="grid min-w-0 gap-1">
                        <strong className="truncate text-xs font-semibold text-slate-300">
                          {item.label}
                        </strong>
                        <small className="truncate text-[10px] text-slate-500">
                          {item.concept} · {item.unit}
                        </small>
                      </span>
                      <b className="text-xs font-semibold text-slate-200">
                        {item.value}
                      </b>
                      <ArrowUpRight size={14} className="text-slate-600" />
                    </a>
                  ))}
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-2.5 text-emerald-300">
                  <Database size={14} className="mt-0.5 shrink-0" />
                  <span className="grid gap-1">
                    <strong className="text-[11px] text-emerald-100">
                      Provenance visible
                    </strong>
                    <small className="text-[10px] leading-4 text-emerald-200/70">
                      {selected.sourceLabel}
                      <br />
                      Adapter: SEC EDGAR company-facts
                    </small>
                  </span>
                </div>
                <a
                  href={selected.evidence[0].sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-emerald-300 no-underline"
                >
                  Open source filing <ArrowUpRight size={14} />
                </a>
              </aside>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(330px,.66fr)]">
              <ResearchCard
                id="hypotheses-panel"
                title="What to test next"
                kicker="WORKING HYPOTHESES"
              >
                {hypotheses.map((h) => (
                  <div
                    className="flex items-center gap-2.5 border-t border-slate-800/80 py-3.5"
                    key={h.id}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-950 text-emerald-300">
                      <BrainCircuit size={15} />
                    </span>
                    <span className="grid flex-1 gap-1">
                      <strong className="text-xs text-slate-300">
                        {h.title}
                      </strong>
                      <small className="text-[11px] text-slate-500">
                        {h.description}
                      </small>
                    </span>
                  <em className="rounded bg-emerald-950 px-1.5 py-1 text-[9px] font-bold uppercase not-italic text-emerald-200">
                    {h.status}
                  </em>
                  {h.id.startsWith('h-local-') && (
                    <button type="button" aria-label={`Remove ${h.title}`} onClick={() => setDeleteTarget({ kind: 'hypothesis', id: h.id, title: h.title })} className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-red-950/40 hover:text-red-300">
                      <Trash2 size={13} />
                    </button>
                  )}
                  </div>
                ))}
              </ResearchCard>
              <ResearchCard id="research-queue" title="Research queue" kicker="ACTIVE STUDIES">
                {studies.map((s) => (
                  <div
                    className="flex items-center gap-2.5 border-t border-slate-800/80 py-3.5"
                    key={s.id}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${s.state === 'active' ? 'bg-emerald-300 shadow-[0_0_8px_#7de4bb]' : 'bg-slate-500'}`}
                    />
                    <span className="grid flex-1 gap-1">
                      <strong className="text-xs text-slate-300">
                        {s.title}
                      </strong>
                      <small className="text-[11px] text-slate-500">
                        {s.owner} · updated {s.updatedAt}
                      </small>
                    </span>
                  <em className="rounded bg-slate-800 px-1.5 py-1 text-[9px] font-bold uppercase not-italic text-slate-400">
                    {s.state}
                  </em>
                  {s.id.startsWith('study-local-') && (
                    <button type="button" aria-label={`Remove ${s.title}`} onClick={() => setDeleteTarget({ kind: 'study', id: s.id, title: s.title })} className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-red-950/40 hover:text-red-300">
                      <Trash2 size={13} />
                    </button>
                  )}
                  </div>
                ))}
              </ResearchCard>
            </div>
            <footer className="flex flex-col justify-between gap-2 py-5 text-[10px] text-slate-600 sm:flex-row">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <Database size={13} /> Source: SEC EDGAR fixture · CIK{' '}
                  {snapshot.company.cik}
                </span>
                <button
                  type="button"
                  onClick={refreshSource}
                  disabled={sourceState === 'loading'}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300 disabled:opacity-60"
                >
                  <RefreshCw
                    size={12}
                    className={sourceState === 'loading' ? 'animate-spin' : ''}
                  />
                  {sourceState === 'loading'
                    ? 'Checking SEC…'
                    : sourceState === 'live'
                      ? 'SEC source ready'
                      : sourceState === 'fallback'
                        ? 'Using fixture fallback'
                        : 'Refresh source'}
                </button>
              </div>
              <span>Phase 1 · Foundation &amp; vertical slice</span>
            </footer>
          </div>
        </section>
      </main>
      <DraftDialog
        kind={draftKind}
        open={draftKind !== null}
        onOpenChange={(open) => !open && setDraftKind(null)}
        onSave={saveDraft}
      />
      <SearchDialog
        open={searchOpen}
        query={searchQuery}
        results={searchResults}
        onQueryChange={setSearchQuery}
        onOpenChange={(open) => {
          setSearchOpen(open);
          if (!open) setSearchQuery('');
        }}
        onSelect={selectSearchResult}
      />
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border border-slate-800 bg-[#101820] text-slate-100 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Remove local draft?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">“{deleteTarget?.title}” will be removed from this device. SEC-backed fixture records are not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500 text-white hover:bg-red-400">Remove draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SearchDialog({
  open,
  query,
  results,
  onQueryChange,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  query: string;
  results: SearchResult[];
  onQueryChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-slate-800 bg-[#101820] p-0 text-slate-100 sm:max-w-lg">
        <DialogHeader className="border-b border-slate-800 px-4 py-4">
          <DialogTitle className="text-slate-100">Search research</DialogTitle>
          <DialogDescription className="text-slate-400">
            Jump to an event, working hypothesis, or study.
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-slate-800 px-4 py-3">
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0b1319] px-3 py-2.5 text-sm text-slate-300 focus-within:border-emerald-300">
            <Search size={16} className="text-slate-500" />
            <span className="sr-only">Search research</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search evidence, signals, or studies…"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-600"
            />
            <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 sm:block">Esc</kbd>
          </label>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length ? results.map((result) => (
            <button
              type="button"
              key={`${result.kind}-${result.id}`}
              onClick={() => onSelect(result)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-emerald-300/[.06]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 bg-[#0b1319] text-emerald-300">
                {result.kind === 'event' ? <Activity size={15} /> : result.kind === 'hypothesis' ? <BrainCircuit size={15} /> : <FlaskConical size={15} />}
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <strong className="truncate text-xs font-semibold text-slate-200">{result.title}</strong>
                <small className="text-[11px] text-slate-500">{result.meta}</small>
              </span>
              <ArrowUpRight size={15} className="shrink-0 text-slate-600" />
            </button>
          )) : (
            <p className="px-3 py-8 text-center text-xs text-slate-500">No matching research found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftDialog({
  kind,
  open,
  onOpenChange,
  onSave,
}: {
  kind: 'hypothesis' | 'study' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, description: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const isHypothesis = kind === 'hypothesis';
  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), description.trim());
    setTitle('');
    setDescription('');
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-slate-800 bg-[#101820] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {isHypothesis ? 'Add working hypothesis' : 'Start a research study'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isHypothesis
              ? 'Capture the question you want the next filing to answer.'
              : 'Create a local study draft and move it into the research queue.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <label className="grid gap-1.5 text-xs text-slate-400">
            {isHypothesis ? 'Hypothesis' : 'Study name'}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                isHypothesis
                  ? 'e.g. AI capex supports margin durability'
                  : 'e.g. Azure monetization watch'
              }
              className="rounded-lg border border-slate-700 bg-[#0b1319] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300"
            />
          </label>
          {isHypothesis && (
            <label className="grid gap-1.5 text-xs text-slate-400">
              Context{' '}
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What evidence would change your mind?"
                rows={3}
                className="resize-none rounded-lg border border-slate-700 bg-[#0b1319] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300"
              />
            </label>
          )}
          <DialogFooter className="-mx-4 -mb-4 border-slate-800 bg-[#0d161d]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950"
            >
              Save draft
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResearchCard({
  id,
  title,
  kicker,
  children,
}: {
  id?: string;
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#101820]/75 px-4 pt-5 sm:px-5">
      <div className="mb-2">
        <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">
          {kicker}
        </span>
        <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
