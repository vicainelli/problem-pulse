import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const rawDocuments = sqliteTable(
  "raw_documents",
  {
    id: text("id").primaryKey().notNull(),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    rawContent: text("raw_content").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    collectedAt: text("collected_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_raw_documents_source_external").on(table.source, table.externalId),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey().notNull(),
    rawDocumentId: text("raw_document_id")
      .notNull()
      .references(() => rawDocuments.id),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    authorName: text("author_name"),
    postedAt: text("posted_at").notNull(),
    url: text("url"),
    sentiment: text("sentiment").notNull().default("neutral"),
    buyingSignals: text("buying_signals").notNull().default("[]"),
    persona: text("persona").notNull().default('{"role":"unknown","description":""}'),
    normalizedAt: text("normalized_at").notNull(),
  },
  (table) => [
    index("idx_documents_raw_document").on(table.rawDocumentId),
    index("idx_documents_source").on(table.source),
  ],
);

export const evidence = sqliteTable(
  "evidence",
  {
    id: text("id").primaryKey().notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    excerpt: text("excerpt").notNull(),
    charOffset: integer("char_offset").notNull(),
    charLength: integer("char_length").notNull(),
    confidence: real("confidence").notNull(),
  },
  (table) => [
    index("idx_evidence_document").on(table.documentId),
  ],
);

export const clusters = sqliteTable("clusters", {
  id: text("id").primaryKey().notNull(),
  label: text("label").notNull(),
  description: text("description"),
  painIds: text("pain_ids").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
});

export const pains = sqliteTable(
  "pains",
  {
    id: text("id").primaryKey().notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull().default("medium"),
    targetMarket: text("target_market")
      .notNull()
      .default('{"segment":"unknown","description":""}'),
    evidenceIds: text("evidence_ids").notNull().default("[]"),
    clusterId: text("cluster_id").references(() => clusters.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_pains_cluster").on(table.clusterId),
  ],
);

export const embeddings = sqliteTable(
  "embeddings",
  {
    id: text("id").primaryKey().notNull(),
    painId: text("pain_id")
      .notNull()
      .references(() => pains.id),
    vector: text("vector").notNull(),
    dimensions: integer("dimensions").notNull(),
    modelVersion: text("model_version").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_embeddings_pain").on(table.painId),
    index("idx_embeddings_content_hash").on(table.contentHash),
  ],
);

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: text("id").primaryKey().notNull(),
    clusterId: text("cluster_id")
      .notNull()
      .references(() => clusters.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    marketSize: text("market_size"),
    priorityScore: real("priority_score").notNull().default(0),
    signals: text("signals").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_opportunities_cluster").on(table.clusterId),
  ],
);
