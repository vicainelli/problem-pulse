import { describe, test, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import {
  createRawDocumentRepo,
  createDocumentRepo,
  createEvidenceRepo,
  createPainRepo,
  createEmbeddingRepo,
} from "@/db/repositories.ts";
import { runEmbeddingPipeline } from "@/embeddings/pipeline.ts";
import {
  createSimulatedEmbeddingService,
  hashContent,
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_DIMENSIONS,
} from "@/embeddings/embedding-service.ts";
import type { EmbeddingService } from "@/embeddings/embedding-service.ts";
import type {
  RawDocument,
  Document,
  Pain,
  Embedding,
  Source,
  Severity,
  TargetMarket,
} from "@/types/domain.ts";
import { makeDb, makeId } from "@/db/test-utils.ts";

const now = new Date();

function makeRawDoc(overrides: Partial<RawDocument> = {}): RawDocument {
  return {
    id: makeId(),
    source: "hacker_news" as Source,
    externalId: "hn-1",
    rawContent: "Deploying is a nightmare. I've tried everything.",
    metadata: {},
    collectedAt: now,
    ...overrides,
  };
}

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: makeId(),
    rawDocumentId: makeId(),
    source: "hacker_news" as Source,
    externalId: "hn-1",
    title: "Deployment is a nightmare",
    body: "Deploying is a nightmare. I've tried everything and nothing works reliably.",
    authorName: "dev_user",
    postedAt: now,
    url: "https://news.ycombinator.com/item?id=1",
    sentiment: "neutral",
    buyingSignals: [],
    persona: { role: "unknown", description: "" },
    normalizedAt: now,
    ...overrides,
  };
}

function makePain(overrides: Partial<Pain> = {}): Pain {
  return {
    id: makeId(),
    description: "Deployment workflows are unreliable and frustrating",
    severity: "high" as Severity,
    targetMarket: { segment: "development teams", description: "Teams deploying web applications" } as TargetMarket,
    evidenceIds: [makeId()],
    clusterId: null,
    createdAt: now,
    ...overrides,
  };
}

function setupPains(db: Database, pains: Pain[]): void {
  const painRepo = createPainRepo(db);
  for (const pain of pains) {
    painRepo.create(pain);
  }
}

