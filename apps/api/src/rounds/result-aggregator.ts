import type { CatalogItem, ResultItem } from '@lets-eat/contracts';

export function aggregateResult(items: readonly CatalogItem[], likedItemIds: readonly string[]): ResultItem[] {
  const counts = new Map<string, number>();
  for (const id of likedItemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return items
    .flatMap((item) => counts.has(item.id)
      ? [{ catalogItemId: item.id, likeCount: counts.get(item.id)!, order: item.order }]
      : [])
    .sort((left, right) => right.likeCount - left.likeCount || left.order - right.order);
}
