import { describe, test, expect } from "bun:test";
import { normalizeHackerNews } from "@/collectors/hacker-news/normalizer.ts";
import type { RawDocument } from "@/types/domain.ts";
import type { NormalizerInput } from "@/types/pipeline.ts";
import type { HNItem } from "@/collectors/hacker-news/types.ts";
import { hnItemToRawContent, hnItemToMetadata } from "@/collectors/hacker-news/types.ts";

function makeHNRawDocument(item: HNItem): RawDocument {
  return {
    id: crypto.randomUUID(),
    source: "hacker_news",
    externalId: String(item.id),
    rawContent: hnItemToRawContent(item),
    metadata: hnItemToMetadata(item) as unknown as Record<string, unknown>,
    collectedAt: new Date(),
  };
}

function makeStoryDoc(overrides: Partial<HNItem> = {}): RawDocument {
  return makeHNRawDocument({
    id: 100,
    type: "story",
    by: "author1",
    time: 1750000000,
    title: "Show HN: Cool Project",
    url: "https://example.com/cool-project",
    score: 42,
    descendants: 3,
    kids: [200, 201],
    ...overrides,
  });
}

function makeCommentDoc(overrides: Partial<HNItem> = {}): RawDocument {
  return makeHNRawDocument({
    id: 200,
    type: "comment",
    by: "commenter1",
    time: 1750000100,
    text: "This is awesome! Great work.",
    parent: 100,
    ...overrides,
  });
}

describe("HackerNewsNormalizer", () => {
  test("normalizes a story into a source-agnostic Document", () => {
    const rawDocs = [makeStoryDoc()];
    const input: NormalizerInput = { rawDocuments: rawDocs };
    const output = normalizeHackerNews(input);

    expect(output.errors.length).toBe(0);
    expect(output.documents.length).toBe(1);

    const doc = output.documents[0]!;
    expect(doc.source).toBe("hacker_news");
    expect(doc.externalId).toBe("100");
    expect(doc.title).toBe("Show HN: Cool Project");
    expect(doc.body).toContain("Show HN: Cool Project");
    expect(doc.url).toBe("https://example.com/cool-project");
    expect(doc.authorName).toBe("author1");
    expect(doc.sentiment).toBe("neutral");
    expect(doc.buyingSignals).toEqual([]);
    expect(doc.persona).toEqual({ role: "unknown", description: "" });
    expect(doc.rawDocumentId).toBe(rawDocs[0]!.id);
  });

  test("normalizes a story with text content (no URL)", () => {
    const rawDoc = makeStoryDoc({
      id: 101,
      title: "Ask HN: What are you working on?",
      text: "I'm curious what everyone is building.",
      url: undefined,
    });

    const output = normalizeHackerNews({ rawDocuments: [rawDoc] });
    const doc = output.documents[0]!;

    expect(doc.title).toBe("Ask HN: What are you working on?");
    expect(doc.body).toContain("I'm curious what everyone is building");
    expect(doc.url).toBeNull();
  });

  test("normalizes a comment into a source-agnostic Document", () => {
    const rawDocs = [makeStoryDoc(), makeCommentDoc()];
    const output = normalizeHackerNews({ rawDocuments: rawDocs });

    expect(output.errors.length).toBe(0);
    expect(output.documents.length).toBe(2);

    const comment = output.documents[1]!;
    expect(comment.authorName).toBe("commenter1");
    expect(comment.body).toBe("This is awesome! Great work.");
    expect(comment.title).toContain("comment by commenter1");
    expect(comment.url).toBeNull();
    expect(comment.sentiment).toBe("neutral");
  });

  test("handles empty raw documents list", () => {
    const output = normalizeHackerNews({ rawDocuments: [] });

    expect(output.errors.length).toBe(0);
    expect(output.documents.length).toBe(0);
  });

  test("sets postedAt from HN unix timestamp", () => {
    const timestamp = 1750000000;
    const rawDoc = makeStoryDoc({ time: timestamp });

    const output = normalizeHackerNews({ rawDocuments: [rawDoc] });
    const doc = output.documents[0]!;

    expect(doc.postedAt).toBeInstanceOf(Date);
    expect(doc.postedAt.getTime()).toBe(timestamp * 1000);
  });

  test("comment URL is null even when parent story has a URL", () => {
    const storyDoc = makeStoryDoc({
      id: 100,
      title: "Cool Project",
      url: "https://example.com",
    });
    const commentDoc = makeCommentDoc({ id: 200, parent: 100 });

    const output = normalizeHackerNews({ rawDocuments: [storyDoc, commentDoc] });

    const comment = output.documents.find((d) => d.externalId === "200");
    expect(comment).not.toBeNull();
    expect(comment!.url).toBeNull();
  });

  test("uses body text for stories with both text and url", () => {
    const rawDoc = makeStoryDoc({
      id: 102,
      title: "Great Project",
      text: "This is a detailed write-up about something interesting.",
      url: "https://project.example.com",
    });

    const output = normalizeHackerNews({ rawDocuments: [rawDoc] });
    const doc = output.documents[0]!;

    expect(doc.body).toContain("This is a detailed write-up");
    expect(doc.body).toContain("https://project.example.com");
    expect(doc.url).toBe("https://project.example.com");
  });

  test("creates deterministic document IDs for the same raw document", () => {
    const rawDoc = makeStoryDoc({ id: 100 });
    const rawDocB = {
      ...rawDoc,
      id: crypto.randomUUID(),
    };

    const outputA = normalizeHackerNews({ rawDocuments: [rawDoc] });
    const outputB = normalizeHackerNews({ rawDocuments: [rawDocB] });

    const normalizedIdA = outputA.documents[0]!.id;
    const normalizedIdB = outputB.documents[0]!.id;

    expect(normalizedIdA).toBe(normalizedIdB);
  });
});
