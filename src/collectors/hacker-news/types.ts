export const HN_ITEM_TYPES = ["job", "story", "comment", "poll", "pollopt"] as const;
export type HNItemType = (typeof HN_ITEM_TYPES)[number];

export interface HNItem {
  id: number;
  deleted?: boolean;
  type: HNItemType;
  by?: string;
  time?: number;
  text?: string;
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  parts?: number[];
  descendants?: number;
}

export interface HNRawDocumentMetadata {
  itemType: HNItemType;
  parentId?: number;
  score?: number;
  descendants?: number;
  kids?: number[];
}

export function hnItemToRawContent(item: HNItem): string {
  return JSON.stringify({
    id: item.id,
    type: item.type,
    by: item.by,
    time: item.time,
    title: item.title,
    url: item.url,
    text: item.text,
    parent: item.parent,
    deleted: item.deleted,
    dead: item.dead,
    score: item.score,
    descendants: item.descendants,
  });
}

export function hnItemToMetadata(item: HNItem): HNRawDocumentMetadata {
  const metadata: HNRawDocumentMetadata = {
    itemType: item.type,
    score: item.score,
    descendants: item.descendants,
    kids: item.kids,
  };

  if (item.parent !== undefined) {
    metadata.parentId = item.parent;
  }

  return metadata;
}
