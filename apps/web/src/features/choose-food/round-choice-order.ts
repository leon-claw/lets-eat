import { shuffle } from '@/shared/utils/shuffle';

export function prepareRoundChoices<T extends { id: string }>(
  choices: readonly T[],
  savedItemIds?: readonly string[],
  random: () => number = Math.random,
): T[] {
  if (savedItemIds && hasSameItems(choices, savedItemIds)) {
    const choicesById = new Map(choices.map((choice) => [choice.id, choice]));
    return savedItemIds.map((itemId) => choicesById.get(itemId)!);
  }
  return shuffle(choices, random);
}

function hasSameItems<T extends { id: string }>(choices: readonly T[], itemIds: readonly string[]): boolean {
  return choices.length === itemIds.length
    && new Set(itemIds).size === itemIds.length
    && choices.every((choice) => itemIds.includes(choice.id));
}
