export function filterCatalogItemsByIds<T extends { id: string }>(items: T[], itemIds: string[]): T[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return itemIds
    .map((itemId) => itemsById.get(itemId))
    .filter((item): item is T => item !== undefined);
}
