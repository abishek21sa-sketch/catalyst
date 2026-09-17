'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  Copy,
  Database,
  Download,
  FileText,
  FlaskConical,
  Layers3,
  Menu,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatMetric, loadSecFixture, margin } from '../lib/sec-adapter';
import type { Event, Filing, Metric } from '../lib/domain';
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
const fixturePriorMetrics = {
  revenue: snapshot.metrics[0].value / 1.16,
  operatingIncome: snapshot.metrics[1].value / 1.24,
  netIncome: snapshot.metrics[2].value / 1.21,
};
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
const eventById = new Map(snapshot.events.map((event) => [event.id, event] as const));
type EventFilter = 'all' | 'filing' | 'metric' | 'hypothesis';
type SignalFilter = 'all' | Event['signal'];
type EventLabel = 'catalyst' | 'risk' | 'context' | 'monitor';
type EventLabelFilter = 'all' | EventLabel;
type HypothesisFilter = 'all' | 'testing' | 'supported' | 'parked';
type StudyFilter = 'all' | 'active' | 'queued';
type DraftTarget = { kind: 'hypothesis' | 'study'; id: string; title: string; description: string };
type SourceQuality = { status: 'pass' | 'review' | 'fixture'; currentPeriod: string | null; priorPeriod: string | null; alignedCurrentPeriod: boolean; alignedPriorPeriod: boolean; duplicateFacts: number; amendedFilings: number; missingMetrics: number };
type MetricHistoryPoint = { value: number; period: string };
type MetricHistory = Record<string, MetricHistoryPoint[]>;
type SecComparison = { entityName: string; cik: string; metrics: Record<string, number>; priorMetrics: Record<string, number>; periods: Record<string, string>; history: MetricHistory; quality: SourceQuality; filings: Filing[]; sourceUrl: string; fetchedAt: string };
type StudyRun = { id: string; executedAt: string; asOfPeriod: string; sourceState: 'fixture' | 'live' | 'fallback'; qualityStatus: SourceQuality['status']; evidenceCount: number; filingCount: number; metricCount: number; transformCount: number; inputSignature: string };
const fixtureSourceQuality: SourceQuality = { status: 'fixture', currentPeriod: '2024-06-30', priorPeriod: null, alignedCurrentPeriod: true, alignedPriorPeriod: false, duplicateFacts: 0, amendedFilings: 0, missingMetrics: 0 };
const fixtureMetricHistory: MetricHistory = {
  revenue: [{ value: snapshot.metrics[0].value, period: 'FY 2024' }, { value: fixturePriorMetrics.revenue, period: 'FY 2023' }],
  operatingIncome: [{ value: snapshot.metrics[1].value, period: 'FY 2024' }, { value: fixturePriorMetrics.operatingIncome, period: 'FY 2023' }],
  netIncome: [{ value: snapshot.metrics[2].value, period: 'FY 2024' }, { value: fixturePriorMetrics.netIncome, period: 'FY 2023' }],
};
const eventLabelOptions: Array<{ value: EventLabel; label: string }> = [
  { value: 'catalyst', label: 'Catalyst' },
  { value: 'risk', label: 'Risk' },
  { value: 'context', label: 'Context' },
  { value: 'monitor', label: 'Monitor' },
];
const eventLabelClasses: Record<EventLabel, string> = {
  catalyst: 'border-emerald-900/70 bg-emerald-300/10 text-emerald-300',
  risk: 'border-amber-900/70 bg-amber-300/10 text-amber-300',
  context: 'border-slate-700 bg-slate-800/70 text-slate-400',
  monitor: 'border-sky-900/70 bg-sky-300/10 text-sky-300',
};
type NavLabel = (typeof nav)[number][0];
type SearchResult = {
  id: string;
  kind: 'event' | 'hypothesis' | 'study';
  title: string;
  meta: string;
};

function formatSourceTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function isEventLabel(value: unknown): value is EventLabel {
  return typeof value === 'string' && eventLabelOptions.some((option) => option.value === value);
}

function eventLabelText(value?: EventLabel) {
  return value ? eventLabelOptions.find((option) => option.value === value)?.label : undefined;
}

function isSecComparison(value: unknown): value is SecComparison {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<SecComparison>;
  return typeof candidate.entityName === 'string' &&
    typeof candidate.cik === 'string' &&
    /^\d{10}$/.test(candidate.cik) &&
    Boolean(candidate.metrics && typeof candidate.metrics === 'object') &&
    Boolean(candidate.quality && typeof candidate.quality === 'object') &&
    Array.isArray(candidate.filings) &&
    typeof candidate.fetchedAt === 'string';
}

function isStudyRun(value: unknown): value is StudyRun {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<StudyRun>;
  return typeof candidate.id === 'string' &&
    typeof candidate.executedAt === 'string' &&
    typeof candidate.asOfPeriod === 'string' &&
    (candidate.sourceState === 'fixture' || candidate.sourceState === 'live' || candidate.sourceState === 'fallback') &&
    (candidate.qualityStatus === 'pass' || candidate.qualityStatus === 'review' || candidate.qualityStatus === 'fixture') &&
    typeof candidate.evidenceCount === 'number' &&
    typeof candidate.filingCount === 'number' &&
    typeof candidate.metricCount === 'number' &&
    typeof candidate.transformCount === 'number' &&
    typeof candidate.inputSignature === 'string';
}

