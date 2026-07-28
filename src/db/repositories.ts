import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, and, desc, asc, isNull } from "drizzle-orm";
import * as schema from "./schema.ts";
import type {
  RawDocument,
  Document,
  Evidence,
  Pain,
  Embedding,
  Cluster,
  Opportunity,
  Source,
  Sentiment,
  Severity,
  BuyingSignal,
  Persona,
  TargetMarket,
} from "../types/domain.ts";

function json<T>(value: T): string {
  return JSON.stringify(value);
}

function fromJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function changed(result: void): boolean {
  return (result as unknown as { changes: number }).changes > 0;
}

type DrizzleDb = ReturnType<typeof drizzle>;

// ── RawDocument ──────────────────────────────────────────────

function toRawDocument(row: typeof schema.rawDocuments.$inferSelect): RawDocument {
  return {
    id: row.id,
    source: row.source as Source,
    externalId: row.externalId,
    rawContent: row.rawContent,
    metadata: fromJson<Record<string, unknown>>(row.metadata),
    collectedAt: new Date(row.collectedAt),
  };
}

export function createRawDocumentRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(doc: RawDocument): void {
      d.insert(schema.rawDocuments).values({
        id: doc.id,
        source: doc.source,
        externalId: doc.externalId,
        rawContent: doc.rawContent,
        metadata: json(doc.metadata),
        collectedAt: doc.collectedAt.toISOString(),
      }).run();
    },

    getById(id: string): RawDocument | null {
      const row = d
        .select()
        .from(schema.rawDocuments)
        .where(eq(schema.rawDocuments.id, id))
        .get();
      return row ? toRawDocument(row) : null;
    },

    getBySourceAndExternalId(source: Source, externalId: string): RawDocument | null {
      const row = d
        .select()
        .from(schema.rawDocuments)
        .where(
          and(
            eq(schema.rawDocuments.source, source),
            eq(schema.rawDocuments.externalId, externalId),
          ),
        )
        .get();
      return row ? toRawDocument(row) : null;
    },

    list(): RawDocument[] {
      return d
        .select()
        .from(schema.rawDocuments)
        .orderBy(desc(schema.rawDocuments.collectedAt))
        .all()
        .map(toRawDocument);
    },

    deleteById(id: string): boolean {
      const result = d
        .delete(schema.rawDocuments)
        .where(eq(schema.rawDocuments.id, id))
        .run();
      return changed(result);
    },
  };
}

export type RawDocumentRepo = ReturnType<typeof createRawDocumentRepo>;

// ── Document ─────────────────────────────────────────────────

function toDocument(row: typeof schema.documents.$inferSelect): Document {
  return {
    id: row.id,
    rawDocumentId: row.rawDocumentId,
    source: row.source as Source,
    externalId: row.externalId,
    title: row.title,
    body: row.body,
    authorName: row.authorName,
    postedAt: new Date(row.postedAt),
    url: row.url,
    sentiment: row.sentiment as Sentiment,
    buyingSignals: fromJson<BuyingSignal[]>(row.buyingSignals),
    persona: fromJson<Persona>(row.persona),
    normalizedAt: new Date(row.normalizedAt),
  };
}

