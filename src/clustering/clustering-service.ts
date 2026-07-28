import type { Pain, Embedding, Cluster } from "../types/domain.ts";

export type ClusteringService = (
  embeddings: Embedding[],
  pains: Pain[],
) => Promise<Cluster[]>;

const SIMILARITY_THRESHOLD = 0.85;

export function createSimulatedClusteringService(): ClusteringService {
  return async (embeddings: Embedding[], pains: Pain[]): Promise<Cluster[]> => {
    const painMap = new Map(pains.map((p) => [p.id, p]));
    const embeddingMap = new Map(embeddings.map((e) => [e.painId, e]));

    const validPains = pains.filter((p) => embeddingMap.has(p.id));
    if (validPains.length === 0) return [];

    const merged = new Map<string, { label: string; painIds: string[] }>();

    for (let i = 0; i < validPains.length; i++) {
      const painI = validPains[i]!;
      const embI = embeddingMap.get(painI.id)!;
      let assigned = false;

      for (const [clusterId, cluster] of merged) {
        const firstPainId = cluster.painIds[0]!;
        const firstEmb = embeddingMap.get(firstPainId)!;
        const sim = cosineSimilarity(
          embI.vector as number[],
          firstEmb.vector as number[],
        );

        if (sim >= SIMILARITY_THRESHOLD) {
          cluster.painIds.push(painI.id);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        const label = extractLabel(painI.description);
        const clusterId = crypto.randomUUID();
        merged.set(clusterId, { label, painIds: [painI.id] });
      }
    }

    return Array.from(merged.entries()).map(([id, entry]) => ({
      id,
      label: entry.label,
      description: `Cluster of ${entry.painIds.length} semantically similar pain(s)`,
      painIds: entry.painIds,
      createdAt: new Date(),
    }));
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! ** 2;
    normB += b[i]! ** 2;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

function extractLabel(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes("deploy")) return "Deployment";
  if (lower.includes("test") || lower.includes("debug")) return "Testing & Debugging";
  if (lower.includes("api") || lower.includes("integrat")) return "API & Integration";
  if (lower.includes("perf") || lower.includes("slow") || lower.includes("scale")) return "Performance";
  if (lower.includes("auth") || lower.includes("security") || lower.includes("login")) return "Auth & Security";
  if (lower.includes("document") || lower.includes("onboard") || lower.includes("learn")) return "Documentation";
  if (lower.includes("monitor") || lower.includes("observ")) return "Monitoring & Observability";
  if (lower.includes("config") || lower.includes("setup") || lower.includes("environ")) return "Configuration";

  return "General";
}
