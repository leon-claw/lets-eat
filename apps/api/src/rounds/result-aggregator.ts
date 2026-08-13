import type { CatalogItem, ResultItem } from '@lets-eat/contracts';

export interface ResultPlayerInput {
  memberId: string;
  displayName: string;
  likedItemIds: readonly string[];
}

export interface AggregatedResult {
  commonItems: ResultItem[];
  players: Array<{
    memberId: string;
    displayName: string;
    items: ResultItem[];
  }>;
}

function toResultItem(item: CatalogItem): ResultItem {
  return { catalogItemId: item.id, order: item.order };
}

export function aggregateResult(
  items: readonly CatalogItem[],
  players: readonly ResultPlayerInput[],
): AggregatedResult {
  const resultItems = new Map(items.map((item) => [item.id, toResultItem(item)]));
  const orderedItems = [...items].sort((left, right) => left.order - right.order);

  const playerResults = players.map((player) => {
    const likedIds = new Set(player.likedItemIds);
    return {
      memberId: player.memberId,
      displayName: player.displayName,
      items: orderedItems
        .filter((item) => likedIds.has(item.id))
        .map((item) => resultItems.get(item.id)!),
    };
  });

  const commonItems = players.length === 0
    ? []
    : orderedItems
      .filter((item) => players.every((player) => new Set(player.likedItemIds).has(item.id)))
      .map((item) => resultItems.get(item.id)!);

  return { commonItems, players: playerResults };
}
