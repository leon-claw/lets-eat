import { describe, expect, it } from 'vitest';
import {
  classifyKnownRestaurantBrand,
  classifyNearbyRestaurantName,
} from './restaurant-type-classifier';

describe('classifyKnownRestaurantBrand', () => {
  it.each([
    ['麦当劳(农林下路店)', '西餐'],
    ['星巴克(农林下路)', '甜品奶茶'],
  ])('独立处理没有菜系词的连锁品牌 %s', (name, category) => {
    expect(classifyKnownRestaurantBrand(name)).toMatchObject({
      category,
      source: 'local-model',
    });
  });

  it('对未知商家名称不做品牌猜测', () => {
    expect(classifyKnownRestaurantBrand('长禧家.珑厨(东山口店)')).toBeUndefined();
  });
});

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

  it('使用具有辨识度的字符片段识别品牌化名称', () => {
    expect(classifyNearbyRestaurantName('蜀味小馆')).toMatchObject({
      category: '川菜',
      source: 'local-model',
    });
  });

  it.each([
    ['广东道至正家宴(东山宾馆店)', '粤菜'],
    ['鼎盛蜀坊重庆江湖菜(东山口店)', '川菜'],
    ['香港茶餐厅', '粤菜'],
  ])('利用商家名称中的地域菜系线索识别 %s', (name, category) => {
    expect(classifyNearbyRestaurantName(name)).toMatchObject({
      category,
      source: 'local-model',
    });
  });

  it.each([
    ['某某餐厅', '餐饮服务;外国餐厅;日本料理', '日料'],
    ['本地餐馆', '餐饮服务;中餐厅;四川菜(川菜)', '川菜'],
    ['街角小店', '餐饮服务;咖啡厅', '甜品奶茶'],
    ['海边酒楼', '餐饮服务;中餐厅;海鲜酒楼', '粤菜'],
  ])('使用高德分类辅助识别 %s', (name, amapType, category) => {
    expect(classifyNearbyRestaurantName(name, amapType)).toMatchObject({
      category,
      source: 'local-model',
    });
  });

  it('不会仅凭宽泛的高德分类强行归类', () => {
    expect(classifyNearbyRestaurantName('本地餐馆', '餐饮服务;中餐厅')).toMatchObject({
      category: '其他',
      source: 'fallback',
    });
  });

  it.each(['老地方食府', '某某餐饮', '', '   '])('将信息不足的名称归入其他：%s', (name) => {
    expect(classifyNearbyRestaurantName(name)).toMatchObject({ category: '其他', source: 'fallback' });
  });

  it.each([
    '长禧家.珑厨(东山口店)',
    '味然香(执信店)',
    '简·东山小厨家常菜',
  ])('中性店名没有菜系线索时归入其他：%s', (name) => {
    expect(classifyNearbyRestaurantName(name, '餐饮服务;中餐厅')).toMatchObject({
      category: '其他',
      source: 'fallback',
    });
  });

  it('返回 0 到 1 之间的置信度', () => {
    const result = classifyNearbyRestaurantName('蜀香老妈火锅');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
