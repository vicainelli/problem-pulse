import { describe, test, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import {
  createPainRepo,
  createEmbeddingRepo,
  createClusterRepo,
} from "@/db/repositories.ts";
import { runClusteringPipeline } from "@/clustering/pipeline.ts";
import {
  createSimulatedClusteringService,
} from "@/clustering/clustering-service.ts";
import type { ClusteringService } from "@/clustering/clustering-service.ts";
import {
  hashContent,
  generateVector,
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_DIMENSIONS,
} from "@/embeddings/embedding-service.ts";
import type {
  Pain,
  Embedding,
  Cluster,
  Severity,
  TargetMarket,
} from "@/types/domain.ts";
import { makeDb, makeId } from "@/db/test-utils.ts";

const now = new Date();

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

function makeEmbedding(pain: Pain, overrides: Partial<Embedding> = {}): Embedding {
  return {
    id: makeId(),
    painId: pain.id,
    vector: generateVector(hashContent(pain.description), EMBEDDING_DIMENSIONS),
    dimensions: EMBEDDING_DIMENSIONS,
    modelVersion: EMBEDDING_MODEL_VERSION,
    contentHash: hashContent(pain.description),
    createdAt: new Date(),
    ...overrides,
  };
}

function setupData(
  db: Database,
  pains: Pain[],
  embeddings: Embedding[],
): void {
  const painRepo = createPainRepo(db);
  for (const pain of pains) {
    painRepo.create(pain);
  }
  const embeddingRepo = createEmbeddingRepo(db);
  for (const emb of embeddings) {
    embeddingRepo.create(emb);
  }
}

describe("Clustering Pipeline", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
  });

  function makeFaultyClusteringService(message: string): ClusteringService {
    return async (_embeddings: Embedding[], _pains: Pain[]): Promise<Cluster[]> => {
      throw new Error(message);
    };
  }

  test("clusters semantically similar pains into canonical clusters", async () => {
    const pain1 = makePain({
      description: "Deployment workflows are unreliable and frustrating",
    });
    const pain2 = makePain({
      description: "Deploying applications to production is a nightmare",
    });

    const emb1 = makeEmbedding(pain1);
    const emb2 = makeEmbedding(pain2);

    setupData(db, [pain1, pain2], [emb1, emb2]);

    const clusterer = createSimulatedClusteringService();
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.errors.length).toBe(0);
    expect(output.clusters.length).toBeGreaterThanOrEqual(1);

    const clusterRepo = createClusterRepo(db);
    const storedClusters = clusterRepo.list();
    expect(storedClusters.length).toBe(output.clusters.length);

    const painRepo = createPainRepo(db);
    const updatedPain1 = painRepo.getById(pain1.id)!;
    const updatedPain2 = painRepo.getById(pain2.id)!;

    expect(updatedPain1.clusterId).not.toBeNull();
    expect(updatedPain2.clusterId).not.toBeNull();
  });

  test("each pain belongs to exactly one cluster", async () => {
    const pain1 = makePain({ description: "Pain about deployment issues" });
    const pain2 = makePain({ description: "Pain about testing challenges" });
    const pain3 = makePain({ description: "Deployment pipelines break often" });

    const emb1 = makeEmbedding(pain1);
    const emb2 = makeEmbedding(pain2);
    const emb3 = makeEmbedding(pain3);

    setupData(db, [pain1, pain2, pain3], [emb1, emb2, emb3]);

    const clusterer = createSimulatedClusteringService();
    await runClusteringPipeline(db, clusterer);

    const painRepo = createPainRepo(db);
    const allPains = painRepo.list();

    const clusterIds = new Set(allPains.map((p) => p.clusterId));
    expect(clusterIds.size).toBeGreaterThanOrEqual(1);

    for (const pain of allPains) {
      expect(pain.clusterId).not.toBeNull();
    }

    const clusterRepo = createClusterRepo(db);
    const clusters = clusterRepo.list();

    const allPainIdsInClusters = new Set<string>();
    for (const cluster of clusters) {
      for (const painId of cluster.painIds) {
        expect(allPainIdsInClusters.has(painId)).toBe(false);
        allPainIdsInClusters.add(painId);
      }
    }

    expect(allPainIdsInClusters.size).toBe(allPains.length);
  });

  test("only clusters pains that have embeddings", async () => {
    const painWithEmb = makePain({ description: "Pain with embedding" });
    const painWithoutEmb = makePain({ description: "Pain without embedding" });

    const emb = makeEmbedding(painWithEmb);

    setupData(db, [painWithEmb, painWithoutEmb], [emb]);

    const clusterer = createSimulatedClusteringService();
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.clusters.length).toBeGreaterThanOrEqual(1);

    const painRepo = createPainRepo(db);
    const clustered = painRepo.getById(painWithEmb.id)!;
    const unclustered = painRepo.getById(painWithoutEmb.id)!;

    expect(clustered.clusterId).not.toBeNull();
    expect(unclustered.clusterId).toBeNull();
  });

  test("re-clusters when previous clusters exist (full refresh)", async () => {
    const pain1 = makePain({ description: "Deployment pain A" });
    const pain2 = makePain({ description: "Deployment pain B" });

    const emb1 = makeEmbedding(pain1);
    const emb2 = makeEmbedding(pain2);

    setupData(db, [pain1, pain2], [emb1, emb2]);

    const painRepo = createPainRepo(db);
    const clusterRepo = createClusterRepo(db);

    const oldCluster: Cluster = {
      id: makeId(),
      label: "Old Cluster",
      description: "Old grouping",
      painIds: [pain1.id, pain2.id],
      createdAt: new Date(),
    };
    clusterRepo.create(oldCluster);
    painRepo.updateClusterId(pain1.id, oldCluster.id);
    painRepo.updateClusterId(pain2.id, oldCluster.id);

    const clusterer = createSimulatedClusteringService();
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.errors.length).toBe(0);
    expect(output.clusters.length).toBeGreaterThanOrEqual(1);

    const oldClusterCheck = clusterRepo.getById(oldCluster.id);
    expect(oldClusterCheck).toBeNull();

    const updatedPain1 = painRepo.getById(pain1.id)!;
    const updatedPain2 = painRepo.getById(pain2.id)!;
    expect(updatedPain1.clusterId).not.toBe(oldCluster.id);
    expect(updatedPain2.clusterId).not.toBe(oldCluster.id);
  });

  test("handles clustering service errors gracefully", async () => {
    const pain = makePain();
    const emb = makeEmbedding(pain);
    setupData(db, [pain], [emb]);

    const clusterer = makeFaultyClusteringService("Clustering engine failure");
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.errors.length).toBe(1);
    expect(output.errors[0]!.message).toBe("Clustering engine failure");
    expect(output.clusters.length).toBe(0);
  });

  test("returns empty output when no pains have embeddings", async () => {
    const clusterer = createSimulatedClusteringService();
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.clusters.length).toBe(0);
    expect(output.errors.length).toBe(0);
  });

  test("diverse pains get assigned to different clusters", async () => {
    const pain1 = makePain({ description: "Deployment pipelines are slow and unreliable" });
    const pain2 = makePain({ description: "Testing framework is buggy and frustrating" });
    const pain3 = makePain({ description: "API documentation is incomplete and confusing" });

    const emb1 = makeEmbedding(pain1);
    const emb2 = makeEmbedding(pain2);
    const emb3 = makeEmbedding(pain3);

    setupData(db, [pain1, pain2, pain3], [emb1, emb2, emb3]);

    const clusterer = createSimulatedClusteringService();
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.errors.length).toBe(0);
    expect(output.clusters.length).toBeGreaterThanOrEqual(1);

    const clusterRepo = createClusterRepo(db);
    const stored = clusterRepo.list();
    expect(stored.length).toBe(output.clusters.length);

    for (const cluster of stored) {
      expect(cluster.label.length).toBeGreaterThan(0);
    }
  });

  test("clusters carry label and painIds", async () => {
    const pain1 = makePain({ description: "Auth systems are complex" });
    const pain2 = makePain({ description: "Login flows are hard to get right" });

    const emb1 = makeEmbedding(pain1);
    const emb2 = makeEmbedding(pain2);

    setupData(db, [pain1, pain2], [emb1, emb2]);

    const clusterer = createSimulatedClusteringService();
    const output = await runClusteringPipeline(db, clusterer);

    expect(output.errors.length).toBe(0);
    expect(output.clusters.length).toBeGreaterThanOrEqual(1);

    const cluster = output.clusters[0]!;
    expect(cluster.label.length).toBeGreaterThan(0);
    expect(cluster.painIds.length).toBeGreaterThanOrEqual(1);
  });
});
