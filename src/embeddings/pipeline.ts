import type { Database } from "bun:sqlite";
import {
  createPainRepo,
  createEmbeddingRepo,
} from "../db/repositories.ts";
import { hashContent, EMBEDDING_MODEL_VERSION } from "./embedding-service.ts";
import type { EmbeddingService } from "./embedding-service.ts";
import type { EmbeddingServiceOutput } from "../types/pipeline.ts";
import type { Embedding, Pain } from "../types/domain.ts";

export async function runEmbeddingPipeline(
  db: Database,
  embed: EmbeddingService,
): Promise<EmbeddingServiceOutput> {
  const painRepo = createPainRepo(db);
  const embeddingRepo = createEmbeddingRepo(db);

  const pains = painRepo.list();
  const embeddings: Embedding[] = [];
  const errors: Error[] = [];

  const painsNeedingEmbedding: Pain[] = [];

  for (const pain of pains) {
    const existing = embeddingRepo.getByPainId(pain.id);
    const currentContentHash = hashContent(pain.description);

    if (!existing) {
      painsNeedingEmbedding.push(pain);
      continue;
    }

    const isStale =
      existing.contentHash !== currentContentHash ||
      existing.modelVersion !== EMBEDDING_MODEL_VERSION;

    if (isStale) {
      embeddingRepo.deleteById(existing.id);
      painsNeedingEmbedding.push(pain);
    }
  }

  if (painsNeedingEmbedding.length > 0) {
    try {
      const newEmbeddings = await embed(painsNeedingEmbedding);
      for (const emb of newEmbeddings) {
        embeddingRepo.create(emb);
        embeddings.push(emb);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return { embeddings, errors };
}
