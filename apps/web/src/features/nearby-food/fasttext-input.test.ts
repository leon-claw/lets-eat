import { describe, expect, it } from 'vitest';
import {
  formatNearbyRestaurantForFastText,
  parseNearbyFastTextLabel,
} from './fasttext-input';

describe('fastText input protocol', () => {
  it('matches the training feature format', () => {
    expect(formatNearbyRestaurantForFastText('广州 酒家', '餐饮服务|中餐厅|广东菜(粤菜)'))
      .toBe('name_广州_酒家 amap_餐饮服务 amap_中餐厅 amap_广东菜_粤菜_');
  });

  it('removes branch details only from the restaurant name and preserves Amap parenthetical labels', () => {
    expect(formatNearbyRestaurantForFastText('广东道至正家宴(东山宾馆店)', '餐饮服务;中餐厅;广东菜(粤菜)'))
      .toBe('name_广东道至正家宴 amap_餐饮服务 amap_中餐厅 amap_广东菜_粤菜_');
  });

  it('accepts only labels known by the application', () => {
    expect(parseNearbyFastTextLabel('__label__火锅')).toBe('火锅');
    expect(parseNearbyFastTextLabel('__label__不存在')).toBeUndefined();
    expect(parseNearbyFastTextLabel('火锅')).toBe('火锅');
  });
});
