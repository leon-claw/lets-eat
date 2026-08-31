import type { GeoPoint } from './types';

export interface CityCenter {
  name: string;
  center: GeoPoint;
}

export interface ProvinceCenter {
  province: string;
  cities: CityCenter[];
}

export const CITY_CENTERS: ProvinceCenter[] = [
  { province: '北京市', cities: [{ name: '北京市', center: { longitude: 116.4074, latitude: 39.9042 } }] },
  { province: '上海市', cities: [{ name: '上海市', center: { longitude: 121.4737, latitude: 31.2304 } }] },
  {
    province: '广东省',
    cities: [
      { name: '广州市', center: { longitude: 113.2644, latitude: 23.1291 } },
      { name: '深圳市', center: { longitude: 114.0579, latitude: 22.5431 } },
    ],
  },
  { province: '浙江省', cities: [{ name: '杭州市', center: { longitude: 120.1551, latitude: 30.2741 } }] },
  { province: '四川省', cities: [{ name: '成都市', center: { longitude: 104.0665, latitude: 30.5723 } }] },
  { province: '湖北省', cities: [{ name: '武汉市', center: { longitude: 114.3055, latitude: 30.5928 } }] },
  { province: '江苏省', cities: [{ name: '南京市', center: { longitude: 118.7969, latitude: 32.0603 } }] },
  { province: '陕西省', cities: [{ name: '西安市', center: { longitude: 108.9398, latitude: 34.3416 } }] },
];

export function getCitiesForProvince(province: string): CityCenter[] {
  return CITY_CENTERS.find((item) => item.province === province)?.cities ?? [];
}
