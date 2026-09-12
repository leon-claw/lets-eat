import { describe, expect, it } from 'vitest';
import { classifyNearbyRestaurantName } from './restaurant-type-classifier';

describe('classifyNearbyRestaurantName', () => {
  it.each([
    ['蜀香老妈火锅', '火锅'],
    ['京都寿司屋', '日料'],
    ['星巴克咖啡', '甜品奶茶'],
    ['意大利披萨工坊', '西餐'],
    ['炭火烧烤店', '烧烤'],
  ])('将明显的商家名称归入 %s', (name, category) => {
    expect(classifyNearbyRestaurantName(name).category).toBe(category);
  });

  it.each(['老地方食府', '某某餐饮', '', '   '])('将信息不足的名称归入其他：%s', (name) => {
    expect(classifyNearbyRestaurantName(name)).toMatchObject({ category: '其他', source: 'fallback' });
  });

  it('返回 0 到 1 之间的置信度', () => {
    const result = classifyNearbyRestaurantName('蜀香老妈火锅');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
