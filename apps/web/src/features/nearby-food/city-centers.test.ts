import { describe, expect, it } from 'vitest';
import { CITY_CENTERS, getCitiesForProvince } from './city-centers';

describe('nearby city centers', () => {
  it('包含旧地图 MVP 所需的省市中心', () => {
    expect(CITY_CENTERS.map((item) => item.province)).toEqual(expect.arrayContaining(['北京市', '上海市', '广东省', '浙江省', '四川省', '湖北省', '江苏省', '陕西省']));
    expect(getCitiesForProvince('广东省')).toEqual(expect.arrayContaining([
      { name: '广州市', center: { longitude: 113.2644, latitude: 23.1291 } },
      { name: '深圳市', center: { longitude: 114.0579, latitude: 22.5431 } },
    ]));
  });

  it('未知省份没有城市选项', () => {
    expect(getCitiesForProvince('不存在的省')).toEqual([]);
  });
});
