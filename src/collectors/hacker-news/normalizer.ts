import type { NormalizerInput, NormalizerOutput } from "@/types/pipeline.ts";
import type { Document, Source } from "@/types/domain.ts";
import type { HNItem, HNRawDocumentMetadata } from "./types.ts";

function rawDocToHNItem(rawContent: string): HNItem | null {
  try {
    const parsed = JSON.parse(rawContent) as HNItem;
    if (!parsed.id || !parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildStoryBody(item: HNItem): string {
  const parts: string[] = [];

  if (item.title) parts.push(item.title);
  if (item.text) parts.push(item.text);
  if (item.url) parts.push(item.url);

  return parts.join("\n\n") || "(no content)";
}

function buildCommentTitle(item: HNItem): string {
  const by = item.by ?? "unknown";
  const preview = item.text
    ? item.text.slice(0, 80).replace(/\n/g, " ")
    : "(no text)";
  return `HN comment by ${by}: ${preview}`;
}

function generateDocumentId(source: string, externalId: string): string {
  const input = `${source}:${externalId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `hn-${externalId}-${hex}`;
}

export function normalizeHackerNews(input: NormalizerInput): NormalizerOutput {
  const documents: Document[] = [];
  const errors: Error[] = [];

  for (const rawDoc of input.rawDocuments) {
    try {
      const item = rawDocToHNItem(rawDoc.rawContent);
      if (!item) {
        errors.push(new Error(`Failed to parse HN item from raw document ${rawDoc.id}`));
        continue;
      }

      const metadata = rawDoc.metadata as unknown as HNRawDocumentMetadata;

      const title = item.type === "story"
        ? item.title ?? ""
        : buildCommentTitle(item);

      const body = item.type === "story"
        ? buildStoryBody(item)
        : (item.text ?? "");

      const document: Document = {
        id: generateDocumentId(rawDoc.source, rawDoc.externalId),
        rawDocumentId: rawDoc.id,
        source: rawDoc.source as Source,
        externalId: rawDoc.externalId,
        title,
        body,
        authorName: item.by ?? null,
        postedAt: item.time ? new Date(item.time * 1000) : new Date(),
        url: item.type === "story" ? (item.url ?? null) : null,
        sentiment: "neutral",
        buyingSignals: [],
        persona: { role: "unknown", description: "" },
        normalizedAt: new Date(),
      };

      documents.push(document);
    } catch (err) {
      errors.push(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return { documents, errors };
}