export function createDocumentRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(doc: Document): void {
      d.insert(schema.documents).values({
        id: doc.id,
        rawDocumentId: doc.rawDocumentId,
        source: doc.source,
        externalId: doc.externalId,
        title: doc.title,
        body: doc.body,
        authorName: doc.authorName,
        postedAt: doc.postedAt.toISOString(),
        url: doc.url,
        sentiment: doc.sentiment,
        buyingSignals: json(doc.buyingSignals),
        persona: json(doc.persona),
        normalizedAt: doc.normalizedAt.toISOString(),
      }).run();
    },

    getById(id: string): Document | null {
      const row = d
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.id, id))
        .get();
      return row ? toDocument(row) : null;
    },

    getByRawDocumentId(rawDocumentId: string): Document | null {
      const row = d
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.rawDocumentId, rawDocumentId))
        .get();
      return row ? toDocument(row) : null;
    },

    list(): Document[] {
      return d
        .select()
        .from(schema.documents)
        .orderBy(desc(schema.documents.normalizedAt))
        .all()
        .map(toDocument);
    },

    update(id: string, updates: Partial<Pick<Document, "title" | "body" | "sentiment" | "buyingSignals" | "persona">>): boolean {
      const set: Record<string, unknown> = {};
      if (updates.title !== undefined) set.title = updates.title;
      if (updates.body !== undefined) set.body = updates.body;
      if (updates.sentiment !== undefined) set.sentiment = updates.sentiment;
      if (updates.buyingSignals !== undefined) set.buyingSignals = json(updates.buyingSignals);
      if (updates.persona !== undefined) set.persona = json(updates.persona);

      if (Object.keys(set).length === 0) return false;

      const result = d
        .update(schema.documents)
        .set(set)
        .where(eq(schema.documents.id, id))
        .run();
      return changed(result);
    },

    deleteById(id: string): boolean {
      const result = d
        .delete(schema.documents)
        .where(eq(schema.documents.id, id))
        .run();
      return changed(result);
    },
  };
}

export type DocumentRepo = ReturnType<typeof createDocumentRepo>;

// ── Evidence ─────────────────────────────────────────────────

function toEvidence(row: typeof schema.evidence.$inferSelect): Evidence {
  return {
    id: row.id,
    documentId: row.documentId,
    excerpt: row.excerpt,
    charOffset: row.charOffset,
    charLength: row.charLength,
    confidence: row.confidence,
  };
}

export function createEvidenceRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(ev: Evidence): void {
      d.insert(schema.evidence).values({
        id: ev.id,
        documentId: ev.documentId,
        excerpt: ev.excerpt,
        charOffset: ev.charOffset,
        charLength: ev.charLength,
        confidence: ev.confidence,
      }).run();
    },

    getById(id: string): Evidence | null {
      const row = d
        .select()
        .from(schema.evidence)
        .where(eq(schema.evidence.id, id))
        .get();
      return row ? toEvidence(row) : null;
    },

    list(): Evidence[] {
      return d
        .select()
        .from(schema.evidence)
        .orderBy(asc(schema.evidence.charOffset))
        .all()
        .map(toEvidence);
    },

    listByDocumentId(documentId: string): Evidence[] {
      return d
        .select()
        .from(schema.evidence)
        .where(eq(schema.evidence.documentId, documentId))
        .orderBy(asc(schema.evidence.charOffset))
        .all()
        .map(toEvidence);
    },

    deleteById(id: string): boolean {
      const result = d
        .delete(schema.evidence)
        .where(eq(schema.evidence.id, id))
        .run();
      return changed(result);
    },
  };
}

export type EvidenceRepo = ReturnType<typeof createEvidenceRepo>;

// ── Pain ─────────────────────────────────────────────────────

function toPain(row: typeof schema.pains.$inferSelect): Pain {
  return {
    id: row.id,
    description: row.description,
    severity: row.severity as Severity,
    targetMarket: fromJson<TargetMarket>(row.targetMarket),
    evidenceIds: fromJson<string[]>(row.evidenceIds),
    clusterId: row.clusterId,
    createdAt: new Date(row.createdAt),
  };
}

