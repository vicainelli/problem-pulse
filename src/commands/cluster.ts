import { openDb } from "@/db/connection.ts";
import { createSimulatedEmbeddingService } from "@/embeddings/embedding-service.ts";
import { runEmbeddingPipeline } from "@/embeddings/pipeline.ts";
import { createSimulatedClusteringService } from "@/clustering/clustering-service.ts";
import { runClusteringPipeline } from "@/clustering/pipeline.ts";

const DB_PATH = process.env.DB_PATH ?? "./data/pulse.db";

async function cluster() {
  console.log(`[cluster] Opening database at ${DB_PATH}...`);
  const db = openDb(DB_PATH);

  console.log("[cluster] Running embedding pipeline...");
  const embedder = createSimulatedEmbeddingService();
  const embedOutput = await runEmbeddingPipeline(db, embedder);

  console.log(`[cluster] Generated ${embedOutput.embeddings.length} embeddings`);
  if (embedOutput.errors.length > 0) {
    console.log(`[cluster] ${embedOutput.errors.length} errors during embedding`);
    for (const err of embedOutput.errors) {
      console.log(`  - ${err.message}`);
    }
  }

  console.log("[cluster] Running clustering pipeline...");
  const clusterer = createSimulatedClusteringService();
  const clusterOutput = await runClusteringPipeline(db, clusterer);

  console.log(`[cluster] Created ${clusterOutput.clusters.length} clusters`);
  if (clusterOutput.errors.length > 0) {
    console.log(`[cluster] ${clusterOutput.errors.length} errors during clustering`);
    for (const err of clusterOutput.errors) {
      console.log(`  - ${err.message}`);
    }
  }

  for (const c of clusterOutput.clusters) {
    console.log(`  [cluster] Cluster "${c.label}": ${c.painIds.length} pain(s)`);
  }

  db.close();
  console.log("[cluster] Done.");
}

cluster().catch((err) => {
  console.error("[cluster] Fatal error:", err);
  process.exit(1);
});
