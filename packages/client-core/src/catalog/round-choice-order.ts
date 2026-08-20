export function shuffleChoices<T>(choices: T[], random: () => number = Math.random): T[] {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index]!;
    const target = shuffled[swapIndex]!;
    shuffled[index] = target;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

export function hasExactChoiceOrder<T extends { id: string }>(choices: T[], itemIds: string[]): boolean {
  return (
    itemIds.length === choices.length &&
    new Set(itemIds).size === choices.length &&
    itemIds.every((itemId) => choices.some((choice) => choice.id === itemId))
  );
}