export function createPainRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(pain: Pain): void {
      d.insert(schema.pains).values({
        id: pain.id,
        description: pain.description,
        severity: pain.severity,
        targetMarket: json(pain.targetMarket),
        evidenceIds: json(pain.evidenceIds),
        clusterId: pain.clusterId,
        createdAt: pain.createdAt.toISOString(),
      }).run();
    },

    getById(id: string): Pain | null {
      const row = d
        .select()
        .from(schema.pains)
        .where(eq(schema.pains.id, id))
        .get();
      return row ? toPain(row) : null;
    },

    list(): Pain[] {
      return d
        .select()
        .from(schema.pains)
        .orderBy(desc(schema.pains.createdAt))
        .all()
        .map(toPain);
    },

    listByClusterId(clusterId: string): Pain[] {
      return d
        .select()
        .from(schema.pains)
        .where(eq(schema.pains.clusterId, clusterId))
        .all()
        .map(toPain);
    },

    listUnclustered(): Pain[] {
      return d
        .select()
        .from(schema.pains)
        .where(isNull(schema.pains.clusterId))
        .all()
        .map(toPain);
    },

    update(id: string, updates: Partial<Pick<Pain, "description" | "severity" | "targetMarket" | "evidenceIds">>): boolean {
      const set: Record<string, unknown> = {};
      if (updates.description !== undefined) set.description = updates.description;
      if (updates.severity !== undefined) set.severity = updates.severity;
      if (updates.targetMarket !== undefined) set.targetMarket = json(updates.targetMarket);
      if (updates.evidenceIds !== undefined) set.evidenceIds = json(updates.evidenceIds);

      if (Object.keys(set).length === 0) return false;

      const result = d
        .update(schema.pains)
        .set(set)
        .where(eq(schema.pains.id, id))
        .run();
      return changed(result);
    },

    updateClusterId(painId: string, clusterId: string | null): boolean {
      const result = d
        .update(schema.pains)
        .set({ clusterId })
        .where(eq(schema.pains.id, painId))
        .run();
      return changed(result);
    },

    deleteById(id: string): boolean {
      const result = d
        .delete(schema.pains)
        .where(eq(schema.pains.id, id))
        .run();
      return changed(result);
    },
  };
}

export type PainRepo = ReturnType<typeof createPainRepo>;

// ── Embedding ────────────────────────────────────────────────

function toEmbedding(row: typeof schema.embeddings.$inferSelect): Embedding {
  return {
    id: row.id,
    painId: row.painId,
    vector: fromJson<number[]>(row.vector),
    dimensions: row.dimensions,
    modelVersion: row.modelVersion,
    contentHash: row.contentHash,
    createdAt: new Date(row.createdAt),
  };
}

export function createEmbeddingRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(emb: Embedding): void {
      d.insert(schema.embeddings).values({
        id: emb.id,
        painId: emb.painId,
        vector: json(Array.from(emb.vector)),
        dimensions: emb.dimensions,
        modelVersion: emb.modelVersion,
        contentHash: emb.contentHash,
        createdAt: emb.createdAt.toISOString(),
      }).run();
    },

    getById(id: string): Embedding | null {
      const row = d
        .select()
        .from(schema.embeddings)
        .where(eq(schema.embeddings.id, id))
        .get();
      return row ? toEmbedding(row) : null;
    },

    getByPainId(painId: string): Embedding | null {
      const row = d
        .select()
        .from(schema.embeddings)
        .where(eq(schema.embeddings.painId, painId))
        .orderBy(desc(schema.embeddings.createdAt))
        .limit(1)
        .get();
      return row ? toEmbedding(row) : null;
    },

    list(): Embedding[] {
      return d
        .select()
        .from(schema.embeddings)
        .orderBy(desc(schema.embeddings.createdAt))
        .all()
        .map(toEmbedding);
    },

    deleteById(id: string): boolean {
      const result = d
        .delete(schema.embeddings)
        .where(eq(schema.embeddings.id, id))
        .run();
      return changed(result);
    },
  };
}

export type EmbeddingRepo = ReturnType<typeof createEmbeddingRepo>;

// ── Cluster ──────────────────────────────────────────────────

function toCluster(row: typeof schema.clusters.$inferSelect): Cluster {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    painIds: fromJson<string[]>(row.painIds),
    createdAt: new Date(row.createdAt),
  };
}

