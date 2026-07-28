export type Sentiment =
  | "very_negative"
  | "negative"
  | "neutral"
  | "positive"
  | "very_positive";

export type Severity = "trivial" | "low" | "medium" | "high" | "critical";

export type Source = "reddit" | "github" | "hacker_news" | "stack_overflow" | (string & {});

export interface BuyingSignal {
  indicator: string;
  description: string;
}

export interface Persona {
  role: string;
  description: string;
}

export interface TargetMarket {
  segment: string;
  description: string;
}

export interface Embedding {
  id: string;
  painId: string;
  vector: Float64Array | number[];
  dimensions: number;
  modelVersion: string;
  contentHash: string;
  createdAt: Date;
}

export interface RawDocument {
  id: string;
  source: Source;
  externalId: string;
  rawContent: string;
  metadata: Record<string, unknown>;
  collectedAt: Date;
}

export interface Document {
  id: string;
  rawDocumentId: string;
  source: Source;
  externalId: string;
  title: string;
  body: string;
  authorName: string | null;
  postedAt: Date;
  url: string | null;
  sentiment: Sentiment;
  buyingSignals: BuyingSignal[];
  persona: Persona;
  normalizedAt: Date;
}

export interface Evidence {
  id: string;
  documentId: string;
  excerpt: string;
  charOffset: number;
  charLength: number;
  confidence: number;
}

export interface Pain {
  id: string;
  description: string;
  severity: Severity;
  targetMarket: TargetMarket;
  evidenceIds: string[];
  clusterId: string | null;
  createdAt: Date;
}

export interface Cluster {
  id: string;
  label: string;
  description: string | null;
  painIds: string[];
  createdAt: Date;
}

export interface Opportunity {
  id: string;
  clusterId: string;
  title: string;
  summary: string;
  marketSize: string | null;
  priorityScore: number;
  signals: Record<string, unknown>;
  createdAt: Date;
}

export interface ClassifiedDocument {
  documentId: string;
  sentiment: Sentiment;
  buyingSignals: BuyingSignal[];
  persona: Persona;
  pains: Omit<Pain, "id" | "clusterId" | "createdAt">[];
  evidence: Omit<Evidence, "id" | "documentId">[];
}
