import { describe, expect, it, vi } from 'vitest';
import type { AmapNamespace } from './amap-types';
import type { AmapConfig, GeoPoint } from './types';
import { AmapSearchError, normalizeAmapPoi, searchNearbyRestaurants } from './amap-client';

const config: AmapConfig = { key: 'amap-key', securityJsCode: 'security-code' };
const center: GeoPoint = { longitude: 116.397, latitude: 39.908 };

function placeSearchSdk(status: string, result: unknown) {
  const options: unknown[] = [];
  const searchNearBy = vi.fn((
    _keyword: string,
    _center: [number, number],
    _radiusMeters: number,
    callback: (searchStatus: string, searchResult: unknown) => void,
  ) => callback(status, result));
  class PlaceSearch {
    constructor(value: unknown) {
      options.push(value);
    }

    searchNearBy = searchNearBy;
  }
  const plugin = vi.fn((_name: string, callback: () => void) => callback());
  const amap = { PlaceSearch, plugin } as unknown as AmapNamespace;
  return { amap, options, plugin, searchNearBy };
}

describe('Amap nearby search client', () => {
  it('通过 JS API PlaceSearch 请求餐饮类型、指定半径和第一页 20 条结果', async () => {
    const sdk = placeSearchSdk('complete', { poiList: { pois: [] } });
    const loadAmap = vi.fn().mockResolvedValue(sdk.amap);
    const restaurants = await searchNearbyRestaurants({
      config,
      center,
      radiusMeters: 2000,
      loadAmap,
    });

    expect(loadAmap).toHaveBeenCalledWith(config);
    expect(sdk.plugin).toHaveBeenCalledWith('AMap.PlaceSearch', expect.any(Function));
    expect(sdk.options).toEqual([{
      type: '050000',
      pageSize: 20,
      pageIndex: 1,
      extensions: 'all',
    }]);
    expect(sdk.searchNearBy).toHaveBeenCalledWith('', [116.397, 39.908], 2000, expect.any(Function));
    expect(restaurants).toEqual([]);
  });

  it('把高德 location 的经纬度转为数字', () => {
    const restaurant = normalizeAmapPoi({
      id: 'B001',
      name: '一间餐厅',
      type: '餐饮服务;中餐厅;粤菜馆',
      location: '116.397,39.908',
      entr_location: '116.398,39.909',
      distance: '120',
    }, '2026-08-31T00:00:00.000Z');

    expect(restaurant.location).toEqual({ longitude: 116.397, latitude: 39.908 });
    expect(restaurant.entranceLocation).toEqual({ longitude: 116.398, latitude: 39.909 });
    expect(restaurant.distanceMeters).toBe(120);
  });

  it('把 JS API 的 LngLat 对象转为数字', () => {
    const restaurant = normalizeAmapPoi({
      id: 'B001',
      name: '一间餐厅',
      type: '餐饮服务;中餐厅;粤菜馆',
      location: { lng: 116.397, lat: 39.908 },
      distance: 120,
    }, '2026-08-31T00:00:00.000Z');

    expect(restaurant.location).toEqual({ longitude: 116.397, latitude: 39.908 });
    expect(restaurant.distanceMeters).toBe(120);
  });

  it('保留 name、type、typecode、address、distance、行政区划和 providerData', () => {
    const poi = {
      id: 'B001',
      name: '一间餐厅',
      type: '餐饮服务;中餐厅;粤菜馆',
      typecode: '050102',
      address: '北京市东城区某路 1 号',
      location: '116.397,39.908',
      distance: '120',
      pname: '北京市',
      pcode: '110000',
      cityname: '北京市',
      citycode: '010',
      adname: '东城区',
      adcode: '110101',
      business_area: '王府井',
      tel: '010-12345678',
      business_time: '09:00-22:00',
    };

    const restaurant = normalizeAmapPoi(poi, '2026-08-31T00:00:00.000Z');

    expect(restaurant).toMatchObject({
      source: 'amap',
      id: 'B001',
      name: '一间餐厅',
      type: '餐饮服务;中餐厅;粤菜馆',
      typeCode: '050102',
      categoryPath: ['餐饮服务', '中餐厅', '粤菜馆'],
      address: '北京市东城区某路 1 号',
      distanceMeters: 120,
      province: '北京市',
      provinceCode: '110000',
      city: '北京市',
      cityCode: '010',
      district: '东城区',
      districtCode: '110101',
      businessArea: '王府井',
      telephone: '010-12345678',
      businessHours: '09:00-22:00',
      fetchedAt: '2026-08-31T00:00:00.000Z',
      providerData: poi,
    });
  });

  it('高德 JS API 返回错误时保留 detail 与 info 作为错误原因', async () => {
    const invalidKeySdk = placeSearchSdk('error', { info: 'INVALID_USER_KEY', infocode: '10001', detail: 'key expired' });
    await expect(searchNearbyRestaurants({
      config,
      center,
      radiusMeters: 500,
      loadAmap: vi.fn().mockResolvedValue(invalidKeySdk.amap),
    })).rejects.toMatchObject({ code: 'INVALID_CONFIG', message: expect.stringContaining('key expired') });
    const unavailableSdk = placeSearchSdk('error', { info: 'SERVICE_NOT_AVAILABLE', detail: 'service unavailable' });
    await expect(searchNearbyRestaurants({
      config,
      center,
      radiusMeters: 500,
      loadAmap: vi.fn().mockResolvedValue(unavailableSdk.amap),
    })).rejects.toSatisfy((error: unknown) => error instanceof AmapSearchError
      && error.code === 'REQUEST_FAILED'
      && error.message.includes('service unavailable')
      && error.message.includes('SERVICE_NOT_AVAILABLE'));
  });

  it('高德 JS API 返回 no_data 时返回空数组', async () => {
    const sdk = placeSearchSdk('no_data', 'NO_DATA');
    await expect(searchNearbyRestaurants({
      config,
      center,
      radiusMeters: 500,
      loadAmap: vi.fn().mockResolvedValue(sdk.amap),
    })).resolves.toEqual([]);
  });
});