export function createClusterRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(cluster: Cluster): void {
      d.insert(schema.clusters).values({
        id: cluster.id,
        label: cluster.label,
        description: cluster.description,
        painIds: json(cluster.painIds),
        createdAt: cluster.createdAt.toISOString(),
      }).run();
    },

    getById(id: string): Cluster | null {
      const row = d
        .select()
        .from(schema.clusters)
        .where(eq(schema.clusters.id, id))
        .get();
      return row ? toCluster(row) : null;
    },

    list(): Cluster[] {
      return d
        .select()
        .from(schema.clusters)
        .orderBy(desc(schema.clusters.createdAt))
        .all()
        .map(toCluster);
    },

    update(id: string, updates: Partial<Pick<Cluster, "label" | "description" | "painIds">>): boolean {
      const set: Record<string, unknown> = {};
      if (updates.label !== undefined) set.label = updates.label;
      if (updates.description !== undefined) set.description = updates.description;
      if (updates.painIds !== undefined) set.painIds = json(updates.painIds);

      if (Object.keys(set).length === 0) return false;

      const result = d
        .update(schema.clusters)
        .set(set)
        .where(eq(schema.clusters.id, id))
        .run();
      return changed(result);
    },

    deleteById(id: string): boolean {
      d.update(schema.pains).set({ clusterId: null }).where(eq(schema.pains.clusterId, id)).run();
      const result = d.delete(schema.clusters).where(eq(schema.clusters.id, id)).run();
      return changed(result);
    },
  };
}

export type ClusterRepo = ReturnType<typeof createClusterRepo>;

// ── Opportunity ──────────────────────────────────────────────

function toOpportunity(row: typeof schema.opportunities.$inferSelect): Opportunity {
  return {
    id: row.id,
    clusterId: row.clusterId,
    title: row.title,
    summary: row.summary,
    marketSize: row.marketSize,
    priorityScore: row.priorityScore,
    signals: fromJson<Record<string, unknown>>(row.signals),
    createdAt: new Date(row.createdAt),
  };
}

export function createOpportunityRepo(db: Database) {
  const d = drizzle(db, { schema });

  return {
    create(opp: Opportunity): void {
      d.insert(schema.opportunities).values({
        id: opp.id,
        clusterId: opp.clusterId,
        title: opp.title,
        summary: opp.summary,
        marketSize: opp.marketSize,
        priorityScore: opp.priorityScore,
        signals: json(opp.signals),
        createdAt: opp.createdAt.toISOString(),
      }).run();
    },

    getById(id: string): Opportunity | null {
      const row = d
        .select()
        .from(schema.opportunities)
        .where(eq(schema.opportunities.id, id))
        .get();
      return row ? toOpportunity(row) : null;
    },

    getByClusterId(clusterId: string): Opportunity | null {
      const row = d
        .select()
        .from(schema.opportunities)
        .where(eq(schema.opportunities.clusterId, clusterId))
        .get();
      return row ? toOpportunity(row) : null;
    },

    list(): Opportunity[] {
      return d
        .select()
        .from(schema.opportunities)
        .orderBy(desc(schema.opportunities.priorityScore))
        .all()
        .map(toOpportunity);
    },

    update(id: string, updates: Partial<Pick<Opportunity, "title" | "summary" | "marketSize" | "priorityScore" | "signals">>): boolean {
      const set: Record<string, unknown> = {};
      if (updates.title !== undefined) set.title = updates.title;
      if (updates.summary !== undefined) set.summary = updates.summary;
      if (updates.marketSize !== undefined) set.marketSize = updates.marketSize;
      if (updates.priorityScore !== undefined) set.priorityScore = updates.priorityScore;
      if (updates.signals !== undefined) set.signals = json(updates.signals);

      if (Object.keys(set).length === 0) return false;

      const result = d
        .update(schema.opportunities)
        .set(set)
        .where(eq(schema.opportunities.id, id))
        .run();
      return changed(result);
    },

    deleteById(id: string): boolean {
      const result = d
        .delete(schema.opportunities)
        .where(eq(schema.opportunities.id, id))
        .run();
      return changed(result);
    },
  };
}

export type OpportunityRepo = ReturnType<typeof createOpportunityRepo>;
