import { describe, expect, it } from 'vitest';
import { mockFoodChoiceRepository } from './mock-repository';

describe('mockFoodChoiceRepository', () => {
  it('returns 16 unique and complete mixed food choices', async () => {
    const choices = await mockFoodChoiceRepository.list();

    expect(choices).toHaveLength(16);
    expect(new Set(choices.map((item) => item.id)).size).toBe(16);
    expect(choices.map((item) => item.name)).toEqual(expect.arrayContaining([
      '粤菜',
      '川菜',
      '火锅',
      '烧烤',
      '螺蛳粉',
      '轻食',
      '日料',
      '甜品奶茶',
    ]));

    for (const item of choices) {
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.coverImage).toMatch(/^https:\/\//);
      expect(item.tags.length).toBeGreaterThanOrEqual(2);
      expect(item.representativeFoods.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns a defensive array copy', async () => {
    const first = await mockFoodChoiceRepository.list();
    const second = await mockFoodChoiceRepository.list();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