describe("Embedding Pipeline", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
  });

  function makeFaultyEmbeddingService(message: string): EmbeddingService {
    return async (_pains: Pain[]): Promise<Embedding[]> => {
      throw new Error(message);
    };
  }

  test("generates embeddings for pains that lack one", async () => {
    const pain = makePain();
    setupPains(db, [pain]);

    const embed = createSimulatedEmbeddingService();
    const output = await runEmbeddingPipeline(db, embed);

    expect(output.errors.length).toBe(0);
    expect(output.embeddings.length).toBe(1);

    const emb = output.embeddings[0]!;
    expect(emb.painId).toBe(pain.id);
    expect(emb.dimensions).toBe(EMBEDDING_DIMENSIONS);
    expect(emb.modelVersion).toBe(EMBEDDING_MODEL_VERSION);
    expect(emb.contentHash).toBe(hashContent(pain.description));
    expect((emb.vector as number[]).length).toBe(EMBEDDING_DIMENSIONS);

    const embeddingRepo = createEmbeddingRepo(db);
    const stored = embeddingRepo.getByPainId(pain.id);
    expect(stored).not.toBeNull();
    expect(stored!.dimensions).toBe(EMBEDDING_DIMENSIONS);
    expect(stored!.modelVersion).toBe(EMBEDDING_MODEL_VERSION);
    expect(stored!.contentHash).toBe(hashContent(pain.description));
  });

  test("embeddings carry model metadata: version, dimensions, content hash", async () => {
    const pain = makePain({
      description: "API integrations are complex and poorly documented",
    });
    setupPains(db, [pain]);

    const embed = createSimulatedEmbeddingService();
    const output = await runEmbeddingPipeline(db, embed);

    expect(output.embeddings.length).toBe(1);
    const emb = output.embeddings[0]!;

    expect(emb.modelVersion).toBe(EMBEDDING_MODEL_VERSION);
    expect(emb.dimensions).toBe(EMBEDDING_DIMENSIONS);
    expect(emb.contentHash).toBe(hashContent(pain.description));

    const embeddingRepo = createEmbeddingRepo(db);
    const stored = embeddingRepo.getByPainId(pain.id);
    expect(stored!.modelVersion).toBe(EMBEDDING_MODEL_VERSION);
    expect(stored!.dimensions).toBe(EMBEDDING_DIMENSIONS);
    expect(stored!.contentHash).toBe(hashContent(pain.description));
  });

  test("detects stale embeddings when content hash differs", async () => {
    const pain = makePain({
      description: "Original pain description",
    });
    setupPains(db, [pain]);

    const embed = createSimulatedEmbeddingService();
    await runEmbeddingPipeline(db, embed);

    const embeddingRepo = createEmbeddingRepo(db);
    const originalEmb = embeddingRepo.getByPainId(pain.id)!;
    const originalCreatedAt = originalEmb.createdAt;

    const painRepo = createPainRepo(db);
    painRepo.update(pain.id, { description: "Updated description" });

    const output2 = await runEmbeddingPipeline(db, embed);

    expect(output2.embeddings.length).toBe(1);
    expect(output2.embeddings[0]!.contentHash).not.toBe(originalEmb.contentHash);
    expect(output2.embeddings[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(originalCreatedAt.getTime());

    const newEmb = embeddingRepo.getByPainId(pain.id)!;
    expect(newEmb.contentHash).toBe(hashContent("Updated description"));
  });

  test("detects stale embeddings when model version changes", async () => {
    const pain = makePain({
      description: "Some pain description",
    });
    setupPains(db, [pain]);

    const embed = createSimulatedEmbeddingService();
    await runEmbeddingPipeline(db, embed);

    const embeddingRepo = createEmbeddingRepo(db);
    const originalEmb = embeddingRepo.getByPainId(pain.id)!;

    const tamperedEmb: Embedding = {
      ...originalEmb,
      modelVersion: "old-model-v0",
    };
    embeddingRepo.deleteById(originalEmb.id);
    embeddingRepo.create(tamperedEmb);

    const output2 = await runEmbeddingPipeline(db, embed);

    expect(output2.embeddings.length).toBe(1);
    expect(output2.embeddings[0]!.modelVersion).toBe(EMBEDDING_MODEL_VERSION);

    const newEmb = embeddingRepo.getByPainId(pain.id)!;
    expect(newEmb.modelVersion).toBe(EMBEDDING_MODEL_VERSION);
  });

  test("regenerates stale embeddings automatically before returning", async () => {
    const pain = makePain();
    setupPains(db, [pain]);

    const embed = createSimulatedEmbeddingService();
    await runEmbeddingPipeline(db, embed);

    const embeddingRepo = createEmbeddingRepo(db);
    const originalEmb = embeddingRepo.getByPainId(pain.id)!;
    expect(originalEmb.modelVersion).toBe(EMBEDDING_MODEL_VERSION);

    const tamperedEmb: Embedding = {
      ...originalEmb,
      modelVersion: "stale-version",
    };
    embeddingRepo.deleteById(originalEmb.id);
    embeddingRepo.create(tamperedEmb);

    const output2 = await runEmbeddingPipeline(db, embed);

    expect(output2.embeddings.length).toBe(1);
    expect(output2.embeddings[0]!.modelVersion).toBe(EMBEDDING_MODEL_VERSION);

    const refreshed = embeddingRepo.getByPainId(pain.id)!;
    expect(refreshed.modelVersion).toBe(EMBEDDING_MODEL_VERSION);
  });

  test("does not regenerate embeddings that are current", async () => {
    const pain1 = makePain({ description: "Pain 1" });
    const pain2 = makePain({ description: "Pain 2" });
    setupPains(db, [pain1, pain2]);

    const embed = createSimulatedEmbeddingService();

    const firstRun = await runEmbeddingPipeline(db, embed);
    expect(firstRun.embeddings.length).toBe(2);

    const secondRun = await runEmbeddingPipeline(db, embed);
    expect(secondRun.embeddings.length).toBe(0);

    const embeddingRepo = createEmbeddingRepo(db);
    const allEmbeddings = embeddingRepo.list();
    expect(allEmbeddings.length).toBe(2);
  });

  test("handles embedding service errors gracefully", async () => {
    const pain = makePain();
    setupPains(db, [pain]);

    const embed = makeFaultyEmbeddingService("Embedding model unavailable");
    const output = await runEmbeddingPipeline(db, embed);

    expect(output.errors.length).toBe(1);
    expect(output.errors[0]!.message).toBe("Embedding model unavailable");
    expect(output.embeddings.length).toBe(0);
  });

  test("returns empty output when no pains exist", async () => {
    const embed = createSimulatedEmbeddingService();
    const output = await runEmbeddingPipeline(db, embed);

    expect(output.embeddings.length).toBe(0);
    expect(output.errors.length).toBe(0);
  });

  test("only processes pains needing new embeddings", async () => {
    const pain1 = makePain({ description: "Pain 1" });
    const pain2 = makePain({ description: "Pain 2" });
    setupPains(db, [pain1, pain2]);

    const embeddingRepo = createEmbeddingRepo(db);
    embeddingRepo.create({
      id: makeId(),
      painId: pain1.id,
      vector: [0.1, 0.2, 0.3],
      dimensions: EMBEDDING_DIMENSIONS,
      modelVersion: EMBEDDING_MODEL_VERSION,
      contentHash: hashContent(pain1.description),
      createdAt: new Date(),
    });

    const embed = createSimulatedEmbeddingService();
    const output = await runEmbeddingPipeline(db, embed);

    expect(output.embeddings.length).toBe(1);
    expect(output.embeddings[0]!.painId).toBe(pain2.id);

    const stored = embeddingRepo.list();
    expect(stored.length).toBe(2);
  });
});
