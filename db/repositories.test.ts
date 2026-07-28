import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import {
  createRawDocumentRepo,
  createDocumentRepo,
  createEvidenceRepo,
  createPainRepo,
  createEmbeddingRepo,
  createClusterRepo,
  createOpportunityRepo,
} from "@/db/repositories.ts";
import type {
  RawDocument,
  Document,
  Evidence,
  Pain,
  Embedding,
  Cluster,
  Opportunity,
  Source,
  BuyingSignal,
  Persona,
  TargetMarket,
} from "@/types/domain.ts";

function makeDb(): Database {
  const db = new Database(":memory:");
  db.run("PRAGMA foreign_keys = ON");
  const d = drizzle(db);
  migrate(d, { migrationsFolder: "./db/migrations" });
  return db;
}

function makeId(): string {
  return crypto.randomUUID();
}

const now = new Date();

function makeRawDoc(overrides: Partial<RawDocument> = {}): RawDocument {
  return {
    id: makeId(),
    source: "reddit" as Source,
    externalId: "post-123",
    rawContent: '{"title":"Need help with deployment"}',
    metadata: { subreddit: "devops", score: 42 },
    collectedAt: now,
    ...overrides,
  };
}

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: makeId(),
    rawDocumentId: makeId(),
    source: "reddit" as Source,
    externalId: "post-123",
    title: "Need help with deployment",
    body: "I keep running into issues deploying my app. CI/CD is broken.",
    authorName: "dev_user",
    postedAt: now,
    url: "https://reddit.com/r/devops/123",
    sentiment: "negative",
    buyingSignals: [{ indicator: "looking_for_tool", description: "Actively searching for a deployment tool" }] as BuyingSignal[],
    persona: { role: "developer", description: "Individual developer working on side project" } as Persona,
    normalizedAt: now,
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: makeId(),
    documentId: makeId(),
    excerpt: "I keep running into issues deploying my app",
    charOffset: 0,
    charLength: 47,
    confidence: 0.95,
    ...overrides,
  };
}

function makePain(overrides: Partial<Pain> = {}): Pain {
  return {
    id: makeId(),
    description: "Deployment is difficult and error-prone",
    severity: "high",
    targetMarket: { segment: "independent developers", description: "Solo devs and small teams" } as TargetMarket,
    evidenceIds: [makeId()],
    clusterId: null,
    createdAt: now,
    ...overrides,
  };
}

function makeEmbedding(overrides: Partial<Embedding> = {}): Embedding {
  return {
    id: makeId(),
    painId: makeId(),
    vector: [0.1, 0.2, 0.3, 0.4],
    dimensions: 4,
    modelVersion: "v1",
    contentHash: "abc123",
    createdAt: now,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: makeId(),
    label: "Deployment Pain",
    description: "Users struggling with deployment workflows",
    painIds: [makeId()],
    createdAt: now,
    ...overrides,
  };
}

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: makeId(),
    clusterId: makeId(),
    title: "Simplify Deployment",
    summary: "Build a one-click deployment tool for indie devs",
    marketSize: "$5B",
    priorityScore: 0.85,
    signals: { frequency: "daily", reach: 5000 },
    createdAt: now,
    ...overrides,
  };
}

// ── RawDocumentRepo ──────────────────────────────────────────

