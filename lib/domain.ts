export type EvidenceRef = { label: string; concept: string; value: string; unit: string; sourceUrl: string; sourceLabel: string };
export type Company = { id: string; ticker: string; name: string; cik: string; exchange: string; sector: string };
export type Filing = { id: string; form: string; filedAt: string; periodEnd: string; accession: string; sourceUrl: string; status: 'verified' | 'fixture' };
export type Metric = { id: string; label: string; concept: string; value: number; unit: string; period: string; yoy?: number };
export type Event = { id: string; date: string; kind: 'filing' | 'metric' | 'hypothesis'; title: string; summary: string; signal: 'positive' | 'watch' | 'neutral'; sourceLabel: string; confidence: number; evidence: EvidenceRef[] };
export type Hypothesis = { id: string; title: string; status: 'testing' | 'supported' | 'parked'; description: string };
export type Study = { id: string; title: string; owner: string; state: 'active' | 'queued'; updatedAt: string };
export type ResearchSnapshot = { company: Company; filings: Filing[]; metrics: Metric[]; events: Event[]; hypotheses: Hypothesis[]; studies: Study[]; provenance: { adapter: string; capturedAt: string; fixture: string } };
