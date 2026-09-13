import { describe, expect, it } from 'vitest';
import {
  classifyKnownRestaurantBrand,
  classifyNearbyRestaurantName,
  hasStrongNearbyLuosifenSignal,
} from './restaurant-classifier.js';

describe('nearby restaurant classifier', () => {
  it.each([
    ['麦当劳(邦华店)', '西餐'],
    ['星巴克(农林下路)', '甜品奶茶'],
    ['达美乐比萨(龙溪店)', '西餐'],
  ])('独立处理连锁品牌 %s', (name, category) => {
    expect(classifyKnownRestaurantBrand(name)).toMatchObject({ category });
  });

  it.each([
    ['长禧家.珑厨(东山口店)', '餐饮服务;中餐厅'],
    ['味然香(执信店)', '餐饮服务;中餐厅'],
    ['简·东山小厨家常菜', '餐饮服务;中餐厅'],
  ])('中性店名归入其他：%s', (name, amapType) => {
    expect(classifyNearbyRestaurantName(name, amapType)).toMatchObject({ category: '其他' });
  });

  it.each([
    ['广东道至正家宴(东山宾馆店)', '粤菜'],
    ['鼎盛蜀坊重庆江湖菜(东山口店)', '川菜'],
    ['香港茶餐厅', '粤菜'],
    ['街角小店', '餐饮服务;中餐厅;海鲜酒楼', '粤菜'],
    ['本地餐馆', '餐饮服务;中餐厅;四川菜(川菜)', '川菜'],
  ])('结合店名和高德分类识别高置信类别', (name, amapType, expected = amapType) => {
    expect(classifyNearbyRestaurantName(name, amapType)).toMatchObject({ category: expected });
  });

  it('不会把宽泛的高德中餐分类强行归类', () => {
    expect(classifyNearbyRestaurantName('本地餐馆', '餐饮服务;中餐厅')).toMatchObject({ category: '其他' });
  });

  it('只在店名或高德分类明确出现时识别螺蛳粉', () => {
    expect(hasStrongNearbyLuosifenSignal('素里螺记螺蛳粉', '餐饮服务;快餐厅')).toBe(true);
    expect(hasStrongNearbyLuosifenSignal('达美乐比萨', '餐饮服务;中餐厅')).toBe(false);
  });
});
