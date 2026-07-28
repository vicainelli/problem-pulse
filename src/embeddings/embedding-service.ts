import type { Pain, Embedding } from "../types/domain.ts";

export const EMBEDDING_MODEL_VERSION = "simulated-v1";
export const EMBEDDING_DIMENSIONS = 16;

export type EmbeddingService = (pains: Pain[]) => Promise<Embedding[]>;

export function hashContent(content: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(content);
  return hasher.digest("hex");
}

export function createSimulatedEmbeddingService(): EmbeddingService {
  return async (pains: Pain[]): Promise<Embedding[]> => {
    return pains.map((pain) => {
      const contentHash = hashContent(pain.description);
      const vector = generateVector(contentHash, EMBEDDING_DIMENSIONS);

      return {
        id: crypto.randomUUID(),
        painId: pain.id,
        vector,
        dimensions: EMBEDDING_DIMENSIONS,
        modelVersion: EMBEDDING_MODEL_VERSION,
        contentHash,
        createdAt: new Date(),
      };
    });
  };
}

export function generateVector(contentHash: string, dimensions: number): number[] {
  const hashBytes = new Uint8Array(
    contentHash.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );

  const vector: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    const byte = hashBytes[i % hashBytes.length]!;
    const value = byte / 128 - 1;
    vector.push(Math.round(value * 1000) / 1000);
  }
  return vector;
}
