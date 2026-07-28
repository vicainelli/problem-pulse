import type { CollectorInput, CollectorOutput } from "@/types/pipeline.ts";
import type { RawDocument, Source } from "@/types/domain.ts";
import type { HNItem } from "./types.ts";
import { hnItemToRawContent, hnItemToMetadata } from "./types.ts";

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

export function createHackerNewsCollector(
  fetchFn: (url: string) => Promise<Response> = fetch,
  baseUrl: string = HN_BASE,
) {
  async function fetchItem(id: number): Promise<HNItem | null> {
    const res = await fetchFn(`${baseUrl}/item/${id}.json`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch HN item ${id}: ${res.status}`);
    }
    const text = await res.text();
    if (text === "null") return null;
    return JSON.parse(text) as HNItem;
  }

  async function fetchTopStories(limit: number): Promise<number[]> {
    const res = await fetchFn(`${baseUrl}/topstories.json`);
    if (!res.ok) throw new Error(`Failed to fetch top stories: ${res.status}`);
    const ids = (await res.json()) as number[];
    return ids.slice(0, limit);
  }

  async function fetchItemsRecursively(
    ids: number[],
    items: Map<number, HNItem>,
    errors: Error[],
  ): Promise<void> {
    const promises = ids.map(async (id) => {
      if (items.has(id)) return;

      try {
        const item = await fetchItem(id);
        if (!item) return;

        items.set(id, item);

        if (item.kids && item.kids.length > 0) {
          await fetchItemsRecursively(item.kids, items, errors);
        }
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    });

    await Promise.all(promises);
  }

  function itemToRawDocument(item: HNItem, source: Source): RawDocument {
    return {
      id: crypto.randomUUID(),
      source,
      externalId: String(item.id),
      rawContent: hnItemToRawContent(item),
      metadata: hnItemToMetadata(item) as unknown as Record<string, unknown>,
      collectedAt: new Date(),
    };
  }

  return async function collect(input: CollectorInput): Promise<CollectorOutput> {
    const errors: Error[] = [];
    const rawDocuments: RawDocument[] = [];
    const source = input.source as Source;
    const maxStories = (input.params.maxStories as number) ?? 30;
    const fetchComments = input.params.fetchComments !== false;

    try {
      const storyIds = await fetchTopStories(maxStories);

      if (fetchComments && storyIds.length > 0) {
        const items = new Map<number, HNItem>();
        await fetchItemsRecursively(storyIds, items, errors);

        for (const item of items.values()) {
          if (item.deleted || item.dead) continue;
          rawDocuments.push(itemToRawDocument(item, source));
        }
      } else {
        const storyPromises = storyIds.map(async (id) => {
          try {
            const item = await fetchItem(id);
            if (item) rawDocuments.push(itemToRawDocument(item, source));
          } catch (err) {
            errors.push(err instanceof Error ? err : new Error(String(err)));
          }
        });
        await Promise.all(storyPromises);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }

    return { rawDocuments, errors };
  };
}
