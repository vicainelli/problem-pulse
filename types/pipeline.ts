import type { RawDocument, Document, ClassifiedDocument, Evidence, Pain, Cluster, Opportunity, Embedding, Source } from "./domain.ts";

export interface CollectorInput {
  source: Source;
  params: Record<string, unknown>;
}

export interface CollectorOutput {
  rawDocuments: RawDocument[];
  errors: Error[];
}

export interface NormalizerInput {
  rawDocuments: RawDocument[];
}

export interface NormalizerOutput {
  documents: Document[];
  errors: Error[];
}

export interface ClassifierInput {
  documents: Document[];
}

export interface ClassifierOutput {
  classifiedDocuments: ClassifiedDocument[];
  errors: Error[];
}

export interface EmbeddingServiceInput {
  pains: Pain[];
}

export interface EmbeddingServiceOutput {
  embeddings: Embedding[];
  errors: Error[];
}

export interface ClusteringInput {
  embeddings: Embedding[];
  pains: Pain[];
}

export interface ClusteringOutput {
  clusters: Cluster[];
  errors: Error[];
}

export interface ScorerInput {
  clusters: Cluster[];
  pains: Pain[];
  evidence: Evidence[];
}

export interface ScorerOutput {
  opportunities: Opportunity[];
  errors: Error[];
}