function inputSignature(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function EventRow({
  event,
  label,
  selected,
  onSelect,
}: {
  event: Event;
  label?: EventLabel;
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
          <span className="flex min-w-0 items-center gap-2">
            <span>{kindLabel[event.kind]}</span>
            {label && <span className={`truncate rounded border px-1.5 py-0.5 text-[9px] tracking-[.08em] ${eventLabelClasses[label]}`}>{eventLabelText(label)}</span>}
          </span>
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
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string | null>(null);
  const [sourceQuality, setSourceQuality] = useState<SourceQuality>(fixtureSourceQuality);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [metrics, setMetrics] = useState(snapshot.metrics);
  const [previousMetrics, setPreviousMetrics] = useState<Record<string, number>>(fixturePriorMetrics);
  const [metricHistory, setMetricHistory] = useState<MetricHistory>(fixtureMetricHistory);
  const [filings, setFilings] = useState(snapshot.filings);
  const [eventLabels, setEventLabels] = useState<Record<string, EventLabel>>({});
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
  const [labelFilter, setLabelFilter] = useState<EventLabelFilter>('all');
  const [hypothesisFilter, setHypothesisFilter] = useState<HypothesisFilter>('all');
  const [studyFilter, setStudyFilter] = useState<StudyFilter>('all');
  const [activeNav, setActiveNav] = useState<NavLabel>('Overview');
  const [draftKind, setDraftKind] = useState<'hypothesis' | 'study' | null>(
    null,
  );
  const [hypotheses, setHypotheses] = useState(snapshot.hypotheses);
  const [studies, setStudies] = useState(snapshot.studies);
  const [studyRuns, setStudyRuns] = useState<Record<string, StudyRun>>({});
  const [eventNotes, setEventNotes] = useState<Record<string, string>>({});
  const [hypothesisLinkId, setHypothesisLinkId] = useState('');
  const [studyLinkId, setStudyLinkId] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonCik, setComparisonCik] = useState('');
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [comparison, setComparison] = useState<SecComparison | null>(null);
  const [draftEditTarget, setDraftEditTarget] = useState<DraftTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'hypothesis' | 'study'; id: string; title: string } | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [citationMessage, setCitationMessage] = useState('');
  const [noteMessage, setNoteMessage] = useState('');
  const [labelMessage, setLabelMessage] = useState('');
  const [evidenceLinkMessage, setEvidenceLinkMessage] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const savedHypotheses = window.localStorage.getItem('catalyst:hypotheses');
      const savedStudies = window.localStorage.getItem('catalyst:studies');
      const savedStudyRuns = window.localStorage.getItem('catalyst:study-runs');
      const savedMetrics = window.localStorage.getItem('catalyst:metrics');
      const savedPreviousMetrics = window.localStorage.getItem('catalyst:previous-metrics');
      const savedMetricHistory = window.localStorage.getItem('catalyst:metric-history');
      const savedFilings = window.localStorage.getItem('catalyst:filings');
      const savedEventLabels = window.localStorage.getItem('catalyst:event-labels');
      const savedEventNotes = window.localStorage.getItem('catalyst:event-notes');
      const savedSourceState = window.localStorage.getItem('catalyst:source-state');
      const savedSourceUpdatedAt = window.localStorage.getItem('catalyst:source-updated-at');
      const savedSourceQuality = window.localStorage.getItem('catalyst:source-quality');
      const savedComparison = window.localStorage.getItem('catalyst:comparison');
      if (savedMetrics) {
        const parsedMetrics = JSON.parse(savedMetrics);
        if (Array.isArray(parsedMetrics)) setTimeout(() => setMetrics(parsedMetrics), 0);
      }
      if (savedPreviousMetrics) {
        const parsedPreviousMetrics = JSON.parse(savedPreviousMetrics);
        if (parsedPreviousMetrics && typeof parsedPreviousMetrics === 'object' && !Array.isArray(parsedPreviousMetrics)) setTimeout(() => setPreviousMetrics(parsedPreviousMetrics), 0);
      }
      if (savedMetricHistory) {
        const parsedMetricHistory = JSON.parse(savedMetricHistory);
        if (parsedMetricHistory && typeof parsedMetricHistory === 'object' && !Array.isArray(parsedMetricHistory)) setTimeout(() => setMetricHistory(parsedMetricHistory), 0);
      }
      if (savedFilings) {
        const parsedFilings = JSON.parse(savedFilings);
        if (Array.isArray(parsedFilings)) setTimeout(() => setFilings(parsedFilings), 0);
      }
      if (savedEventNotes) {
        const parsedEventNotes = JSON.parse(savedEventNotes);
        if (parsedEventNotes && typeof parsedEventNotes === 'object' && !Array.isArray(parsedEventNotes)) {
          const notes = Object.fromEntries(Object.entries(parsedEventNotes).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
          setTimeout(() => setEventNotes(notes), 0);
        }
      }
      if (savedEventLabels) {
        const parsedEventLabels = JSON.parse(savedEventLabels);
        if (parsedEventLabels && typeof parsedEventLabels === 'object' && !Array.isArray(parsedEventLabels)) {
          const labels = Object.fromEntries(Object.entries(parsedEventLabels).filter(([id, value]) => eventById.has(id) && isEventLabel(value))) as Record<string, EventLabel>;
          setTimeout(() => setEventLabels(labels), 0);
        }
      }
      if (savedSourceState === 'live' || savedSourceState === 'fallback') {
        setTimeout(() => setSourceState(savedSourceState), 0);
      }
      if (savedSourceUpdatedAt) setTimeout(() => setSourceUpdatedAt(savedSourceUpdatedAt), 0);
      if (savedSourceQuality) {
        const parsedSourceQuality = JSON.parse(savedSourceQuality);
        if (parsedSourceQuality && typeof parsedSourceQuality === 'object' && !Array.isArray(parsedSourceQuality)) {
          setTimeout(() => setSourceQuality(parsedSourceQuality as SourceQuality), 0);
        }
      }
      if (savedHypotheses) {
        const parsedHypotheses = JSON.parse(savedHypotheses);
        setTimeout(() => setHypotheses(parsedHypotheses), 0);
      }
      if (savedStudies) {
        const parsedStudies = JSON.parse(savedStudies);
        setTimeout(() => setStudies(parsedStudies), 0);
      }
      if (savedStudyRuns) {
        const parsedStudyRuns = JSON.parse(savedStudyRuns);
        if (parsedStudyRuns && typeof parsedStudyRuns === 'object' && !Array.isArray(parsedStudyRuns)) {
          const runs = Object.fromEntries(Object.entries(parsedStudyRuns).filter(([, value]) => isStudyRun(value))) as Record<string, StudyRun>;
          setTimeout(() => setStudyRuns(runs), 0);
        }
      }
      if (savedComparison) {
        const parsedComparison = JSON.parse(savedComparison);
        if (isSecComparison(parsedComparison)) setTimeout(() => setComparison(parsedComparison), 0);
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
      snapshot.events.filter((event) =>
        (eventFilter === 'all' || event.kind === eventFilter) &&
        (signalFilter === 'all' || event.signal === signalFilter) &&
        (labelFilter === 'all' || eventLabels[event.id] === labelFilter),
      ),
    [eventFilter, eventLabels, labelFilter, signalFilter],
  );
  const linkedHypotheses = useMemo(
    () => hypotheses.filter((hypothesis) => hypothesis.evidenceIds?.includes(selected.id)),
    [hypotheses, selected.id],
  );
  const linkableHypotheses = useMemo(
    () => hypotheses.filter((hypothesis) => !hypothesis.evidenceIds?.includes(selected.id)),
    [hypotheses, selected.id],
  );
  const linkedStudies = useMemo(
    () => studies.filter((study) => study.evidenceIds?.includes(selected.id)),
    [selected.id, studies],
  );
  const visibleHypotheses = useMemo(
    () => hypotheses.filter((hypothesis) => hypothesisFilter === 'all' || hypothesis.status === hypothesisFilter),
    [hypotheses, hypothesisFilter],
  );
  const visibleStudies = useMemo(
    () => studies.filter((study) => studyFilter === 'all' || study.state === studyFilter),
    [studies, studyFilter],
  );
  const linkableStudies = useMemo(
    () => studies.filter((study) => !study.evidenceIds?.includes(selected.id)),
    [selected.id, studies],
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
  function eventsForFilters(nextEventFilter: EventFilter, nextSignalFilter: SignalFilter, nextLabelFilter: EventLabelFilter) {
    return snapshot.events.filter((event) =>
      (nextEventFilter === 'all' || event.kind === nextEventFilter) &&
      (nextSignalFilter === 'all' || event.signal === nextSignalFilter) &&
      (nextLabelFilter === 'all' || eventLabels[event.id] === nextLabelFilter),
    );
  }
  function keepSelectionInView(nextEventFilter: EventFilter, nextSignalFilter: SignalFilter, nextLabelFilter: EventLabelFilter) {
    const nextEvents = eventsForFilters(nextEventFilter, nextSignalFilter, nextLabelFilter);
    if (nextEvents.length && !nextEvents.some((event) => event.id === selectedId)) {
      setSelectedId(nextEvents[0].id);
      setNoteMessage('');
      setEvidenceLinkMessage('');
      setHypothesisLinkId('');
      setStudyLinkId('');
    }
  }
  function changeEventFilter(nextFilter: EventFilter) {
    setEventFilter(nextFilter);
    setActiveNav(nextFilter === 'all' ? 'Event stream' : nextFilter === 'filing' ? 'Filings' : nextFilter === 'metric' ? 'Metrics' : 'Hypotheses');
    keepSelectionInView(nextFilter, signalFilter, labelFilter);
  }
  function changeSignalFilter(nextFilter: SignalFilter) {
    setSignalFilter(nextFilter);
    keepSelectionInView(eventFilter, nextFilter, labelFilter);
  }
  function changeLabelFilter(nextFilter: EventLabelFilter) {
    setLabelFilter(nextFilter);
    keepSelectionInView(eventFilter, signalFilter, nextFilter);
  }
  function resetEventFilters() {
    setEventFilter('all');
    setSignalFilter('all');
    setLabelFilter('all');
    setActiveNav('Event stream');
    setSelectedId(snapshot.events[0].id);
    setNoteMessage('');
    setEvidenceLinkMessage('');
    setHypothesisLinkId('');
    setStudyLinkId('');
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
    const targetId = label === 'Hypotheses' ? 'hypotheses-panel' : label === 'Filings' ? 'filings-panel' : label === 'Metrics' ? 'metrics-panel' : 'event-stream';
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function focusEvent(eventId: string) {
    setSelectedId(eventId);
    setEventFilter('all');
    setSignalFilter('all');
    setLabelFilter('all');
    setNoteMessage('');
    setEvidenceLinkMessage('');
    setHypothesisLinkId('');
    setStudyLinkId('');
    setActiveNav('Event stream');
    document.getElementById('event-stream')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function selectSearchResult(result: SearchResult) {
    setSearchOpen(false);
    setSearchQuery('');
    if (result.kind === 'event') {
      focusEvent(result.id);
      return;
    }
    setActiveNav('Hypotheses');
    document.getElementById(result.kind === 'study' ? 'research-queue' : 'hypotheses-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const netMargin = margin(metrics[2].value, metrics[0].value);
  const priorNetMargin = previousMetrics.netIncome && previousMetrics.revenue ? margin(previousMetrics.netIncome, previousMetrics.revenue) : null;
  const netMarginDelta = priorNetMargin ? `${Number(netMargin) >= Number(priorNetMargin) ? '↗' : '↘'} ${Math.abs((Number(netMargin) - Number(priorNetMargin)) * 100).toFixed(0)} bps YoY` : 'No prior annual fact';
  const yoyLabel = (metric: Metric) => metric.yoy === undefined ? 'No prior annual fact' : `${metric.yoy >= 0 ? '↗' : '↘'} ${Math.abs(metric.yoy).toFixed(1)}% YoY`;
  const openHypotheses = hypotheses.filter((hypothesis) => hypothesis.status !== 'parked').length;
  const activeStudies = studies.filter((study) => study.state === 'active').length;
  const evidenceBackedEvents = snapshot.events.filter((event) => event.evidence.length > 0).length;
  const sourceDescription = sourceState === 'live' ? 'Live SEC source' : sourceState === 'fallback' ? 'Fixture fallback' : 'Verified fixture';
  const sourceQualityLabel = sourceQuality.status === 'pass' ? 'Aligned' : sourceQuality.status === 'review' ? 'Review needed' : 'Fixture verified';
  const sourceQualityDetail = sourceQuality.missingMetrics ? `${sourceQuality.missingMetrics} metric${sourceQuality.missingMetrics === 1 ? '' : 's'} missing` : `${sourceQuality.duplicateFacts} duplicate facts · ${sourceQuality.amendedFilings} amendments`;
  async function refreshSource() {
    setSourceState('loading');
    try {
      const response = await fetch(`/api/sec?cik=${snapshot.company.cik}`);
      const payload = (await response.json()) as {
        mode?: string;
        fetchedAt?: string;
        metrics?: {
          revenue?: number;
          operatingIncome?: number;
          netIncome?: number;
        };
        priorMetrics?: Record<string, number>;
        periods?: Record<string, string>;
        history?: MetricHistory;
        quality?: SourceQuality;
        filings?: Filing[];
      };
      const checkedAt = payload.fetchedAt ?? new Date().toISOString();
      setSourceUpdatedAt(checkedAt);
      window.localStorage.setItem('catalyst:source-updated-at', checkedAt);
      if (payload.mode === 'live' && payload.metrics) {
        const nextMetrics = snapshot.metrics.map((metric) => {
          const key = metric.id === 'revenue' ? 'revenue' : metric.id === 'operating-income' ? 'operatingIncome' : 'netIncome';
          const value = payload.metrics?.[key] ?? metric.value;
          const prior = payload.priorMetrics?.[key];
          return {
            ...metric,
            value,
            period: payload.periods?.[key] ?? metric.period,
            yoy: prior !== undefined && prior !== 0 ? Number((((value - prior) / prior) * 100).toFixed(1)) : metric.yoy,
          };
        });
        setMetrics(nextMetrics);
        window.localStorage.setItem('catalyst:metrics', JSON.stringify(nextMetrics));
        const nextPreviousMetrics = payload.priorMetrics ?? fixturePriorMetrics;
        setPreviousMetrics(nextPreviousMetrics);
        window.localStorage.setItem('catalyst:previous-metrics', JSON.stringify(nextPreviousMetrics));
        const nextMetricHistory = payload.history ?? fixtureMetricHistory;
        setMetricHistory(nextMetricHistory);
        window.localStorage.setItem('catalyst:metric-history', JSON.stringify(nextMetricHistory));
        const nextFilings = payload.filings?.length ? payload.filings : snapshot.filings;
        setFilings(nextFilings);
        window.localStorage.setItem('catalyst:filings', JSON.stringify(nextFilings));
        setSourceState('live');
        window.localStorage.setItem('catalyst:source-state', 'live');
        const nextSourceQuality = payload.quality ?? fixtureSourceQuality;
        setSourceQuality(nextSourceQuality);
        window.localStorage.setItem('catalyst:source-quality', JSON.stringify(nextSourceQuality));
      } else {
        setMetrics(snapshot.metrics);
        window.localStorage.setItem('catalyst:metrics', JSON.stringify(snapshot.metrics));
        setPreviousMetrics(fixturePriorMetrics);
        window.localStorage.setItem('catalyst:previous-metrics', JSON.stringify(fixturePriorMetrics));
        setMetricHistory(fixtureMetricHistory);
        window.localStorage.setItem('catalyst:metric-history', JSON.stringify(fixtureMetricHistory));
        setFilings(snapshot.filings);
        setSourceState('fallback');
        window.localStorage.setItem('catalyst:source-state', 'fallback');
        setSourceQuality(fixtureSourceQuality);
        window.localStorage.setItem('catalyst:source-quality', JSON.stringify(fixtureSourceQuality));
      }
    } catch {
      const checkedAt = new Date().toISOString();
      setSourceUpdatedAt(checkedAt);
      window.localStorage.setItem('catalyst:source-updated-at', checkedAt);
      setMetrics(snapshot.metrics);
      window.localStorage.setItem('catalyst:metrics', JSON.stringify(snapshot.metrics));
      setPreviousMetrics(fixturePriorMetrics);
      window.localStorage.setItem('catalyst:previous-metrics', JSON.stringify(fixturePriorMetrics));
      setMetricHistory(fixtureMetricHistory);
      window.localStorage.setItem('catalyst:metric-history', JSON.stringify(fixtureMetricHistory));
      setFilings(snapshot.filings);
      setSourceState('fallback');
      window.localStorage.setItem('catalyst:source-state', 'fallback');
      setSourceQuality(fixtureSourceQuality);
      window.localStorage.setItem('catalyst:source-quality', JSON.stringify(fixtureSourceQuality));
    }
  }
  async function loadComparison() {
    const cik = comparisonCik.trim();
    if (!/^\d{10}$/.test(cik)) {
      setComparisonError('Enter a 10-digit SEC CIK.');
      return;
    }
    setComparisonLoading(true);
    setComparisonError('');
    try {
      const response = await fetch(`/api/sec?cik=${cik}`);
      const payload = (await response.json()) as {
        mode?: string;
        entityName?: string;
        cik?: string;
        metrics?: Record<string, number>;
        priorMetrics?: Record<string, number>;
        periods?: Record<string, string>;
        history?: MetricHistory;
        quality?: SourceQuality;
        filings?: Filing[];
        sourceUrl?: string;
        fetchedAt?: string;
      };
      if (!response.ok || payload.mode !== 'live' || !payload.entityName || !payload.metrics?.revenue || !payload.quality) {
        throw new Error('Comparison data unavailable');
      }
      const nextComparison: SecComparison = {
        entityName: payload.entityName,
        cik: payload.cik ?? cik,
        metrics: payload.metrics,
        priorMetrics: payload.priorMetrics ?? {},
        periods: payload.periods ?? {},
        history: payload.history ?? {},
        quality: payload.quality,
        filings: payload.filings ?? [],
        sourceUrl: payload.sourceUrl ?? `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
        fetchedAt: payload.fetchedAt ?? new Date().toISOString(),
      };
      setComparison(nextComparison);
      window.localStorage.setItem('catalyst:comparison', JSON.stringify(nextComparison));
      setComparisonOpen(false);
      setWorkspaceMessage({ text: `SEC comparison loaded: ${payload.entityName}` });
    } catch {
      setComparisonError('Could not load that company from SEC company facts.');
    } finally {
      setComparisonLoading(false);
    }
  }
  function clearComparison() {
    setComparison(null);
    window.localStorage.removeItem('catalyst:comparison');
    setWorkspaceMessage({ text: 'Company comparison cleared' });
  }
  function runStudy(study: (typeof snapshot.studies)[number]) {
    const evidenceIds = (study.evidenceIds ?? []).filter((eventId) => eventById.has(eventId));
    const runSourceState = sourceState === 'loading' ? 'fallback' : sourceState;
    const manifest = JSON.stringify({
      company: snapshot.company.cik,
      study: { id: study.id, title: study.title, state: study.state, evidenceIds },
      evidence: evidenceIds.map((eventId) => ({
        eventId,
        label: eventLabels[eventId] ?? null,
        note: eventNotes[eventId]?.trim() ?? '',
      })),
      metrics: metrics.map(({ id, value, period }) => ({ id, value, period })),
      previousMetrics,
      metricHistory,
      filings: filings.map(({ id, form, filedAt, periodEnd, accession, status }) => ({ id, form, filedAt, periodEnd, accession, status })),
      source: { state: runSourceState, quality: sourceQuality },
    });
    const run: StudyRun = {
      id: `run-${Date.now()}`,
      executedAt: new Date().toISOString(),
      asOfPeriod: sourceQuality.currentPeriod ?? metrics[0]?.period ?? 'Unavailable',
      sourceState: runSourceState,
      qualityStatus: sourceQuality.status,
      evidenceCount: evidenceIds.length,
      filingCount: filings.length,
      metricCount: metrics.length,
      transformCount: 3,
      inputSignature: inputSignature(manifest),
    };
    setStudyRuns((runs) => {
      const next = { ...runs, [study.id]: run };
      window.localStorage.setItem('catalyst:study-runs', JSON.stringify(next));
      return next;
    });
    setWorkspaceMessage({ text: `Study snapshot captured: ${study.title}` });
  }
  async function copyCitation() {
    const sourceUrl = selected.evidence[0]?.sourceUrl ?? '';
    const citation = `${selected.title} (${selected.date}). ${selected.summary} Source: ${selected.sourceLabel}. ${sourceUrl}`;
    try {
      await navigator.clipboard.writeText(citation);
      setCitationMessage('Citation copied');
    } catch {
      setCitationMessage('Copy unavailable');
    }
  }
  function saveEventNote() {
    const note = eventNotes[selected.id]?.trim() ?? '';
    const nextNotes = { ...eventNotes };
    if (note) nextNotes[selected.id] = note;
    else delete nextNotes[selected.id];
    setEventNotes(nextNotes);
    window.localStorage.setItem('catalyst:event-notes', JSON.stringify(nextNotes));
    setNoteMessage(note ? 'Note saved locally' : 'Note cleared');
  }
  function updateEventLabel(value: string) {
    const nextLabels = { ...eventLabels };
    if (isEventLabel(value)) nextLabels[selected.id] = value;
    else delete nextLabels[selected.id];
    setEventLabels(nextLabels);
    window.localStorage.setItem('catalyst:event-labels', JSON.stringify(nextLabels));
    setLabelMessage(isEventLabel(value) ? `${eventLabelText(value)} label saved` : 'Label cleared');
  }
  function linkSelectedEvent() {
    if (!hypothesisLinkId) return;
    setHypotheses((items) => {
      const next = items.map((item) => item.id === hypothesisLinkId
        ? { ...item, evidenceIds: Array.from(new Set([...(item.evidenceIds ?? []), selected.id])) }
        : item);
      window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
      return next;
    });
    setEvidenceLinkMessage('Evidence linked');
    setHypothesisLinkId('');
  }
  function unlinkSelectedEvent(hypothesisId: string) {
    setHypotheses((items) => {
      const next = items.map((item) => item.id === hypothesisId
        ? { ...item, evidenceIds: (item.evidenceIds ?? []).filter((eventId) => eventId !== selected.id) }
        : item);
      window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
      return next;
    });
    setEvidenceLinkMessage('Evidence unlinked');
  }
  function linkSelectedEventToStudy() {
    if (!studyLinkId) return;
    setStudies((items) => {
      const next = items.map((item) => item.id === studyLinkId
        ? { ...item, evidenceIds: Array.from(new Set([...(item.evidenceIds ?? []), selected.id])) }
        : item);
      window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
      return next;
    });
    setEvidenceLinkMessage('Evidence linked');
    setStudyLinkId('');
  }
  function unlinkSelectedEventFromStudy(studyId: string) {
    setStudies((items) => {
      const next = items.map((item) => item.id === studyId
        ? { ...item, evidenceIds: (item.evidenceIds ?? []).filter((eventId) => eventId !== selected.id) }
        : item);
      window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
      return next;
    });
    setEvidenceLinkMessage('Evidence unlinked');
  }
  function saveDraft(title: string, description: string, editTarget: DraftTarget | null) {
    if (editTarget?.kind === 'hypothesis') {
      setHypotheses((items) => {
        const next = items.map((item) => item.id === editTarget.id ? { ...item, title, description: description || 'Draft hypothesis queued for evidence.' } : item);
        window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
        return next;
      });
    } else if (editTarget?.kind === 'study') {
      setStudies((items) => {
        const next = items.map((item) => item.id === editTarget.id ? { ...item, title, updatedAt: 'Just now' } : item);
        window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
        return next;
      });
    } else if (draftKind === 'hypothesis') {
      setHypotheses((items) => {
        const next = [...items, { id: `h-local-${Date.now()}`, title, status: 'testing' as const, description: description || 'Draft hypothesis queued for evidence.' }];
        window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
        return next;
      });
    } else if (draftKind === 'study') {
      setStudies((items) => {
        const next = [...items, { id: `study-local-${Date.now()}`, title, owner: 'AT', state: 'active' as const, updatedAt: 'Just now', evidenceIds: [] }];
        window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
        return next;
      });
    }
    setDraftEditTarget(null);
    setDraftKind(null);
  }
  function openDraft(kind: 'hypothesis' | 'study', editTarget: DraftTarget | null = null) {
    setDraftEditTarget(editTarget);
    setDraftKind(kind);
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
    setStudyRuns((runs) => {
      if (!runs[deleteTarget.id]) return runs;
      const next = { ...runs };
      delete next[deleteTarget.id];
      window.localStorage.setItem('catalyst:study-runs', JSON.stringify(next));
      return next;
    });
    setDeleteTarget(null);
  }
  function advanceHypothesis(id: string) {
    setHypotheses((items) => {
      const next = items.map((item) => item.id === id ? { ...item, status: item.status === 'testing' ? 'supported' as const : item.status === 'supported' ? 'parked' as const : 'testing' as const } : item);
      window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(next));
      return next;
    });
  }
  function toggleStudyState(id: string) {
    setStudies((items) => {
      const next = items.map((item) => item.id === id ? { ...item, state: item.state === 'active' ? 'queued' as const : 'active' as const, updatedAt: 'Just now' } : item);
      window.localStorage.setItem('catalyst:studies', JSON.stringify(next));
      return next;
    });
  }
  function exportWorkspace() {
    const payload = {
      exportedAt: new Date().toISOString(),
      company: snapshot.company,
      filings,
      metrics,
      previousMetrics,
      metricHistory,
      events: snapshot.events,
      eventLabels,
      eventNotes,
      sourceState,
      sourceUpdatedAt,
      sourceQuality,
      hypotheses,
      studies,
      studyRuns,
      comparison,
      provenance: snapshot.provenance,
    };
    const downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `catalyst-${snapshot.company.ticker.toLowerCase()}-research.json`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setWorkspaceMessage({ text: 'Workspace exported' });
  }
  function exportBrief() {
    const notedEvents = snapshot.events.filter((event) => eventNotes[event.id]?.trim());
    const brief = [
      `# ${snapshot.company.name} (${snapshot.company.ticker}) Research Brief`,
      `Exported ${new Date().toISOString()}`,
      '',
      '## Snapshot',
      `- Sector: ${snapshot.company.sector}`,
      `- Exchange: ${snapshot.company.exchange}`,
      `- Source: ${sourceDescription}`,
      '',
      '## Data quality',
      `- Status: ${sourceQualityLabel}`,
      `- Current period: ${sourceQuality.currentPeriod ?? 'Unavailable'} (${sourceQuality.alignedCurrentPeriod ? 'aligned' : 'review needed'})`,
      `- Prior period: ${sourceQuality.priorPeriod ?? 'Unavailable'} (${sourceQuality.alignedPriorPeriod ? 'aligned' : 'review needed'})`,
      `- Duplicate annual facts: ${sourceQuality.duplicateFacts}`,
      `- Amended annual filings: ${sourceQuality.amendedFilings}`,
      `- Missing metrics: ${sourceQuality.missingMetrics}`,
      '',
      '## Metrics',
      ...metrics.map((metric) => `- **${metric.label}:** ${formatMetric(metric.value)} (${metric.period})`),
      '',
      '## Evidence stream',
      ...snapshot.events.map((event) => `- **${event.title}** (${event.date})${eventLabels[event.id] ? ` [${eventLabelText(eventLabels[event.id])}]` : ''} — ${event.summary} _${event.sourceLabel}_`),
      '',
      '## Analyst notes',
      ...(notedEvents.length ? notedEvents.map((event) => `- **${event.title}:** ${eventNotes[event.id].trim()}`) : ['- None captured']),
      '',
      '## Working hypotheses',
      ...hypotheses.map((hypothesis) => `- **${hypothesis.title}** [${hypothesis.status}] — ${hypothesis.description}`),
      '',
      '## Study queue',
      ...studies.map((study) => `- **${study.title}** [${study.state}] — ${study.owner}, updated ${study.updatedAt}`),
      '',
      '## Provenance',
      `- Adapter: ${snapshot.provenance.adapter}`,
      `- Captured: ${snapshot.provenance.capturedAt}`,
      `- Filing: ${filings[0]?.sourceUrl ?? 'Unavailable'}`,
    ].join('\n');
    const downloadUrl = URL.createObjectURL(new Blob([brief], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `catalyst-${snapshot.company.ticker.toLowerCase()}-research-brief.md`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setWorkspaceMessage({ text: 'Markdown brief exported' });
  }
  function exportMetricHistoryCsv() {
    const periods = Array.from(new Set(Object.values(metricHistory).flat().map((point) => point.period))).sort((a, b) => b.localeCompare(a));
    const valuesByMetric = Object.fromEntries(Object.entries(metricHistory).map(([key, points]) => [key, new Map(points.map((point) => [point.period, point.value]))]));
    const rows = [
      ['period', 'revenue_usd', 'operating_income_usd', 'net_income_usd'],
      ...periods.map((period) => [
        period,
        valuesByMetric.revenue?.get(period) ?? '',
        valuesByMetric.operatingIncome?.get(period) ?? '',
        valuesByMetric.netIncome?.get(period) ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => csvCell(value)).join(',')).join('\n');
    const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `catalyst-${snapshot.company.ticker.toLowerCase()}-metrics.csv`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setWorkspaceMessage({ text: 'Metric history CSV exported' });
  }
  function exportEventReviewCsv() {
    const view = `kind=${eventFilter}; signal=${signalFilter}; label=${labelFilter}`;
    const rows = [
      ['date', 'kind', 'title', 'signal', 'analyst_label', 'confidence', 'source', 'note', 'linked_hypotheses', 'linked_studies', 'view'],
      ...visibleEvents.map((event) => {
        const linkedHypothesisTitles = hypotheses.filter((hypothesis) => hypothesis.evidenceIds?.includes(event.id)).map((hypothesis) => hypothesis.title).join('; ');
        const linkedStudyTitles = studies.filter((study) => study.evidenceIds?.includes(event.id)).map((study) => study.title).join('; ');
        return [
          event.date,
          kindLabel[event.kind],
          event.title,
          event.signal,
          eventLabelText(eventLabels[event.id]) ?? '',
          `${Math.round(event.confidence * 100)}%`,
          event.sourceLabel,
          eventNotes[event.id]?.trim() ?? '',
          linkedHypothesisTitles,
          linkedStudyTitles,
          view,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((value) => csvCell(value)).join(',')).join('\n');
    const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `catalyst-${snapshot.company.ticker.toLowerCase()}-event-review.csv`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setWorkspaceMessage({ text: 'Event review CSV exported' });
  }
  function exportStudyPacket(study: (typeof snapshot.studies)[number]) {
    const evidence = (study.evidenceIds ?? []).flatMap((eventId) => {
      const event = eventById.get(eventId);
      return event ? [{
        event,
        analystLabel: eventLabelText(eventLabels[eventId]) ?? null,
        analystNote: eventNotes[eventId]?.trim() ?? '',
      }] : [];
    });
    const packet = {
      kind: 'catalyst.study-packet',
      version: 1,
      exportedAt: new Date().toISOString(),
      company: snapshot.company,
      study,
      lastRun: studyRuns[study.id] ?? null,
      evidence,
      metrics: {
        current: metrics,
        prior: previousMetrics,
        history: metricHistory,
        transforms: [
          { label: 'Revenue growth', formula: 'Revenue current ÷ prior − 1' },
          { label: 'Operating margin', formula: 'Operating income ÷ revenue' },
          { label: 'Net margin', formula: 'Net income ÷ revenue' },
        ],
      },
      filings,
      source: { state: sourceState, updatedAt: sourceUpdatedAt, quality: sourceQuality },
      provenance: snapshot.provenance,
    };
    const downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `catalyst-${snapshot.company.ticker.toLowerCase()}-${study.id}-packet.json`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setWorkspaceMessage({ text: `Study packet exported: ${study.title}` });
  }
  function exportComparison() {
    if (!comparison) return;
    const packet = {
      kind: 'catalyst.company-comparison',
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace: {
        company: snapshot.company,
        metrics,
        previousMetrics,
        metricHistory,
        filings,
        source: { state: sourceState, updatedAt: sourceUpdatedAt, quality: sourceQuality },
        provenance: snapshot.provenance,
      },
      comparison,
      comparisonRules: {
        crossCompanyPeriodMatch: comparison.periods.revenue === metrics[0]?.period,
        note: 'Compare reported values only after checking annual period alignment and source quality.',
      },
    };
    const downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `catalyst-${snapshot.company.ticker.toLowerCase()}-vs-${comparison.cik}-comparison.json`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setWorkspaceMessage({ text: 'Company comparison exported' });
  }
  async function importWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as {
        company?: { cik?: string };
        metrics?: typeof snapshot.metrics;
        previousMetrics?: Record<string, number>;
        metricHistory?: MetricHistory;
        filings?: typeof snapshot.filings;
        eventLabels?: Record<string, EventLabel>;
        eventNotes?: Record<string, string>;
        sourceState?: 'fixture' | 'live' | 'fallback';
        sourceUpdatedAt?: string | null;
        sourceQuality?: SourceQuality;
        hypotheses?: typeof snapshot.hypotheses;
        studies?: typeof snapshot.studies;
        studyRuns?: Record<string, StudyRun>;
        comparison?: SecComparison | null;
      };
      if (payload.company?.cik !== snapshot.company.cik || !Array.isArray(payload.metrics) || !Array.isArray(payload.hypotheses) || !Array.isArray(payload.studies)) {
        throw new Error('Unsupported workspace file');
      }
      if (payload.comparison !== undefined && payload.comparison !== null && !isSecComparison(payload.comparison)) {
        throw new Error('Unsupported comparison data');
      }
      setMetrics(payload.metrics);
      const nextPreviousMetrics = payload.previousMetrics ?? fixturePriorMetrics;
      setPreviousMetrics(nextPreviousMetrics);
      window.localStorage.setItem('catalyst:previous-metrics', JSON.stringify(nextPreviousMetrics));
      const nextMetricHistory = payload.metricHistory ?? fixtureMetricHistory;
      setMetricHistory(nextMetricHistory);
      window.localStorage.setItem('catalyst:metric-history', JSON.stringify(nextMetricHistory));
      const nextEventLabels = payload.eventLabels && typeof payload.eventLabels === 'object' && !Array.isArray(payload.eventLabels)
        ? Object.fromEntries(Object.entries(payload.eventLabels).filter(([id, value]) => eventById.has(id) && isEventLabel(value))) as Record<string, EventLabel>
        : {};
      setEventLabels(nextEventLabels);
      window.localStorage.setItem('catalyst:event-labels', JSON.stringify(nextEventLabels));
      if (Array.isArray(payload.filings) && payload.filings.length) {
        setFilings(payload.filings);
        window.localStorage.setItem('catalyst:filings', JSON.stringify(payload.filings));
      }
      const nextEventNotes = payload.eventNotes && typeof payload.eventNotes === 'object' && !Array.isArray(payload.eventNotes)
        ? Object.fromEntries(Object.entries(payload.eventNotes).filter(([id, value]) => snapshot.events.some((event) => event.id === id) && typeof value === 'string')) as Record<string, string>
        : {};
      setEventNotes(nextEventNotes);
      window.localStorage.setItem('catalyst:event-notes', JSON.stringify(nextEventNotes));
      if (payload.sourceState === 'fixture' || payload.sourceState === 'live' || payload.sourceState === 'fallback') {
        setSourceState(payload.sourceState);
        window.localStorage.setItem('catalyst:source-state', payload.sourceState);
      }
      if (typeof payload.sourceUpdatedAt === 'string') {
        setSourceUpdatedAt(payload.sourceUpdatedAt);
        window.localStorage.setItem('catalyst:source-updated-at', payload.sourceUpdatedAt);
      }
      if (payload.sourceQuality && typeof payload.sourceQuality === 'object') {
        setSourceQuality(payload.sourceQuality);
        window.localStorage.setItem('catalyst:source-quality', JSON.stringify(payload.sourceQuality));
      }
      setHypotheses(payload.hypotheses);
      setStudies(payload.studies);
      const nextStudyRuns = payload.studyRuns && typeof payload.studyRuns === 'object' && !Array.isArray(payload.studyRuns)
        ? Object.fromEntries(Object.entries(payload.studyRuns).filter(([, value]) => isStudyRun(value))) as Record<string, StudyRun>
        : {};
      setStudyRuns(nextStudyRuns);
      if (payload.comparison === null) {
        setComparison(null);
        window.localStorage.removeItem('catalyst:comparison');
      } else if (payload.comparison) {
        setComparison(payload.comparison);
        window.localStorage.setItem('catalyst:comparison', JSON.stringify(payload.comparison));
      }
      window.localStorage.setItem('catalyst:metrics', JSON.stringify(payload.metrics));
      window.localStorage.setItem('catalyst:hypotheses', JSON.stringify(payload.hypotheses));
      window.localStorage.setItem('catalyst:studies', JSON.stringify(payload.studies));
      window.localStorage.setItem('catalyst:study-runs', JSON.stringify(nextStudyRuns));
      setWorkspaceMessage({ text: 'Workspace imported' });
    } catch {
      setWorkspaceMessage({ text: 'Import failed: choose a Catalyst MSFT export', error: true });
    }
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
              RESEARCH CORE
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
                  {sourceUpdatedAt ? `Source checked ${formatSourceTime(sourceUpdatedAt)}` : 'Fixture snapshot'}
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
                  onClick={() => openDraft('hypothesis')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-[#101a21] px-3 py-2.5 text-xs font-semibold text-slate-300"
                >
                  <Target size={15} /> Add hypothesis
                </button>
                <button
                  type="button"
                  onClick={() => openDraft('study')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-300 px-3 py-2.5 text-xs font-semibold text-slate-950"
                >
                  <FlaskConical size={15} /> New study
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComparisonError('');
                    setComparisonOpen(true);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-900/80 bg-sky-300/10 px-3 py-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-300/15"
                >
                  <BarChart3 size={15} /> Compare SEC
                </button>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              {[
                [`Revenue`, formatMetric(metrics[0].value), yoyLabel(metrics[0])],
                [
                  'Operating income',
                  formatMetric(metrics[1].value),
                  yoyLabel(metrics[1]),
                ],
                ['Net margin', `${netMargin}%`, netMarginDelta],
                [
                  'Data coverage',
                  `${filings.length} filing${filings.length === 1 ? '' : 's'}`,
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
                      {i < 3 ? metrics[i]?.period : ''}
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
            <section className="mt-4 rounded-xl border border-slate-800 bg-[#101820]/75 p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">WORKSPACE PULSE</span>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Research health</h2>
                </div>
                <span className="text-[11px] text-slate-500">Updated from the current evidence graph</span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {[
                  { label: 'Open hypotheses', value: `${openHypotheses}/${hypotheses.length}`, detail: 'Need a next decision', icon: <BrainCircuit size={15} /> },
                  { label: 'Active studies', value: `${activeStudies}/${studies.length}`, detail: 'Currently in motion', icon: <FlaskConical size={15} /> },
                  { label: 'Evidence coverage', value: `${evidenceBackedEvents}/${snapshot.events.length}`, detail: 'Events with sources', icon: <FileText size={15} /> },
                  { label: 'Source freshness', value: sourceState === 'live' ? 'Live' : 'Ready', detail: sourceDescription, icon: <Database size={15} /> },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg border border-slate-800/90 bg-[#0b1319]/70 p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-950 text-emerald-300">{item.icon}</span>
                    <span className="grid min-w-0 gap-0.5">
                      <small className="truncate text-[10px] uppercase tracking-[.08em] text-slate-500">{item.label}</small>
                      <strong className="text-lg leading-tight tracking-tight text-slate-200">{item.value}</strong>
                      <span className="truncate text-[10px] text-slate-500">{item.detail}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <button type="button" onClick={() => setQualityOpen(true)} aria-label="Open data quality details" className={`mt-2 flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-left text-[10px] ${sourceQuality.status === 'review' ? 'border-amber-900/70 bg-amber-950/15 text-amber-200' : 'border-emerald-900/60 bg-emerald-950/10 text-emerald-200'}`}>
              <span className="font-bold uppercase tracking-[.12em] text-slate-500">Data quality</span>
              <strong>{sourceQualityLabel}</strong>
              <span className="text-slate-500">Current period {sourceQuality.currentPeriod ?? 'Unavailable'}</span>
              {sourceQuality.priorPeriod && <span className="text-slate-500">Prior period {sourceQuality.priorPeriod}</span>}
              <span className="text-slate-500">{sourceQualityDetail}</span>
              <ArrowUpRight size={12} className="ml-auto text-slate-600" />
            </button>
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-[11px] text-slate-400">
                      <span className="sr-only">Filter event kind</span>
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
                    <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-[11px] text-slate-400">
                      <span className="sr-only">Filter event signal</span>
                      <select
                        value={signalFilter}
                        onChange={(event) => changeSignalFilter(event.target.value as SignalFilter)}
                        className="bg-transparent text-[11px] text-slate-400 outline-none"
                      >
                        <option value="all">All signals</option>
                        <option value="positive">Positive</option>
                        <option value="watch">Watch</option>
                        <option value="neutral">Neutral</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-[11px] text-slate-400">
                      <span className="sr-only">Filter analyst label</span>
                      <select
                        value={labelFilter}
                        onChange={(event) => changeLabelFilter(event.target.value as EventLabelFilter)}
                        className="bg-transparent text-[11px] text-slate-400 outline-none"
                      >
                        <option value="all">All labels</option>
                        {eventLabelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>
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
                  {(eventFilter !== 'all' || signalFilter !== 'all' || labelFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={resetEventFilters}
                      className="text-emerald-300 hover:text-emerald-200"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="relative mt-1 pl-0 before:absolute before:bottom-5 before:left-[5px] before:top-5 before:border-l before:border-dashed before:border-slate-700">
                  {visibleEvents.length ? visibleEvents.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      label={eventLabels[event.id]}
                      selected={selected.id === event.id}
                      onSelect={() => {
                        setSelectedId(event.id);
                        setNoteMessage('');
                        setLabelMessage('');
                        setHypothesisLinkId('');
                        setStudyLinkId('');
                      }}
                    />
                  )) : (
                    <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center">
                      <strong className="block text-sm font-semibold text-slate-300">No matching events</strong>
                      <span className="mt-1 block text-xs text-slate-500">Try a broader event or signal filter.</span>
                      <button
                        type="button"
                        onClick={resetEventFilters}
                        className="mt-3 rounded border border-emerald-900 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-300/10"
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
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
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`block w-fit rounded px-1.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${selected.signal === 'watch' ? 'bg-amber-300/15 text-amber-300' : selected.signal === 'neutral' ? 'bg-slate-700 text-slate-300' : 'bg-emerald-300/15 text-emerald-300'}`}
                      >
                        {kindLabel[selected.kind]}
                      </span>
                      {eventLabels[selected.id] && <span className={`rounded border px-1.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${eventLabelClasses[eventLabels[selected.id]]}`}>{eventLabelText(eventLabels[selected.id])}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Reset detail"
                    onClick={() => {
                      setSelectedId(snapshot.events[0].id);
                      setNoteMessage('');
                      setHypothesisLinkId('');
                      setStudyLinkId('');
                    }}
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
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                  <label htmlFor="selected-event-label" className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Analyst label</label>
                  <div className="flex items-center gap-2">
                    {labelMessage && <output className="text-[10px] text-emerald-300">{labelMessage}</output>}
                    <select
                      id="selected-event-label"
                      aria-label="Set analyst event label"
                      value={eventLabels[selected.id] ?? ''}
                      onChange={(event) => updateEventLabel(event.target.value)}
                      className="rounded-lg border border-slate-800 bg-[#0b1319] px-2.5 py-2 text-[11px] text-slate-400 outline-none focus:border-emerald-900"
                    >
                      <option value="">Unlabeled</option>
                      {eventLabelOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
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
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Analyst note</span>
                    <span className="text-[10px] text-slate-600">Saved on this device</span>
                  </div>
                  <textarea
                    value={eventNotes[selected.id] ?? ''}
                    onChange={(event) => {
                      setEventNotes((notes) => ({ ...notes, [selected.id]: event.target.value }));
                      setNoteMessage('Unsaved changes');
                    }}
                    placeholder="What would change your mind about this signal?"
                    rows={3}
                    className="mt-2 w-full resize-y rounded-lg border border-slate-800 bg-[#0b1319] px-3 py-2 text-xs leading-5 text-slate-300 outline-none placeholder:text-slate-600 focus:border-emerald-900"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-600">Private to this browser</span>
                    <div className="flex items-center gap-2">
                      {noteMessage && <output className="text-[10px] text-emerald-300">{noteMessage}</output>}
                      <button
                        type="button"
                        onClick={saveEventNote}
                        className="rounded border border-emerald-900 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-300/10"
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Hypothesis links</span>
                    <span className="text-[10px] text-slate-600">{linkedHypotheses.length} connected</span>
                  </div>
                  {linkedHypotheses.length ? (
                    <div className="mt-2 grid gap-1.5">
                      {linkedHypotheses.map((hypothesis) => (
                        <div key={hypothesis.id} className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/15 px-2.5 py-2">
                          <BrainCircuit size={13} className="shrink-0 text-emerald-300" />
                          <span className="min-w-0 flex-1 truncate text-[11px] text-emerald-100">{hypothesis.title}</span>
                          <button
                            type="button"
                            onClick={() => unlinkSelectedEvent(hypothesis.id)}
                            className="text-[10px] text-slate-500 hover:text-amber-300"
                          >
                            Unlink
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-600">No working hypothesis is linked to this event yet.</p>
                  )}
                  {linkableHypotheses.length ? (
                    <div className="mt-2 flex gap-2">
                      <select
                        aria-label="Choose hypothesis to link"
                        value={hypothesisLinkId}
                        onChange={(event) => setHypothesisLinkId(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-[#0b1319] px-2.5 py-2 text-[11px] text-slate-400 outline-none focus:border-emerald-900"
                      >
                        <option value="">Link a hypothesis…</option>
                        {linkableHypotheses.map((hypothesis) => <option key={hypothesis.id} value={hypothesis.id}>{hypothesis.title}</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={!hypothesisLinkId}
                        onClick={linkSelectedEvent}
                        className="rounded border border-emerald-900 px-2.5 py-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Link
                      </button>
                    </div>
                  ) : (
                    <span className="mt-2 block text-[10px] text-slate-600">All hypotheses are already linked to this event.</span>
                  )}
                  {evidenceLinkMessage && <output className="mt-2 block text-[10px] text-emerald-300">{evidenceLinkMessage}</output>}
                </div>
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[.13em] text-slate-500">Study links</span>
                    <span className="text-[10px] text-slate-600">{linkedStudies.length} connected</span>
                  </div>
                  {linkedStudies.length ? (
                    <div className="mt-2 grid gap-1.5">
                      {linkedStudies.map((study) => (
                        <div key={study.id} className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/15 px-2.5 py-2">
                          <FlaskConical size={13} className="shrink-0 text-emerald-300" />
                          <span className="min-w-0 flex-1 truncate text-[11px] text-emerald-100">{study.title}</span>
                          <button
                            type="button"
                            onClick={() => unlinkSelectedEventFromStudy(study.id)}
                            className="text-[10px] text-slate-500 hover:text-amber-300"
                          >
                            Unlink
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-600">No research study is linked to this event yet.</p>
                  )}
                  {linkableStudies.length ? (
                    <div className="mt-2 flex gap-2">
                      <select
                        aria-label="Choose study to link"
                        value={studyLinkId}
                        onChange={(event) => setStudyLinkId(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-[#0b1319] px-2.5 py-2 text-[11px] text-slate-400 outline-none focus:border-emerald-900"
                      >
                        <option value="">Link a study…</option>
                        {linkableStudies.map((study) => <option key={study.id} value={study.id}>{study.title}</option>)}
                      </select>
                      <button
                        type="button"
                        disabled={!studyLinkId}
                        onClick={linkSelectedEventToStudy}
                        className="rounded border border-emerald-900 px-2.5 py-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Link
                      </button>
                    </div>
                  ) : (
                    <span className="mt-2 block text-[10px] text-slate-600">All studies are already linked to this event.</span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={selected.evidence[0].sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 no-underline"
                  >
                    Open source filing <ArrowUpRight size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={copyCitation}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                  >
                    <Copy size={12} /> Copy citation
                  </button>
                  {citationMessage && <output className="text-[10px] text-emerald-300">{citationMessage}</output>}
                </div>
              </aside>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(330px,.66fr)]">
              <FilingCard filings={filings} />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(330px,.66fr)]">
              <MetricsCard metrics={metrics} previousMetrics={previousMetrics} metricHistory={metricHistory} />
            </div>
            {comparison && (
              <CompanyComparisonCard
                comparison={comparison}
                workspaceCompany={snapshot.company}
                workspaceMetrics={metrics}
                onExport={exportComparison}
                onClear={clearComparison}
              />
            )}
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(330px,.66fr)]">
              <ResearchCard
                id="hypotheses-panel"
                title="What to test next"
                kicker="WORKING HYPOTHESES"
                actions={(
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-[11px] text-slate-400">
                    <span className="sr-only">Filter hypothesis status</span>
                    <select
                      value={hypothesisFilter}
                      onChange={(event) => setHypothesisFilter(event.target.value as HypothesisFilter)}
                      className="bg-transparent text-[11px] text-slate-400 outline-none"
                    >
                      <option value="all">All statuses</option>
                      <option value="testing">Testing</option>
                      <option value="supported">Supported</option>
                      <option value="parked">Parked</option>
                    </select>
                  </label>
                )}
              >
                {visibleHypotheses.length ? visibleHypotheses.map((h) => (
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
                      <small className="text-[10px] text-slate-600">
                        {h.evidenceIds?.length ?? 0} linked event{(h.evidenceIds?.length ?? 0) === 1 ? '' : 's'}
                      </small>
                      {h.evidenceIds?.length ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] text-slate-600">Jump to</span>
                          {h.evidenceIds.map((eventId) => {
                            const event = eventById.get(eventId);
                            return event ? (
                              <button
                                key={eventId}
                                type="button"
                                onClick={() => focusEvent(eventId)}
                                className="max-w-full truncate rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                              >
                                {event.title}
                              </button>
                            ) : null;
                          })}
                        </div>
                      ) : null}
                    </span>
                  <em className="rounded bg-emerald-950 px-1.5 py-1 text-[9px] font-bold uppercase not-italic text-emerald-200">
                    {h.status}
                  </em>
                  <button
                    type="button"
                    aria-label={`Edit ${h.title}`}
                    onClick={() => openDraft('hypothesis', { kind: 'hypothesis', id: h.id, title: h.title, description: h.description })}
                    className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-emerald-950/40 hover:text-emerald-300"
                  >
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => advanceHypothesis(h.id)} className="rounded border border-slate-700 px-1.5 py-1 text-[9px] font-semibold text-slate-400 hover:border-emerald-800 hover:text-emerald-300">
                    {h.status === 'testing' ? 'Support' : h.status === 'supported' ? 'Park' : 'Reopen'}
                  </button>
                  {h.id.startsWith('h-local-') && (
                    <button type="button" aria-label={`Remove ${h.title}`} onClick={() => setDeleteTarget({ kind: 'hypothesis', id: h.id, title: h.title })} className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-red-950/40 hover:text-red-300">
                      <Trash2 size={13} />
                    </button>
                  )}
                  </div>
                )) : (
                  <div className="border-t border-slate-800/80 py-8 text-center">
                    <strong className="block text-sm font-semibold text-slate-300">No matching hypotheses</strong>
                    <span className="mt-1 block text-xs text-slate-500">Try another status filter.</span>
                    <button type="button" onClick={() => setHypothesisFilter('all')} className="mt-3 rounded border border-emerald-900 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-300/10">Show all hypotheses</button>
                  </div>
                )}
              </ResearchCard>
              <ResearchCard
                id="research-queue"
                title="Research queue"
                kicker="ACTIVE STUDIES"
                actions={(
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#101a21] px-2.5 py-2 text-[11px] text-slate-400">
                    <span className="sr-only">Filter study state</span>
                    <select
                      value={studyFilter}
                      onChange={(event) => setStudyFilter(event.target.value as StudyFilter)}
                      className="bg-transparent text-[11px] text-slate-400 outline-none"
                    >
                      <option value="all">All states</option>
                      <option value="active">Active</option>
                      <option value="queued">Queued</option>
                    </select>
                  </label>
                )}
              >
                {visibleStudies.length ? visibleStudies.map((s) => {
                  const run = studyRuns[s.id];
                  return (
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
                      <small className="text-[10px] text-slate-600">
                        {s.evidenceIds?.length ?? 0} linked event{(s.evidenceIds?.length ?? 0) === 1 ? '' : 's'}
                      </small>
                      {run ? (
                        <small className="text-[10px] text-emerald-300/80">
                          Last run {formatSourceTime(run.executedAt)} · {run.asOfPeriod} · {run.sourceState} source · quality {run.qualityStatus} · {run.inputSignature}
                        </small>
                      ) : (
                        <small className="text-[10px] text-slate-600">No reproducible run captured</small>
                      )}
                      {s.evidenceIds?.length ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] text-slate-600">Jump to</span>
                          {s.evidenceIds.map((eventId) => {
                            const event = eventById.get(eventId);
                            return event ? (
                              <button
                                key={eventId}
                                type="button"
                                onClick={() => focusEvent(eventId)}
                                className="max-w-full truncate rounded border border-slate-700 px-1.5 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                              >
                                {event.title}
                              </button>
                            ) : null;
                          })}
                        </div>
                      ) : null}
                    </span>
                  <em className="rounded bg-slate-800 px-1.5 py-1 text-[9px] font-bold uppercase not-italic text-slate-400">
                    {s.state}
                  </em>
                  <button
                    type="button"
                    aria-label={`Edit ${s.title}`}
                    onClick={() => openDraft('study', { kind: 'study', id: s.id, title: s.title, description: '' })}
                    className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-emerald-950/40 hover:text-emerald-300"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Export packet for ${s.title}`}
                    title="Export study packet"
                    onClick={() => exportStudyPacket(s)}
                    className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-emerald-950/40 hover:text-emerald-300"
                  >
                    <Download size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Run snapshot for ${s.title}`}
                    title="Capture reproducible study snapshot"
                    onClick={() => runStudy(s)}
                    disabled={sourceState === 'loading'}
                    className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-emerald-950/40 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Play size={13} />
                  </button>
                  <button type="button" onClick={() => toggleStudyState(s.id)} className="rounded border border-slate-700 px-1.5 py-1 text-[9px] font-semibold text-slate-400 hover:border-emerald-800 hover:text-emerald-300">
                    {s.state === 'active' ? 'Queue' : 'Start'}
                  </button>
                  {s.id.startsWith('study-local-') && (
                    <button type="button" aria-label={`Remove ${s.title}`} onClick={() => setDeleteTarget({ kind: 'study', id: s.id, title: s.title })} className="grid h-7 w-7 place-items-center rounded text-slate-600 hover:bg-red-950/40 hover:text-red-300">
                      <Trash2 size={13} />
                    </button>
                  )}
                  </div>
                  );
                }) : (
                  <div className="border-t border-slate-800/80 py-8 text-center">
                    <strong className="block text-sm font-semibold text-slate-300">No matching studies</strong>
                    <span className="mt-1 block text-xs text-slate-500">Try another queue state.</span>
                    <button type="button" onClick={() => setStudyFilter('all')} className="mt-3 rounded border border-emerald-900 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-300/10">Show all studies</button>
                  </div>
                )}
              </ResearchCard>
            </div>
            <footer className="flex flex-col justify-between gap-2 py-5 text-[10px] text-slate-600 sm:flex-row">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <Database size={13} /> Source: {sourceDescription} · CIK{' '}
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
                <button
                  type="button"
                  onClick={exportWorkspace}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                >
                  <Download size={12} /> Export workspace
                </button>
                <button
                  type="button"
                  onClick={exportBrief}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                >
                  <FileText size={12} /> Export brief
                </button>
                <button
                  type="button"
                  onClick={exportMetricHistoryCsv}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                >
                  <Download size={12} /> Export metrics CSV
                </button>
                <button
                  type="button"
                  onClick={exportEventReviewCsv}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                >
                  <Download size={12} /> Export event review
                </button>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:border-emerald-900 hover:text-emerald-300"
                >
                  <Upload size={12} /> Import workspace
                </button>
                <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importWorkspace} className="hidden" />
                {workspaceMessage && <output className={`text-[10px] ${workspaceMessage.error ? 'text-red-300' : 'text-emerald-300'}`}>{workspaceMessage.text}</output>}
              </div>
              <span>Research core · local-first workspace</span>
            </footer>
          </div>
        </section>
      </main>
      <DraftDialog
        kind={draftKind}
        editTarget={draftEditTarget}
        open={draftKind !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDraftKind(null);
            setDraftEditTarget(null);
          }
        }}
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
      <QualityDialog
        open={qualityOpen}
        onOpenChange={setQualityOpen}
        quality={sourceQuality}
        sourceDescription={sourceDescription}
      />
      <CompareDialog
        open={comparisonOpen}
        onOpenChange={(open) => {
          setComparisonOpen(open);
          if (!open) setComparisonError('');
        }}
        cik={comparisonCik}
        onCikChange={setComparisonCik}
        loading={comparisonLoading}
        error={comparisonError}
        onSubmit={loadComparison}
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

function FilingCard({ filings }: { filings: Filing[] }) {
  return (
    <section id="filings-panel" className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#101820]/75 p-4 sm:p-5 xl:col-span-2">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">SOURCE ARCHIVE</span>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Filings</h2>
        </div>
        <span className="text-[11px] text-slate-500">{filings.length} linked filing{filings.length === 1 ? '' : 's'}</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[650px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase tracking-[.12em] text-slate-600">
              <th className="px-2 py-2 font-semibold">Form</th>
              <th className="px-2 py-2 font-semibold">Filed</th>
              <th className="px-2 py-2 font-semibold">Period end</th>
              <th className="px-2 py-2 font-semibold">Accession</th>
              <th className="px-2 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filings.map((filing) => (
              <tr key={filing.id} className="border-b border-slate-800/70 last:border-0">
                <td className="px-2 py-3 font-semibold text-slate-200">{filing.form}</td>
                <td className="px-2 py-3 text-slate-400">{filing.filedAt}</td>
                <td className="px-2 py-3 text-slate-400">{filing.periodEnd}</td>
                <td className="px-2 py-3 font-mono text-[11px] text-slate-500">{filing.accession}</td>
                <td className="px-2 py-3 text-right">
                  <a href={filing.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-emerald-300 no-underline hover:bg-emerald-300/20">
                    {filing.status === 'fixture' ? 'Verified fixture' : 'Verified'} <ArrowUpRight size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompanyComparisonCard({
  comparison,
  workspaceCompany,
  workspaceMetrics,
  onExport,
  onClear,
}: {
  comparison: SecComparison;
  workspaceCompany: typeof snapshot.company;
  workspaceMetrics: Metric[];
  onExport: () => void;
  onClear: () => void;
}) {
  const rows: Array<{ key: 'revenue' | 'operatingIncome' | 'netIncome'; label: string; workspaceMetric?: Metric }> = [
    { key: 'revenue', label: 'Revenue', workspaceMetric: workspaceMetrics[0] },
    { key: 'operatingIncome', label: 'Operating income', workspaceMetric: workspaceMetrics[1] },
    { key: 'netIncome', label: 'Net income', workspaceMetric: workspaceMetrics[2] },
  ];
  const qualityLabel = comparison.quality.status === 'pass' ? 'Aligned' : comparison.quality.status === 'review' ? 'Review needed' : 'Fixture';
  const workspacePeriod = workspaceMetrics[0]?.period ?? 'Current';
  const comparisonPeriod = comparison.periods.revenue ?? 'Annual';
  const periodsAligned = workspacePeriod === comparisonPeriod;
  return (
    <section className="mt-4 rounded-xl border border-sky-900/70 bg-[#101820]/75 p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <span className="text-[10px] font-bold tracking-[.13em] text-sky-300/70">SEC COMPARISON</span>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{workspaceCompany.name} vs {comparison.entityName}</h2>
          <p className="mt-1 text-[11px] text-slate-500">CIK {comparison.cik} · captured {formatSourceTime(comparison.fetchedAt)} · live company facts</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={comparison.sourceUrl} target="_blank" rel="noreferrer" className="rounded border border-slate-800 px-2.5 py-2 text-[10px] font-semibold text-slate-400 no-underline hover:border-sky-900 hover:text-sky-200">Open SEC source</a>
          <button type="button" onClick={onExport} className="inline-flex items-center gap-1.5 rounded border border-slate-800 px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:border-sky-900 hover:text-sky-200"><Download size={12} /> Export compare</button>
          <button type="button" onClick={onClear} className="rounded border border-slate-800 px-2.5 py-2 text-[10px] font-semibold text-slate-400 hover:border-sky-900 hover:text-sky-200">Clear compare</button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {rows.map((row) => {
          const peerValue = comparison.metrics[row.key];
          return (
            <article key={row.key} className="rounded-lg border border-slate-800/90 bg-[#0b1319]/70 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">{row.label}</span>
                <span className="text-[10px] text-slate-600">{comparison.periods[row.key] ?? 'Annual'}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="min-w-0 border-r border-slate-800 pr-3">
                  <span className="block truncate text-[10px] uppercase tracking-[.08em] text-emerald-300/80">{workspaceCompany.ticker}</span>
                  <strong className="mt-1 block text-lg tracking-tight text-slate-200">{row.workspaceMetric ? formatMetric(row.workspaceMetric.value) : '—'}</strong>
                  <small className="mt-1 block truncate text-[10px] text-slate-600">{row.workspaceMetric?.period ?? 'Current'}</small>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[10px] uppercase tracking-[.08em] text-sky-300/80">{comparison.entityName}</span>
                  <strong className="mt-1 block text-lg tracking-tight text-slate-200">{typeof peerValue === 'number' ? formatMetric(peerValue) : '—'}</strong>
                  <small className="mt-1 block truncate text-[10px] text-slate-600">{comparison.periods[row.key] ?? 'Annual'}</small>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
        <span className="font-bold uppercase tracking-[.1em] text-slate-600">Comparison quality</span>
        <strong className={qualityLabel === 'Aligned' ? 'text-emerald-300' : 'text-amber-300'}>{qualityLabel}</strong>
        <span>Current period {comparison.quality.currentPeriod ?? 'Unavailable'}</span>
        <span>{comparison.filings.length} filing{comparison.filings.length === 1 ? '' : 's'} available</span>
        <span className={periodsAligned ? 'text-emerald-300' : 'text-amber-300'}>{periodsAligned ? 'Periods aligned' : `Period mismatch: ${workspacePeriod} vs ${comparisonPeriod}`}</span>
      </div>
    </section>
  );
}

function formatBpsDelta(current: number | null, prior: number | null) {
  if (current === null || prior === null) return 'No prior annual fact';
  const delta = Math.round((current - prior) * 100);
  if (delta === 0) return 'Flat';
  return `${delta > 0 ? '↗' : '↘'} ${Math.abs(delta)} bps`;
}

function MetricsCard({ metrics, previousMetrics, metricHistory }: { metrics: Metric[]; previousMetrics: Record<string, number>; metricHistory: MetricHistory }) {
  const revenueHistory = metricHistory.revenue?.length ? metricHistory.revenue : [{ value: metrics[0]?.value ?? 0, period: metrics[0]?.period ?? 'Current' }];
  const operatingIncomeHistory = metricHistory.operatingIncome?.length ? metricHistory.operatingIncome : [{ value: metrics[1]?.value ?? 0, period: metrics[1]?.period ?? 'Current' }];
  const netIncomeHistory = metricHistory.netIncome?.length ? metricHistory.netIncome : [{ value: metrics[2]?.value ?? 0, period: metrics[2]?.period ?? 'Current' }];
  const currentRevenue = revenueHistory[0]?.value ?? null;
  const priorRevenue = revenueHistory[1]?.value ?? previousMetrics.revenue ?? null;
  const currentOperatingIncome = operatingIncomeHistory[0]?.value ?? null;
  const priorOperatingIncome = operatingIncomeHistory[1]?.value ?? previousMetrics.operatingIncome ?? null;
  const currentNetIncome = netIncomeHistory[0]?.value ?? null;
  const priorNetIncome = netIncomeHistory[1]?.value ?? previousMetrics.netIncome ?? null;
  const currentPeriod = revenueHistory[0]?.period ?? metrics[0]?.period ?? 'Current';
  const priorPeriod = revenueHistory[1]?.period ?? 'Prior annual fact';
  const revenueGrowth = currentRevenue !== null && priorRevenue !== null && priorRevenue !== 0 ? ((currentRevenue / priorRevenue) - 1) * 100 : null;
  const operatingMargin = currentRevenue ? ((currentOperatingIncome ?? 0) / currentRevenue) * 100 : null;
  const priorOperatingMargin = priorRevenue && priorOperatingIncome !== null ? (priorOperatingIncome / priorRevenue) * 100 : null;
  const netMargin = currentRevenue ? ((currentNetIncome ?? 0) / currentRevenue) * 100 : null;
  const priorNetMargin = priorRevenue && priorNetIncome !== null ? (priorNetIncome / priorRevenue) * 100 : null;
  const derivedMetrics = [
    {
      label: 'Revenue growth',
      formula: 'Revenue current ÷ prior − 1',
      value: revenueGrowth,
      comparison: revenueGrowth === null ? 'Needs prior annual fact' : `${currentPeriod} vs ${priorPeriod}`,
      delta: null,
    },
    {
      label: 'Operating margin',
      formula: 'Operating income ÷ revenue',
      value: operatingMargin,
      comparison: priorOperatingMargin === null ? 'Needs prior annual fact' : `${formatBpsDelta(operatingMargin, priorOperatingMargin)} vs prior`,
      delta: priorOperatingMargin === null || operatingMargin === null ? null : operatingMargin - priorOperatingMargin,
    },
    {
      label: 'Net margin',
      formula: 'Net income ÷ revenue',
      value: netMargin,
      comparison: priorNetMargin === null ? 'Needs prior annual fact' : `${formatBpsDelta(netMargin, priorNetMargin)} vs prior`,
      delta: priorNetMargin === null || netMargin === null ? null : netMargin - priorNetMargin,
    },
  ];
  return (
    <section id="metrics-panel" className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#101820]/75 p-4 sm:p-5 xl:col-span-2">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">NORMALIZED FACTS</span>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Metrics</h2>
        </div>
        <span className="text-[11px] text-slate-500">{metrics[0]?.period ?? 'Annual'} · USD reported values</span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {metrics.map((metric) => {
          const key = metric.id === 'revenue' ? 'revenue' : metric.id === 'operating-income' ? 'operatingIncome' : 'netIncome';
          const priorValue = previousMetrics[key];
          const scale = priorValue ? Math.max(metric.value, priorValue) : metric.value;
          return (
          <article key={metric.id} className="rounded-lg border border-slate-800/90 bg-[#0b1319]/70 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs text-slate-400">{metric.label}</span>
              {metric.yoy !== undefined && (
                <span className="rounded bg-emerald-300/10 px-1.5 py-1 text-[10px] font-bold text-emerald-300">+{metric.yoy}% YoY</span>
              )}
            </div>
            <strong className="mt-4 block text-2xl tracking-tight">{formatMetric(metric.value)}</strong>
            {priorValue && (
              <div className="mt-3 grid gap-1.5 text-[10px] text-slate-500" aria-label={`${metric.label} current versus prior year`}>
                <div className="flex items-center justify-between"><span>Current</span><span className="text-slate-300">{formatMetric(metric.value)}</span></div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-emerald-300" style={{ width: `${(metric.value / scale) * 100}%` }} /></div>
                <div className="flex items-center justify-between"><span>Prior year</span><span>{formatMetric(priorValue)}</span></div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-slate-500" style={{ width: `${(priorValue / scale) * 100}%` }} /></div>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] text-slate-500">
              <span>{metric.period}</span>
              <span className="font-mono">{metric.concept}</span>
            </div>
          </article>
          );
        })}
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
          <div>
            <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">RESEARCH TRANSFORMS</span>
            <h3 className="mt-1 text-sm font-semibold text-slate-300">Derived operating signals</h3>
          </div>
          <span className="text-[10px] text-slate-600">Explicit formulas · aligned annual facts</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {derivedMetrics.map((derivedMetric) => (
            <article key={derivedMetric.label} className="rounded-lg border border-slate-800/90 bg-[#0b1319]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400">{derivedMetric.label}</span>
                <Sparkles size={13} className="text-emerald-300" />
              </div>
              <strong className="mt-3 block text-xl tracking-tight text-slate-200">
                {derivedMetric.value === null ? '—' : `${derivedMetric.value.toFixed(1)}%`}
              </strong>
              <span className={`mt-1 block text-[10px] ${derivedMetric.delta === null || derivedMetric.delta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {derivedMetric.comparison}
              </span>
              <span className="mt-3 block border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-600">{derivedMetric.formula}</span>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
          <div>
            <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">ANNUAL TREND</span>
            <h3 className="mt-1 text-sm font-semibold text-slate-300">Filing-period comparison</h3>
          </div>
          <span className="text-[10px] text-slate-600">Newest fact highlighted · up to 5 annual periods</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {metrics.map((metric) => {
            const key = metric.id === 'revenue' ? 'revenue' : metric.id === 'operating-income' ? 'operatingIncome' : 'netIncome';
            const points = (metricHistory[key]?.length ? metricHistory[key] : [{ value: metric.value, period: metric.period }]).slice(0, 5).reverse();
            const scale = Math.max(...points.map((point) => Math.abs(point.value)), 1);
            return (
              <div key={`${metric.id}-trend`} className="rounded-lg border border-slate-800/90 bg-[#0b1319]/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{metric.label}</span>
                  <span className="text-[10px] text-slate-600">{points.length} year{points.length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-3 flex h-24 items-end gap-1.5" title={`${metric.label} annual trend from ${points[0]?.period} to ${points[points.length - 1]?.period}`}>
                  {points.map((point, index) => (
                    <div key={`${point.period}-${point.value}`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1">
                      <span
                        className={`block w-full rounded-t ${index === points.length - 1 ? 'bg-emerald-300' : 'bg-slate-600'}`}
                        style={{ height: `${Math.max(8, (Math.abs(point.value) / scale) * 100)}%` }}
                        title={`${point.period}: ${formatMetric(point.value)}`}
                      />
                      <span className="truncate text-center text-[9px] text-slate-600">{point.period.replace('FY ', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CompareDialog({
  open,
  onOpenChange,
  cik,
  onCikChange,
  loading,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cik: string;
  onCikChange: (value: string) => void;
  loading: boolean;
  error: string;
  onSubmit: () => void;
}) {
  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    onSubmit();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-slate-800 bg-[#101820] text-slate-100 sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-slate-100">Compare another SEC company</DialogTitle>
            <DialogDescription className="text-slate-400">
              Load a live annual-fact snapshot beside the current workspace. The comparison does not change this company’s evidence graph.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <label htmlFor="comparison-cik" className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">SEC CIK</label>
            <input
              id="comparison-cik"
              value={cik}
              onChange={(event) => onCikChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              maxLength={10}
              placeholder="0000320193"
              className="rounded-lg border border-slate-800 bg-[#0b1319] px-3 py-2.5 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-sky-900"
            />
            <span className="text-[10px] leading-4 text-slate-600">Use the zero-padded 10-digit identifier from SEC EDGAR, for example Apple: 0000320193.</span>
            {error && <p role="alert" className="text-[11px] text-amber-300">{error}</p>}
          </div>
          <DialogFooter className="mt-5">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={loading} className="rounded-lg bg-sky-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Loading SEC…' : 'Load comparison'}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QualityDialog({
  open,
  onOpenChange,
  quality,
  sourceDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quality: SourceQuality;
  sourceDescription: string;
}) {
  const checks = [
    { label: 'Current period alignment', value: quality.alignedCurrentPeriod ? 'Pass' : 'Review', detail: quality.currentPeriod ?? 'Unavailable', good: quality.alignedCurrentPeriod },
    { label: 'Prior period alignment', value: quality.alignedPriorPeriod ? 'Pass' : 'Review', detail: quality.priorPeriod ?? 'Unavailable', good: quality.alignedPriorPeriod },
    { label: 'Duplicate annual facts', value: quality.duplicateFacts === 0 ? 'None' : `${quality.duplicateFacts} found`, detail: 'Same accession, period, filing, and value', good: quality.duplicateFacts === 0 },
    { label: 'Amended annual filings', value: quality.amendedFilings === 0 ? 'None' : `${quality.amendedFilings} found`, detail: '10-K/A rows in selected concepts', good: quality.amendedFilings === 0 },
    { label: 'Missing metrics', value: quality.missingMetrics === 0 ? 'None' : `${quality.missingMetrics} missing`, detail: 'Revenue, operating income, net income', good: quality.missingMetrics === 0 },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-slate-800 bg-[#101820] text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-100">Data quality audit</DialogTitle>
          <DialogDescription className="text-slate-400">
            {sourceDescription}. Annual USD facts are checked before they enter the research workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-3 rounded-lg border border-slate-800/90 bg-[#0b1319]/70 px-3 py-2.5">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${check.good ? 'bg-emerald-300/10 text-emerald-300' : 'bg-amber-300/10 text-amber-300'}`}>
                {check.good ? '✓' : '!'}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <strong className="text-xs text-slate-300">{check.label}</strong>
                <small className="truncate text-[10px] text-slate-600">{check.detail}</small>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-[.08em] ${check.good ? 'text-emerald-300' : 'text-amber-300'}`}>{check.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-5 text-slate-500">
          A review flag does not discard the source. It marks a condition that should be checked before treating the comparison as decision-grade.
        </p>
      </DialogContent>
    </Dialog>
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
  editTarget,
  open,
  onOpenChange,
  onSave,
}: {
  kind: 'hypothesis' | 'study' | null;
  editTarget: DraftTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, description: string, editTarget: DraftTarget | null) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const isHypothesis = kind === 'hypothesis';
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setTitle(editTarget?.title ?? '');
      setDescription(editTarget?.description ?? '');
    }, 0);
    return () => clearTimeout(timer);
  }, [editTarget, open]);
  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), description.trim(), editTarget);
    setTitle('');
    setDescription('');
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-slate-800 bg-[#101820] text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {editTarget ? (isHypothesis ? 'Edit working hypothesis' : 'Edit research study') : isHypothesis ? 'Add working hypothesis' : 'Start a research study'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {editTarget
              ? 'Refine the research record while keeping its current status.'
              : isHypothesis
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
              {editTarget ? 'Save changes' : 'Save draft'}
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
  actions,
  children,
}: {
  id?: string;
  title: string;
  kicker: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#101820]/75 px-4 pt-5 sm:px-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[10px] font-bold tracking-[.13em] text-slate-500">
            {kicker}
          </span>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
