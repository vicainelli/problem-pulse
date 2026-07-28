import { describe, test, expect } from "bun:test";
import { createHackerNewsCollector } from "@/collectors/hacker-news/collector.ts";
import type { HNItem } from "@/collectors/hacker-news/types.ts";
import type { CollectorInput, CollectorOutput } from "@/types/pipeline.ts";
import type { Source } from "@/types/domain.ts";

function makeStory(overrides: Partial<HNItem> = {}): HNItem {
  return {
    id: 100,
    type: "story",
    by: "author1",
    time: 1750000000,
    title: "Show HN: Cool Project",
    url: "https://example.com/cool-project",
    score: 42,
    descendants: 5,
    kids: [200, 201],
    ...overrides,
  };
}

function makeComment(overrides: Partial<HNItem> = {}): HNItem {
  return {
    id: 200,
    type: "comment",
    by: "commenter1",
    time: 1750000100,
    text: "This is awesome! Great work.",
    parent: 100,
    kids: [300],
    ...overrides,
  };
}

function makeNestedComment(overrides: Partial<HNItem> = {}): HNItem {
  return {
    id: 300,
    type: "comment",
    by: "commenter2",
    time: 1750000200,
    text: "I agree, really well done.",
    parent: 200,
    ...overrides,
  };
}

function makeMockFetch(items: Map<number, HNItem>, topStoryIds: number[]) {
  return async (url: string): Promise<Response> => {
    const urlStr = url.toString();

    if (urlStr.endsWith("/topstories.json")) {
      return new Response(JSON.stringify(topStoryIds), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const match = urlStr.match(/\/item\/(\d+)\.json$/);
    if (match) {
      const id = parseInt(match[1]!, 10);
      const item = items.get(id);
      if (item) {
        return new Response(JSON.stringify(item), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("null", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  };
}

const BASE_URL = "https://hacker-news.firebaseio.com/v0";

async function runCollector(
  items: Map<number, HNItem>,
  topStoryIds: number[],
  params: Record<string, unknown> = {},
) {
  const mockFetch = makeMockFetch(items, topStoryIds);
  const collector = createHackerNewsCollector(mockFetch, BASE_URL);
  const input: CollectorInput = {
    source: "hacker_news" as Source,
    params: { fetchComments: true, maxStories: 10, ...params },
  };
  return collector(input);
}

async function getOutputMap(output: CollectorOutput): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  for (const doc of output.rawDocuments) {
    map.set(doc.externalId, doc);
  }
  return map;
}

describe("HackerNewsCollector", () => {
  test("collects top stories as RawDocuments", async () => {
    const items = new Map<number, HNItem>();
    const story = makeStory({ id: 100 });
    items.set(100, story);

    const output = await runCollector(items, [100]);
    const docs = await getOutputMap(output);

    expect(output.errors.length).toBe(0);
    expect(output.rawDocuments.length).toBe(1);

    const doc = output.rawDocuments[0]!;
    expect(doc.source).toBe("hacker_news");
    expect(doc.externalId).toBe("100");
    expect(doc.rawContent).toContain("Show HN: Cool Project");
    expect(doc.metadata.itemType).toBe("story");
    expect(doc.metadata.score).toBe(42);
  });

  test("collects story with comments recursively", async () => {
    const items = new Map<number, HNItem>();
    items.set(100, makeStory({ id: 100, kids: [200] }));
    items.set(200, makeComment({ id: 200, parent: 100, kids: [300] }));
    items.set(300, makeNestedComment({ id: 300, parent: 200 }));

    const output = await runCollector(items, [100]);
    const docs = await getOutputMap(output);

    expect(output.errors.length).toBe(0);
    expect(output.rawDocuments.length).toBe(3);

    const storyDoc = docs.get("100") as Record<string, unknown>;
    const commentDoc = docs.get("200") as Record<string, unknown>;
    const nestedDoc = docs.get("300") as Record<string, unknown>;

    const storyMeta = (storyDoc as Record<string, unknown>).metadata as Record<string, unknown>;
    const commentMeta = (commentDoc as Record<string, unknown>).metadata as Record<string, unknown>;
    const nestedMeta = (nestedDoc as Record<string, unknown>).metadata as Record<string, unknown>;
    expect(storyMeta.itemType).toBe("story");
    expect(commentMeta.itemType).toBe("comment");
    expect(commentMeta.parentId).toBe(100);
    expect(nestedMeta.itemType).toBe("comment");
    expect(nestedMeta.parentId).toBe(200);
  });

  test("skips deleted and dead items", async () => {
    const items = new Map<number, HNItem>();
    items.set(100, makeStory({ id: 100 }));
    items.set(200, makeComment({ id: 200, deleted: true }));
    items.set(300, makeComment({ id: 300, dead: true }));

    const output = await runCollector(items, [100]);
    expect(output.rawDocuments.length).toBe(1);
  });

  test("respects maxStories param", async () => {
    const items = new Map<number, HNItem>();
    items.set(100, makeStory({ id: 100 }));
    items.set(200, makeStory({ id: 200 }));
    items.set(300, makeStory({ id: 300 }));

    const output = await runCollector(items, [100, 200, 300], { maxStories: 2 });

    expect(output.rawDocuments.length).toBe(2);
  });

  test("captures fetch errors without failing", async () => {
    const items = new Map<number, HNItem>();
    items.set(100, makeStory({ id: 100, kids: [200] }));
    items.set(200, makeComment({ id: 200, parent: 100, kids: [400] }));

    const output = await runCollector(items, [100]);
    expect(output.errors.length).toBe(0);
    expect(output.rawDocuments.length).toBe(2);
  });

  test("captures network errors gracefully", async () => {
    const mockFetch = async (url: string): Promise<Response> => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/topstories.json")) {
        return new Response("[]", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("null", { status: 200 });
    };

    const collector = createHackerNewsCollector(mockFetch);
    const input: CollectorInput = {
      source: "hacker_news" as Source,
      params: { fetchComments: true, maxStories: 1 },
    };
    const output = await collector(input);

    expect(output.rawDocuments.length).toBe(0);
    expect(output.errors.length).toBe(0);
  });

  test("captures fetch errors when story fails with 500", async () => {
    let callCount = 0;
    const mockFetch = async (url: string): Promise<Response> => {
      callCount++;
      const urlStr = url.toString();
      if (urlStr.endsWith("/topstories.json")) {
        return new Response(JSON.stringify([100]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Server Error", { status: 500 });
    };

    const collector = createHackerNewsCollector(mockFetch);
    const input: CollectorInput = {
      source: "hacker_news" as Source,
      params: { fetchComments: true, maxStories: 1 },
    };
    const output = await collector(input);

    expect(output.errors.length).toBeGreaterThan(0);
  });

  test("handles stories without kids gracefully", async () => {
    const items = new Map<number, HNItem>();
    items.set(100, makeStory({ id: 100, kids: undefined }));

    const output = await runCollector(items, [100]);

    expect(output.errors.length).toBe(0);
    expect(output.rawDocuments.length).toBe(1);
  });

  test("fetches multiple top-level stories", async () => {
    const items = new Map<number, HNItem>();
    items.set(100, makeStory({ id: 100 }));
    items.set(200, makeStory({ id: 200, title: "Another Story" }));
    items.set(300, makeStory({ id: 300, title: "Third Story" }));

    const output = await runCollector(items, [100, 200, 300]);

    expect(output.errors.length).toBe(0);
    expect(output.rawDocuments.length).toBe(3);
  });
});
