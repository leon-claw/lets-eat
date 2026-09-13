import { describe, expect, it } from 'vitest';
import {
  buildAmapAroundUrl,
  parseAmapAroundResponse,
  searchNearbyRestaurants,
} from '../src/adapters/wx-amap';

describe('mini program amap adapter', () => {
  it('builds a direct request with the user-provided key and security code', () => {
    const url = buildAmapAroundUrl({
      key: 'user-key',
      securityJsCode: 'user-code',
      center: { longitude: 113.3, latitude: 23.1 },
      radiusMeters: 1000,
      page: 2,
    });

    expect(url).toContain('https://restapi.amap.com/v3/place/around?');
    expect(url).toContain('platform=JS');
    expect(url).toContain('s=rsv3');
    expect(url).toContain('logversion=2.0');
    expect(url).toContain('sdkversion=2.3.5.6');
    expect(url).toContain('type_=NEARBY');
    expect(url).toContain('antiCrab=true');
    expect(url).toContain('key=user-key');
    expect(url).toContain('jscode=user-code');
    expect(url).toContain('types=050000');
    expect(url).toContain('page=2');
  });

  it('parses rating, image and category fields from a highde response', () => {
    const restaurants = parseAmapAroundResponse({
      status: '1',
      pois: [{
        id: 'p1',
        name: '示例餐厅',
        type: '餐饮服务;中餐厅;广东菜(粤菜)',
        location: '113.3,23.1',
        distance: '120',
        biz_ext: { rating: '4.8' },
        photos: [{ url: 'https://example.com/food.jpg' }],
      }],
    }, '2026-09-13T00:00:00.000Z');

    expect(restaurants[0]).toMatchObject({
      id: 'p1',
      name: '示例餐厅',
      type: '餐饮服务;中餐厅;广东菜(粤菜)',
      rating: 4.8,
      imageUrl: 'https://example.com/food.jpg',
      distanceMeters: 120,
      location: { longitude: 113.3, latitude: 23.1 },
    });
    expect(restaurants[0]?.categoryPath).toEqual(['餐饮服务', '中餐厅', '广东菜(粤菜)']);
  });

  it('fetches pages, deduplicates and returns highest-rated restaurants first', async () => {
    const requests: string[] = [];
    const restaurants = await searchNearbyRestaurants({
      config: { key: 'user-key', securityJsCode: 'user-code' },
      center: { longitude: 113.3, latitude: 23.1 },
      radiusMeters: 1000,
      resultLimit: 10,
      candidateLimit: 20,
      request(options) {
        requests.push(options.url);
        options.success({
          statusCode: 200,
          data: requests.length === 1
            ? { status: '1', pois: [
              { id: 'low', name: '低分店', type: '餐饮服务;中餐厅', biz_ext: { rating: '4.0' } },
              { id: 'duplicate', name: '重复店', type: '餐饮服务;中餐厅', biz_ext: { rating: '4.2' } },
            ] }
            : requests.length === 2
              ? { status: '1', pois: [
              { id: 'high', name: '高分店', type: '餐饮服务;中餐厅', biz_ext: { rating: '4.9' } },
              { id: 'duplicate', name: '重复店', type: '餐饮服务;中餐厅', biz_ext: { rating: '4.2' } },
              ] }
              : { status: '1', pois: [] },
        });
      },
    });

    expect(requests).toHaveLength(3);
    expect(restaurants.map((restaurant) => restaurant.id)).toEqual(['high', 'duplicate', 'low']);
  });
});
