import type { Database } from "bun:sqlite";
import {
  createPainRepo,
  createEmbeddingRepo,
  createClusterRepo,
} from "../db/repositories.ts";
import type { ClusteringService } from "./clustering-service.ts";
import type { ClusteringOutput } from "../types/pipeline.ts";
import type { Cluster } from "../types/domain.ts";

export async function runClusteringPipeline(
  db: Database,
  cluster: ClusteringService,
): Promise<ClusteringOutput> {
  const painRepo = createPainRepo(db);
  const embeddingRepo = createEmbeddingRepo(db);
  const clusterRepo = createClusterRepo(db);

  const pains = painRepo.list();
  const embeddings = embeddingRepo.list();

  const painsWithEmbeddings = pains.filter((p) =>
    embeddings.some((e) => e.painId === p.id),
  );

  const existingClusters = clusterRepo.list();
  for (const c of existingClusters) {
    clusterRepo.deleteById(c.id);
  }

  for (const pain of pains) {
    painRepo.updateClusterId(pain.id, null);
  }

  const errors: Error[] = [];
  let newClusters: Cluster[] = [];

  if (painsWithEmbeddings.length === 0) {
    return { clusters: [], errors: [] };
  }

  try {
    newClusters = await cluster(embeddings, painsWithEmbeddings);
  } catch (err) {
    errors.push(err instanceof Error ? err : new Error(String(err)));
    return { clusters: [], errors };
  }

  for (const c of newClusters) {
    clusterRepo.create(c);

    for (const painId of c.painIds) {
      painRepo.updateClusterId(painId, c.id);
    }
  }

  return { clusters: newClusters, errors };
}
