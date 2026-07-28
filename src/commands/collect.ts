import { openDb } from "@/db/connection.ts";
import {
  createRawDocumentRepo,
  createDocumentRepo,
} from "@/db/repositories.ts";
import { createHackerNewsCollector } from "@/collectors/hacker-news/collector.ts";
import { normalizeHackerNews } from "@/collectors/hacker-news/normalizer.ts";
import type { CollectorInput } from "@/types/pipeline.ts";
import type { Source } from "@/types/domain.ts";

const DB_PATH = process.env.DB_PATH ?? "./data/pulse.db";

async function collect() {
  console.log(`[collect] Opening database at ${DB_PATH}...`);
  const db = openDb(DB_PATH);
  const rawDocRepo = createRawDocumentRepo(db);
  const docRepo = createDocumentRepo(db);

  console.log("[collect] Starting HackerNews collector...");
  const collector = createHackerNewsCollector();
  const collectorInput: CollectorInput = {
    source: "hacker_news" as Source,
    params: { fetchComments: true, maxStories: 30 },
  };
  const collectorOutput = await collector(collectorInput);

  console.log(`[collect] Fetched ${collectorOutput.rawDocuments.length} raw documents`);
  if (collectorOutput.errors.length > 0) {
    console.log(`[collect] ${collectorOutput.errors.length} errors during collection`);
    for (const err of collectorOutput.errors) {
      console.log(`  - ${err.message}`);
    }
  }

  let persistedCount = 0;
  for (const rawDoc of collectorOutput.rawDocuments) {
    rawDocRepo.createOrUpdate(rawDoc);
    persistedCount++;
  }
  console.log(`[collect] Persisted ${persistedCount} raw documents`);

  console.log("[collect] Normalizing documents...");
  const normalizerOutput = normalizeHackerNews({
    rawDocuments: collectorOutput.rawDocuments,
  });

  console.log(`[collect] Normalized ${normalizerOutput.documents.length} documents`);
  if (normalizerOutput.errors.length > 0) {
    console.log(`[collect] ${normalizerOutput.errors.length} errors during normalization`);
    for (const err of normalizerOutput.errors) {
      console.log(`  - ${err.message}`);
    }
  }

  let normalizedCount = 0;
  for (const doc of normalizerOutput.documents) {
    const existing = docRepo.getById(doc.id);
    if (existing) {
      docRepo.update(doc.id, {
        title: doc.title,
        body: doc.body,
        authorName: doc.authorName,
        postedAt: doc.postedAt,
        url: doc.url,
      });
    } else {
      docRepo.create(doc);
    }
    normalizedCount++;
  }
  console.log(`[collect] Persisted ${normalizedCount} normalized documents`);

  db.close();
  console.log("[collect] Done.");
}

collect().catch((err) => {
  console.error("[collect] Fatal error:", err);
  process.exit(1);
});
