import { describe, test, expect, beforeEach } from "bun:test";
import type { Database } from "bun:sqlite";
import {
  createRawDocumentRepo,
  createDocumentRepo,
  createEvidenceRepo,
  createPainRepo,
} from "@/db/repositories.ts";
import { runClassificationPipeline } from "@/classifiers/pipeline.ts";
import type { ClassifierService } from "@/classifiers/classifier-service.ts";
import type { AIClassificationResult } from "@/classifiers/types.ts";
import type {
  RawDocument,
  Document,
  Source,
  BuyingSignal,
  Persona,
  TargetMarket,
  Sentiment,
  Severity,
} from "@/types/domain.ts";
import { makeDb, makeId } from "@/db/test-utils.ts";

const now = new Date();

function makeRawDoc(overrides: Partial<RawDocument> = {}): RawDocument {
  return {
    id: makeId(),
    source: "hacker_news" as Source,
    externalId: "hn-1",
    rawContent: "Deploying is a nightmare. I've tried everything and nothing works reliably.",
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

function makeClassifierResult(overrides: Partial<AIClassificationResult> = {}): AIClassificationResult {
  return {
    sentiment: "negative" as Sentiment,
    persona: { role: "developer", description: "Full-stack developer deploying web apps" } as Persona,
    buyingSignals: [
      { indicator: "looking_for_solution", description: "Actively searching for a deployment solution" },
    ] as BuyingSignal[],
    evidence: [
      { excerpt: "Deploying is a nightmare", charOffset: 0, charLength: 24, confidence: 0.97 },
      { excerpt: "nothing works reliably", charOffset: 46, charLength: 23, confidence: 0.88 },
    ],
    pains: [
      {
        description: "Deployment workflows are unreliable and frustrating",
        severity: "high" as Severity,
        targetMarket: { segment: "development teams", description: "Teams deploying web applications" } as TargetMarket,
        evidenceIndices: [0, 1],
      },
    ],
    ...overrides,
  };
}

function makeMockClassifier(
  result: AIClassificationResult | ((title: string, body: string) => AIClassificationResult),
): ClassifierService {
  return async (title: string, body: string): Promise<AIClassificationResult> => {
    if (typeof result === "function") return result(title, body);
    return result;
  };
}

function makeThrowingClassifier(message: string): ClassifierService {
  return async (_title: string, _body: string): Promise<AIClassificationResult> => {
    throw new Error(message);
  };
}

describe("Classification Pipeline", () => {
  let db: Database;

  beforeEach(() => {
    db = makeDb();
  });

  function createDocument(rawDoc: RawDocument): Document {
    const rawDocs = createRawDocumentRepo(db);
    rawDocs.create(rawDoc);

    const docs = createDocumentRepo(db);
    const doc = makeDoc({ rawDocumentId: rawDoc.id });
    docs.create(doc);
    return doc;
  }

  test("classifies unclassified Document and stores Evidence with offsets and confidence", async () => {
    const rawDoc = makeRawDoc();
    const doc = createDocument(rawDoc);

    const expectedResult = makeClassifierResult();
    const classify = makeMockClassifier(expectedResult);
    const output = await runClassificationPipeline(db, classify);

    expect(output.errors.length).toBe(0);
    expect(output.classifiedDocuments.length).toBe(1);

    const classified = output.classifiedDocuments[0]!;
    expect(classified.documentId).toBe(doc.id);
    expect(classified.sentiment).toBe("negative");
    expect(classified.buyingSignals).toEqual(expectedResult.buyingSignals);
    expect(classified.persona).toEqual(expectedResult.persona);
    expect(classified.evidence.length).toBe(2);
    expect(classified.pains.length).toBe(1);

    const evidenceRepo = createEvidenceRepo(db);
    const storedEvidence = evidenceRepo.listByDocumentId(doc.id);
    expect(storedEvidence.length).toBe(2);
    expect(storedEvidence[0]!.excerpt).toBe("Deploying is a nightmare");
    expect(storedEvidence[0]!.charOffset).toBe(0);
    expect(storedEvidence[0]!.charLength).toBe(24);
    expect(storedEvidence[0]!.confidence).toBe(0.97);
    expect(storedEvidence[1]!.excerpt).toBe("nothing works reliably");
    expect(storedEvidence[1]!.charOffset).toBe(46);
    expect(storedEvidence[1]!.charLength).toBe(23);
    expect(storedEvidence[1]!.confidence).toBe(0.88);

    const painRepo = createPainRepo(db);
    const storedPains = painRepo.list();
    expect(storedPains.length).toBe(1);
    expect(storedPains[0]!.description).toBe("Deployment workflows are unreliable and frustrating");
    expect(storedPains[0]!.severity).toBe("high");
    expect(storedPains[0]!.targetMarket).toEqual({ segment: "development teams", description: "Teams deploying web applications" });
  });

  test("stores Pains linked to at least one Evidence each", async () => {
    const rawDoc = makeRawDoc();
    createDocument(rawDoc);

    const result = makeClassifierResult({
      pains: [
        {
          description: "Pain 1",
          severity: "high" as Severity,
          targetMarket: { segment: "S1", description: "D1" } as TargetMarket,
          evidenceIndices: [0],
        },
        {
          description: "Pain 2",
          severity: "medium" as Severity,
          targetMarket: { segment: "S2", description: "D2" } as TargetMarket,
          evidenceIndices: [1],
        },
      ],
    });

    const output = await runClassificationPipeline(db, makeMockClassifier(result));

    expect(output.errors.length).toBe(0);

    const evidenceRepo = createEvidenceRepo(db);
    const storedEvidence = evidenceRepo.listByDocumentId(output.classifiedDocuments[0]!.documentId);
    expect(storedEvidence.length).toBe(2);

    const painRepo = createPainRepo(db);
    const storedPains = painRepo.list();
    expect(storedPains.length).toBe(2);
    expect(storedPains[0]!.evidenceIds.length).toBeGreaterThanOrEqual(1);
    expect(storedPains[1]!.evidenceIds.length).toBeGreaterThanOrEqual(1);
    expect(storedPains[0]!.evidenceIds[0]).toBe(storedEvidence[0]!.id);
    expect(storedPains[1]!.evidenceIds[0]).toBe(storedEvidence[1]!.id);
  });

  test("updates Document with Sentiment, Persona, and BuyingSignals", async () => {
    const rawDoc = makeRawDoc();
    const doc = createDocument(rawDoc);

    const result = makeClassifierResult({
      sentiment: "very_negative" as Sentiment,
      persona: { role: "devops engineer", description: "Platform engineer handling deployments" } as Persona,
      buyingSignals: [
        { indicator: "replacement_intent", description: "Wants to switch from current tooling" },
        { indicator: "willing_to_pay", description: "Mentioned budget for a solution" },
      ] as BuyingSignal[],
    });

    await runClassificationPipeline(db, makeMockClassifier(result));

    const docRepo = createDocumentRepo(db);
    const updatedDoc = docRepo.getById(doc.id);
    expect(updatedDoc).not.toBeNull();
    expect(updatedDoc!.sentiment).toBe("very_negative");
    expect(updatedDoc!.buyingSignals).toEqual(result.buyingSignals);
    expect(updatedDoc!.persona).toEqual(result.persona);
  });

  test("skips already-classified Documents (only processes unclassified)", async () => {
    const rawDoc1 = makeRawDoc({ externalId: "hn-1" });
    const doc1 = createDocument(rawDoc1);

    const rawDoc2 = makeRawDoc({ externalId: "hn-2" });
    const doc2 = createDocument(rawDoc2);

    const evidenceRepo = createEvidenceRepo(db);
    evidenceRepo.create({
      id: makeId(),
      documentId: doc2.id,
      excerpt: "already classified evidence",
      charOffset: 0,
      charLength: 5,
      confidence: 0.9,
    });

    const result = makeClassifierResult();
    const classify = makeMockClassifier(result);
    const output = await runClassificationPipeline(db, classify);

    expect(output.classifiedDocuments.length).toBe(1);
    expect(output.classifiedDocuments[0]!.documentId).toBe(doc1.id);

    const docsWithEvidence = evidenceRepo.listByDocumentId(doc2.id);
    expect(docsWithEvidence.length).toBe(1);
  });

  test("idempotent: running pipeline twice produces no duplicates", async () => {
    const rawDoc = makeRawDoc();
    const doc = createDocument(rawDoc);

    const classifier = makeMockClassifier(makeClassifierResult());

    const firstRun = await runClassificationPipeline(db, classifier);
    expect(firstRun.classifiedDocuments.length).toBe(1);

    const evidenceRepo = createEvidenceRepo(db);
    const painRepo = createPainRepo(db);

    const evidenceCount = evidenceRepo.listByDocumentId(doc.id).length;
    expect(evidenceCount).toBe(2);

    const secondRun = await runClassificationPipeline(db, classifier);
    expect(secondRun.classifiedDocuments.length).toBe(0);

    const evidenceAfterSecond = evidenceRepo.listByDocumentId(doc.id);
    expect(evidenceAfterSecond.length).toBe(evidenceCount);

    const painsAfterSecond = painRepo.list();
    expect(painsAfterSecond.length).toBe(1);
  });

  test("idempotent: reprocessing updates without duplicating", async () => {
    const rawDoc = makeRawDoc();
    const doc = createDocument(rawDoc);

    const firstResult = makeClassifierResult({
      evidence: [
        { excerpt: "first run evidence", charOffset: 0, charLength: 19, confidence: 0.9 },
      ],
      pains: [
        {
          description: "First run pain",
          severity: "low" as Severity,
          targetMarket: { segment: "initial", description: "Initial run" } as TargetMarket,
          evidenceIndices: [0],
        },
      ],
    });

    await runClassificationPipeline(db, makeMockClassifier(firstResult));

    const evidenceRepo = createEvidenceRepo(db);
    const painRepo = createPainRepo(db);
    const docRepo = createDocumentRepo(db);

    const evidenceAfterFirst = evidenceRepo.listByDocumentId(doc.id);
    expect(evidenceAfterFirst.length).toBe(1);
    const painAfterFirst = painRepo.list();
    expect(painAfterFirst.length).toBe(1);

    for (const pain of painAfterFirst) {
      painRepo.deleteById(pain.id);
    }
    evidenceRepo.deleteByDocumentId(doc.id);
    docRepo.update(doc.id, {
      sentiment: "neutral",
      buyingSignals: [] as BuyingSignal[],
      persona: { role: "unknown", description: "" },
    });

    const secondResult = makeClassifierResult({
      sentiment: "positive" as Sentiment,
      evidence: [
        { excerpt: "second run A", charOffset: 0, charLength: 13, confidence: 0.95 },
        { excerpt: "second run B", charOffset: 50, charLength: 13, confidence: 0.92 },
      ],
      pains: [
        {
          description: "Second run pain",
          severity: "critical" as Severity,
          targetMarket: { segment: "updated", description: "Second run" } as TargetMarket,
          evidenceIndices: [0, 1],
        },
      ],
    });

    await runClassificationPipeline(db, makeMockClassifier(secondResult));

    const evidenceAfterSecond = evidenceRepo.listByDocumentId(doc.id);
    expect(evidenceAfterSecond.length).toBe(2);
    expect(evidenceAfterSecond[0]!.excerpt).toBe("second run A");

    const painsAfterSecond = painRepo.list();
    expect(painsAfterSecond.length).toBe(1);
    expect(painsAfterSecond[0]!.description).toBe("Second run pain");
    expect(painsAfterSecond[0]!.severity).toBe("critical");

    const updatedDoc = docRepo.getById(doc.id);
    expect(updatedDoc!.sentiment).toBe("positive");
    expect(updatedDoc!.buyingSignals).toEqual(secondResult.buyingSignals);
  });

  test("handles classification errors without crashing pipeline", async () => {
    const rawDoc1 = makeRawDoc({ externalId: "hn-1" });
    createDocument(rawDoc1);

    const rawDoc2 = makeRawDoc({ externalId: "hn-2" });
    createDocument(rawDoc2);

    let callCount = 0;
    const classifier = makeMockClassifier((_title, _body) => {
      callCount++;
      if (callCount === 1) throw new Error("AI model timeout");
      return makeClassifierResult();
    });

    const output = await runClassificationPipeline(db, classifier);

    expect(output.errors.length).toBe(1);
    expect(output.errors[0]!.message).toBe("AI model timeout");
    expect(output.classifiedDocuments.length).toBe(1);
  });

  test("returns empty output when no unclassified documents exist", async () => {
    const classifier = makeMockClassifier(makeClassifierResult());
    const output = await runClassificationPipeline(db, classifier);

    expect(output.classifiedDocuments.length).toBe(0);
    expect(output.errors.length).toBe(0);
  });

  test("skips pains whose evidenceIndices reference non-existent evidence", async () => {
    const rawDoc = makeRawDoc();
    createDocument(rawDoc);

    const result = makeClassifierResult({
      pains: [
        {
          description: "Pain with bad index — should be skipped",
          severity: "medium" as Severity,
          targetMarket: { segment: "test", description: "test" } as TargetMarket,
          evidenceIndices: [99],
        },
        {
          description: "Valid pain",
          severity: "high" as Severity,
          targetMarket: { segment: "valid", description: "valid" } as TargetMarket,
          evidenceIndices: [0],
        },
      ],
    });

    const output = await runClassificationPipeline(db, makeMockClassifier(result));

    const painRepo = createPainRepo(db);
    const storedPains = painRepo.list();
    expect(storedPains.length).toBe(1);
    expect(storedPains[0]!.description).toBe("Valid pain");
    expect(storedPains[0]!.evidenceIds.length).toBe(1);
  });

  test("handles AI returning empty evidence and pains", async () => {
    const rawDoc = makeRawDoc();
    createDocument(rawDoc);

    const result: AIClassificationResult = {
      sentiment: "neutral",
      persona: { role: "unknown", description: "" },
      buyingSignals: [] as BuyingSignal[],
      evidence: [],
      pains: [],
    };

    const output = await runClassificationPipeline(db, makeMockClassifier(result));

    expect(output.errors.length).toBe(0);
    expect(output.classifiedDocuments.length).toBe(1);

    const classified = output.classifiedDocuments[0]!;
    expect(classified.evidence.length).toBe(0);
    expect(classified.pains.length).toBe(0);

    const docRepo = createDocumentRepo(db);
    const updatedDoc = docRepo.getById(classified.documentId);
    expect(updatedDoc!.sentiment).toBe("neutral");
  });
});
