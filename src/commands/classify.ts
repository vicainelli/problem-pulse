import { openDb } from "@/db/connection.ts";
import { createSimulatedClassifier } from "@/classifiers/classifier-service.ts";
import { runClassificationPipeline } from "@/classifiers/pipeline.ts";

const DB_PATH = process.env.DB_PATH ?? "./data/pulse.db";

async function classify() {
  console.log(`[classify] Opening database at ${DB_PATH}...`);
  const db = openDb(DB_PATH);

  console.log("[classify] Starting classification pipeline...");
  const classifier = createSimulatedClassifier();
  const output = await runClassificationPipeline(db, classifier);

  console.log(`[classify] Classified ${output.classifiedDocuments.length} documents`);
  if (output.errors.length > 0) {
    console.log(`[classify] ${output.errors.length} errors during classification`);
    for (const err of output.errors) {
      console.log(`  - ${err.message}`);
    }
  }

  for (const doc of output.classifiedDocuments) {
    console.log(`  [classify] Document ${doc.documentId}: sentiment=${doc.sentiment}, pains=${doc.pains.length}, evidence=${doc.evidence.length}`);
  }

  db.close();
  console.log("[classify] Done.");
}

classify().catch((err) => {
  console.error("[classify] Fatal error:", err);
  process.exit(1);
});