describe("RawDocumentRepo", () => {
  let db: Database;

  beforeEach(() => { db = makeDb(); });

  test("create and getById", () => {
    const repo = createRawDocumentRepo(db);
    const doc = makeRawDoc();
    repo.create(doc);

    const found = repo.getById(doc.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(doc.id);
    expect(found!.source).toBe("reddit");
    expect(found!.externalId).toBe("post-123");
    expect(found!.rawContent).toBe('{"title":"Need help with deployment"}');
    expect(found!.metadata).toEqual({ subreddit: "devops", score: 42 });
  });

  test("getById returns null for missing id", () => {
    const repo = createRawDocumentRepo(db);
    expect(repo.getById("nonexistent")).toBeNull();
  });

  test("getBySourceAndExternalId", () => {
    const repo = createRawDocumentRepo(db);
    const doc = makeRawDoc({ source: "github", externalId: "issue-456" });
    repo.create(doc);

    const found = repo.getBySourceAndExternalId("github", "issue-456");
    expect(found).not.toBeNull();
    expect(found!.id).toBe(doc.id);

    const missing = repo.getBySourceAndExternalId("reddit", "issue-456");
    expect(missing).toBeNull();
  });

  test("list returns all documents", () => {
    const repo = createRawDocumentRepo(db);
    repo.create(makeRawDoc({ source: "reddit", externalId: "a" }));
    repo.create(makeRawDoc({ source: "github", externalId: "b" }));

    const all = repo.list();
    expect(all.length).toBe(2);
  });

  test("deleteById removes document", () => {
    const repo = createRawDocumentRepo(db);
    const doc = makeRawDoc();
    repo.create(doc);

    expect(repo.deleteById(doc.id)).toBe(true);
    expect(repo.getById(doc.id)).toBeNull();
    expect(repo.deleteById("nonexistent")).toBe(false);
  });
});

// ── DocumentRepo ─────────────────────────────────────────────

describe("DocumentRepo", () => {
  let db: Database;
  let rawDocRepo: ReturnType<typeof createRawDocumentRepo>;

  beforeEach(() => {
    db = makeDb();
    rawDocRepo = createRawDocumentRepo(db);
  });

  test("create and getById", () => {
    const rawDoc = makeRawDoc();
    rawDocRepo.create(rawDoc);

    const repo = createDocumentRepo(db);
    const doc = makeDoc({ rawDocumentId: rawDoc.id });
    repo.create(doc);

    const found = repo.getById(doc.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(doc.id);
    expect(found!.rawDocumentId).toBe(rawDoc.id);
    expect(found!.sentiment).toBe("negative");
    expect(found!.buyingSignals).toEqual([{ indicator: "looking_for_tool", description: "Actively searching for a deployment tool" }]);
    expect(found!.persona).toEqual({ role: "developer", description: "Individual developer working on side project" });
  });

  test("getByRawDocumentId", () => {
    const rawDoc = makeRawDoc();
    rawDocRepo.create(rawDoc);

    const repo = createDocumentRepo(db);
    const doc = makeDoc({ rawDocumentId: rawDoc.id });
    repo.create(doc);

    const found = repo.getByRawDocumentId(rawDoc.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(doc.id);
  });

  test("list returns all", () => {
    const rawDoc1 = makeRawDoc({ externalId: "a" });
    const rawDoc2 = makeRawDoc({ externalId: "b" });
    rawDocRepo.create(rawDoc1);
    rawDocRepo.create(rawDoc2);

    const repo = createDocumentRepo(db);
    repo.create(makeDoc({ rawDocumentId: rawDoc1.id, externalId: "a" }));
    repo.create(makeDoc({ rawDocumentId: rawDoc2.id, externalId: "b" }));

    expect(repo.list().length).toBe(2);
  });

  test("update modifies fields", () => {
    const rawDoc = makeRawDoc();
    rawDocRepo.create(rawDoc);

    const repo = createDocumentRepo(db);
    const doc = makeDoc({ rawDocumentId: rawDoc.id });
    repo.create(doc);

    const updated = repo.update(doc.id, {
      title: "Updated Title",
      sentiment: "positive",
    });
    expect(updated).toBe(true);

    const found = repo.getById(doc.id);
    expect(found!.title).toBe("Updated Title");
    expect(found!.sentiment).toBe("positive");
    expect(found!.body).toBe(doc.body);
  });

  test("update with empty updates returns false", () => {
    const repo = createDocumentRepo(db);
    expect(repo.update("any", {})).toBe(false);
  });

  test("deleteById removes document", () => {
    const rawDoc = makeRawDoc();
    rawDocRepo.create(rawDoc);

    const repo = createDocumentRepo(db);
    const doc = makeDoc({ rawDocumentId: rawDoc.id });
    repo.create(doc);

    expect(repo.deleteById(doc.id)).toBe(true);
    expect(repo.getById(doc.id)).toBeNull();
  });
});

// ── EvidenceRepo ─────────────────────────────────────────────

describe("EvidenceRepo", () => {
  let db: Database;
  let docId: string;

  beforeEach(() => {
    db = makeDb();
    const rawDocs = createRawDocumentRepo(db);
    const rawDoc = makeRawDoc();
    rawDocs.create(rawDoc);

    const docs = createDocumentRepo(db);
    const doc = makeDoc({ rawDocumentId: rawDoc.id });
    docs.create(doc);
    docId = doc.id;
  });

  test("create and getById", () => {
    const repo = createEvidenceRepo(db);
    const ev = makeEvidence({ documentId: docId });
    repo.create(ev);

    const found = repo.getById(ev.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(ev.id);
    expect(found!.documentId).toBe(docId);
    expect(found!.excerpt).toBe(ev.excerpt);
    expect(found!.charOffset).toBe(0);
    expect(found!.charLength).toBe(47);
    expect(found!.confidence).toBe(0.95);
  });

  test("listByDocumentId returns matching evidence", () => {
    const repo = createEvidenceRepo(db);

    repo.create(makeEvidence({ documentId: docId, excerpt: "first" }));
    repo.create(makeEvidence({ documentId: docId, excerpt: "second" }));

    const list = repo.listByDocumentId(docId);
    expect(list.length).toBe(2);

    expect(repo.listByDocumentId("nonexistent").length).toBe(0);
  });

  test("deleteById removes evidence", () => {
    const repo = createEvidenceRepo(db);
    const ev = makeEvidence({ documentId: docId });
    repo.create(ev);

    expect(repo.deleteById(ev.id)).toBe(true);
    expect(repo.getById(ev.id)).toBeNull();
  });
});

// ── PainRepo ─────────────────────────────────────────────────

describe("PainRepo", () => {
  let db: Database;

  beforeEach(() => { db = makeDb(); });

  test("create and getById", () => {
    const repo = createPainRepo(db);
    const pain = makePain({
      evidenceIds: ["ev1", "ev2"],
      targetMarket: { segment: "SMB", description: "Small and medium businesses" },
    });
    repo.create(pain);

    const found = repo.getById(pain.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(pain.id);
    expect(found!.severity).toBe("high");
    expect(found!.evidenceIds).toEqual(["ev1", "ev2"]);
    expect(found!.targetMarket).toEqual({ segment: "SMB", description: "Small and medium businesses" });
    expect(found!.clusterId).toBeNull();
  });

  test("list returns all pains", () => {
    const repo = createPainRepo(db);
    repo.create(makePain({ description: "pain a" }));
    repo.create(makePain({ description: "pain b" }));

    expect(repo.list().length).toBe(2);
  });

  test("listByClusterId returns clustered pains", () => {
    const repo = createPainRepo(db);
    const clusterRepo = createClusterRepo(db);

    const cluster = makeCluster();
    clusterRepo.create(cluster);

    repo.create(makePain({ clusterId: cluster.id }));
    repo.create(makePain({ clusterId: cluster.id }));
    repo.create(makePain({ clusterId: null }));

    expect(repo.listByClusterId(cluster.id).length).toBe(2);
  });

  test("listUnclustered returns pains without cluster", () => {
    const repo = createPainRepo(db);
    repo.create(makePain({ clusterId: null }));
    repo.create(makePain({ clusterId: null }));

    expect(repo.listUnclustered().length).toBe(2);
  });

  test("updateClusterId moves pain to cluster", () => {
    const repo = createPainRepo(db);
    const clusterRepo = createClusterRepo(db);

    const cluster = makeCluster();
    clusterRepo.create(cluster);

    const pain = makePain({ clusterId: null });
    repo.create(pain);

    const updated = repo.updateClusterId(pain.id, cluster.id);
    expect(updated).toBe(true);

    const found = repo.getById(pain.id);
    expect(found!.clusterId).toBe(cluster.id);
  });

  test("deleteById removes pain", () => {
    const repo = createPainRepo(db);
    const pain = makePain();
    repo.create(pain);

    expect(repo.deleteById(pain.id)).toBe(true);
    expect(repo.getById(pain.id)).toBeNull();
  });
});

// ── EmbeddingRepo ────────────────────────────────────────────

describe("EmbeddingRepo", () => {
  let db: Database;
  let painId: string;

  beforeEach(() => {
    db = makeDb();
    const painRepo = createPainRepo(db);
    const pain = makePain();
    painRepo.create(pain);
    painId = pain.id;
  });

  test("create and getById", () => {
    const repo = createEmbeddingRepo(db);
    const emb = makeEmbedding({ painId, vector: [0.5, -0.3, 0.8] });
    repo.create(emb);

    const found = repo.getById(emb.id);
    expect(found).not.toBeNull();
    expect(found!.painId).toBe(painId);
    expect(found!.vector).toEqual([0.5, -0.3, 0.8]);
    expect(found!.dimensions).toBe(4);
    expect(found!.modelVersion).toBe("v1");
    expect(found!.contentHash).toBe("abc123");
  });

  test("getByPainId returns latest embedding", () => {
    const repo = createEmbeddingRepo(db);
    const earlier = new Date("2024-01-01");
    const later = new Date("2024-06-01");

    repo.create(makeEmbedding({ painId, contentHash: "old", createdAt: earlier }));
    repo.create(makeEmbedding({ painId, contentHash: "new", createdAt: later }));

    const found = repo.getByPainId(painId);
    expect(found!.contentHash).toBe("new");
  });

  test("deleteById removes embedding", () => {
    const repo = createEmbeddingRepo(db);
    const emb = makeEmbedding({ painId });
    repo.create(emb);

    expect(repo.deleteById(emb.id)).toBe(true);
    expect(repo.getById(emb.id)).toBeNull();
  });
});

// ── ClusterRepo ──────────────────────────────────────────────

describe("ClusterRepo", () => {
  let db: Database;

  beforeEach(() => { db = makeDb(); });

  test("create and getById", () => {
    const repo = createClusterRepo(db);
    const cluster = makeCluster({ painIds: ["p1", "p2"] });
    repo.create(cluster);

    const found = repo.getById(cluster.id);
    expect(found).not.toBeNull();
    expect(found!.label).toBe("Deployment Pain");
    expect(found!.painIds).toEqual(["p1", "p2"]);
    expect(found!.description).toBe("Users struggling with deployment workflows");
  });

  test("list returns all clusters", () => {
    const repo = createClusterRepo(db);
    repo.create(makeCluster({ label: "c1" }));
    repo.create(makeCluster({ label: "c2" }));

    expect(repo.list().length).toBe(2);
  });

  test("update modifies fields", () => {
    const repo = createClusterRepo(db);
    const cluster = makeCluster();
    repo.create(cluster);

    repo.update(cluster.id, { label: "Updated Label", description: "Updated description" });

    const found = repo.getById(cluster.id);
    expect(found!.label).toBe("Updated Label");
    expect(found!.description).toBe("Updated description");
  });

  test("deleteById clears pain cluster refs and removes cluster", () => {
    const repo = createClusterRepo(db);
    const painRepo = createPainRepo(db);

    const cluster = makeCluster();
    repo.create(cluster);

    const pain = makePain({ clusterId: cluster.id });
    painRepo.create(pain);

    expect(repo.deleteById(cluster.id)).toBe(true);
    expect(repo.getById(cluster.id)).toBeNull();

    const orphanedPain = painRepo.getById(pain.id);
    expect(orphanedPain!.clusterId).toBeNull();
  });
});

// ── OpportunityRepo ──────────────────────────────────────────

describe("OpportunityRepo", () => {
  let db: Database;
  let clusterId: string;

  beforeEach(() => {
    db = makeDb();
    const clusterRepo = createClusterRepo(db);
    const cluster = makeCluster();
    clusterRepo.create(cluster);
    clusterId = cluster.id;
  });

  test("create and getById", () => {
    const repo = createOpportunityRepo(db);
    const opp = makeOpportunity({ clusterId, signals: { urgency: "high" } });
    repo.create(opp);

    const found = repo.getById(opp.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Simplify Deployment");
    expect(found!.priorityScore).toBe(0.85);
    expect(found!.marketSize).toBe("$5B");
    expect(found!.signals).toEqual({ urgency: "high" });
  });

  test("getByClusterId returns linked opportunity", () => {
    const repo = createOpportunityRepo(db);

    repo.create(makeOpportunity({ clusterId }));
    const otherCluster = makeCluster();
    createClusterRepo(db).create(otherCluster);
    repo.create(makeOpportunity({ clusterId: otherCluster.id }));

    const found = repo.getByClusterId(clusterId);
    expect(found).not.toBeNull();
    expect(found!.clusterId).toBe(clusterId);
  });

  test("list sorts by priorityScore desc", () => {
    const repo = createOpportunityRepo(db);
    const c2 = makeCluster();
    const c3 = makeCluster();
    createClusterRepo(db).create(c2);
    createClusterRepo(db).create(c3);

    repo.create(makeOpportunity({ clusterId: c2.id, title: "Low", priorityScore: 0.2 }));
    repo.create(makeOpportunity({ clusterId, title: "High", priorityScore: 0.9 }));
    repo.create(makeOpportunity({ clusterId: c3.id, title: "Mid", priorityScore: 0.5 }));

    const list = repo.list();
    expect(list[0]!.title).toBe("High");
    expect(list[1]!.title).toBe("Mid");
    expect(list[2]!.title).toBe("Low");
  });

  test("update modifies fields", () => {
    const repo = createOpportunityRepo(db);
    const opp = makeOpportunity({ clusterId });
    repo.create(opp);

    repo.update(opp.id, { title: "New Title", priorityScore: 0.99 });

    const found = repo.getById(opp.id);
    expect(found!.title).toBe("New Title");
    expect(found!.priorityScore).toBe(0.99);
  });

  test("deleteById removes opportunity", () => {
    const repo = createOpportunityRepo(db);
    const opp = makeOpportunity({ clusterId });
    repo.create(opp);

    expect(repo.deleteById(opp.id)).toBe(true);
    expect(repo.getById(opp.id)).toBeNull();
  });
});

// ── End-to-end pipeline simulation ───────────────────────────

describe("Pipeline simulation", () => {
  test("full flow: collect → normalize → classify → embed → cluster → score", () => {
    const db = makeDb();

    const rawDocs = createRawDocumentRepo(db);
    const docs = createDocumentRepo(db);
    const evs = createEvidenceRepo(db);
    const pains = createPainRepo(db);
    const embs = createEmbeddingRepo(db);
    const clusters = createClusterRepo(db);
    const opps = createOpportunityRepo(db);

    const rawDoc: RawDocument = {
      id: makeId(),
      source: "reddit",
      externalId: "post-1",
      rawContent: "Deploying is a nightmare. I've tried everything.",
      metadata: { subreddit: "devops" },
      collectedAt: new Date(),
    };
    rawDocs.create(rawDoc);

    const doc: Document = {
      id: makeId(),
      rawDocumentId: rawDoc.id,
      source: "reddit",
      externalId: "post-1",
      title: "Deployment Nightmare",
      body: "Deploying is a nightmare. I've tried everything.",
      authorName: "dev123",
      postedAt: new Date("2026-07-15"),
      url: "https://reddit.com/r/devops/post-1",
      sentiment: "very_negative",
      buyingSignals: [{ indicator: "looking_for_tool", description: "Actively searching for a deployment solution" }],
      persona: { role: "developer", description: "Full-stack developer" },
      normalizedAt: new Date(),
    };
    docs.create(doc);

    const ev1: Evidence = {
      id: makeId(),
      documentId: doc.id,
      excerpt: "Deploying is a nightmare",
      charOffset: 0,
      charLength: 24,
      confidence: 0.97,
    };
    const ev2: Evidence = {
      id: makeId(),
      documentId: doc.id,
      excerpt: "I've tried everything",
      charOffset: 26,
      charLength: 21,
      confidence: 0.88,
    };
    evs.create(ev1);
    evs.create(ev2);

    const pain: Pain = {
      id: makeId(),
      description: "Deployment workflows are unreliable and frustrating",
      severity: "high",
      targetMarket: { segment: "development teams", description: "Teams deploying web applications" },
      evidenceIds: [ev1.id, ev2.id],
      clusterId: null,
      createdAt: new Date(),
    };
    pains.create(pain);

    const embedding: Embedding = {
      id: makeId(),
      painId: pain.id,
      vector: [0.12, -0.45, 0.78, 0.33],
      dimensions: 4,
      modelVersion: "text-embedding-v3",
      contentHash: "sha256-def456",
      createdAt: new Date(),
    };
    embs.create(embedding);

    const cluster: Cluster = {
      id: makeId(),
      label: "Deployment Reliability",
      description: "Users report deployment workflows as unreliable and time-consuming",
      painIds: [pain.id],
      createdAt: new Date(),
    };
    clusters.create(cluster);
    pains.updateClusterId(pain.id, cluster.id);

    const opportunity: Opportunity = {
      id: makeId(),
      clusterId: cluster.id,
      title: "One-Click Deployment for Teams",
      summary: "Build a deployment tool that eliminates manual configuration and provides reliable rollbacks",
      marketSize: "$2B",
      priorityScore: 0.91,
      signals: { frequency: "daily", reach: 12000, trend: "rising" },
      createdAt: new Date(),
    };
    opps.create(opportunity);

    expect(rawDocs.getById(rawDoc.id)).not.toBeNull();
    expect(docs.getById(doc.id)).not.toBeNull();
    expect(evs.listByDocumentId(doc.id).length).toBe(2);

    const foundPain = pains.getById(pain.id);
    expect(foundPain!.clusterId).toBe(cluster.id);

    const foundEmb = embs.getByPainId(pain.id);
    expect(foundEmb!.vector).toEqual([0.12, -0.45, 0.78, 0.33]);

    const foundCluster = clusters.getById(cluster.id);
    expect(foundCluster!.painIds).toEqual([pain.id]);

    const foundOpp = opps.getByClusterId(cluster.id);
    expect(foundOpp!.priorityScore).toBe(0.91);
  });
});
