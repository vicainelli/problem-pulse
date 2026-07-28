import type { Database } from "bun:sqlite";
import {
  createDocumentRepo,
  createEvidenceRepo,
  createPainRepo,
} from "../db/repositories.ts";
import type { ClassifierService } from "./classifier-service.ts";
import type { ClassifierOutput } from "../types/pipeline.ts";
import type { ClassifiedDocument, Pain } from "../types/domain.ts";

export async function runClassificationPipeline(
  db: Database,
  classify: ClassifierService,
): Promise<ClassifierOutput> {
  const docRepo = createDocumentRepo(db);
  const evidenceRepo = createEvidenceRepo(db);
  const painRepo = createPainRepo(db);

  const documents = docRepo.listUnclassified();
  const classifiedDocuments: ClassifiedDocument[] = [];
  const errors: Error[] = [];

  for (const doc of documents) {
    try {
      const classified = await classifyOne(
        doc.id,
        doc.title,
        doc.body,
        classify,
        docRepo,
        evidenceRepo,
        painRepo,
      );
      classifiedDocuments.push(classified);
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return { classifiedDocuments, errors };
}

function cleanupExistingEvidence(
  documentId: string,
  evidenceRepo: ReturnType<typeof createEvidenceRepo>,
  painRepo: ReturnType<typeof createPainRepo>,
): void {
  const existingEvidence = evidenceRepo.listByDocumentId(documentId);
  if (existingEvidence.length === 0) return;

  const existingIds = new Set(existingEvidence.map((e) => e.id));
  const allPains = painRepo.list();
  for (const pain of allPains) {
    if (pain.evidenceIds.some((id) => existingIds.has(id))) {
      painRepo.deleteById(pain.id);
    }
  }
  evidenceRepo.deleteByDocumentId(documentId);
}

async function classifyOne(
  documentId: string,
  title: string,
  body: string,
  classify: ClassifierService,
  docRepo: ReturnType<typeof createDocumentRepo>,
  evidenceRepo: ReturnType<typeof createEvidenceRepo>,
  painRepo: ReturnType<typeof createPainRepo>,
): Promise<ClassifiedDocument> {
  cleanupExistingEvidence(documentId, evidenceRepo, painRepo);

  const result = await classify(title, body);

  const evidenceIds: string[] = [];
  for (const aiEvidence of result.evidence) {
    const evId = crypto.randomUUID();
    evidenceRepo.create({
      id: evId,
      documentId,
      excerpt: aiEvidence.excerpt,
      charOffset: aiEvidence.charOffset,
      charLength: aiEvidence.charLength,
      confidence: aiEvidence.confidence,
    });
    evidenceIds.push(evId);
  }

  const painRecords: Omit<Pain, "id" | "clusterId" | "createdAt">[] = [];
  for (const aiPain of result.pains) {
    const refIds = aiPain.evidenceIndices
      .map((idx) => evidenceIds[idx])
      .filter((id): id is string => id !== undefined);

    if (refIds.length === 0) continue;

    painRecords.push({
      description: aiPain.description,
      severity: aiPain.severity,
      targetMarket: aiPain.targetMarket,
      evidenceIds: refIds,
    });
  }

  for (const painRecord of painRecords) {
    painRepo.create({
      id: crypto.randomUUID(),
      description: painRecord.description,
      severity: painRecord.severity,
      targetMarket: painRecord.targetMarket,
      evidenceIds: painRecord.evidenceIds,
      clusterId: null,
      createdAt: new Date(),
    });
  }

  docRepo.update(documentId, {
    sentiment: result.sentiment,
    buyingSignals: result.buyingSignals,
    persona: result.persona,
  });

  return {
    documentId,
    sentiment: result.sentiment,
    buyingSignals: result.buyingSignals,
    persona: result.persona,
    pains: painRecords,
    evidence: result.evidence,
  };
}
