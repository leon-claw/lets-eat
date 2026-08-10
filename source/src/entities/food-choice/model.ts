import { shuffle } from '@/shared/utils/shuffle';
import type { FoodChoice } from './types';

export function createChoiceRound(
  choices: readonly FoodChoice[],
  random: () => number = Math.random,
): FoodChoice[] {
  const uniqueChoices = [...new Map(choices.map((choice) => [choice.id, choice])).values()];
  return shuffle(uniqueChoices, random);
}
