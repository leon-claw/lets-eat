import { loadAmap as loadAmapSdk } from './amap-map';
import type { AmapNamespace, AmapPlaceSearchInstance } from './amap-types';
import type { AmapConfig, GeoPoint, NearbyRestaurant } from './types';

export type AmapSearchErrorCode = 'INVALID_CONFIG' | 'REQUEST_FAILED' | 'NO_RESULTS' | 'INVALID_RESPONSE';

export class AmapSearchError extends Error {
  readonly code: AmapSearchErrorCode;

  constructor(code: AmapSearchErrorCode, message: string) {
    super(message);
    this.name = 'AmapSearchError';
    this.code = code;
  }
}

type AmapRecord = Record<string, unknown>;

function asRecord(value: unknown): AmapRecord | null {
  return typeof value === 'object' && value !== null ? value as AmapRecord : null;
}

function optionalString(record: AmapRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePoint(value: unknown): GeoPoint | undefined {
  const record = asRecord(value);
  const parts = typeof value === 'string'
    ? value.split(',').map((part) => part.trim())
    : record
      ? [record.lng, record.lat]
      : [];
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return undefined;
  return { longitude, latitude };
}

function parseDistance(value: unknown): number | undefined {
  const distance = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(distance) && distance >= 0 ? distance : undefined;
}

function classifyAmapError(body: AmapRecord): AmapSearchErrorCode {
  const info = String(body.info ?? '');
  const detail = String(body.detail ?? '');
  const infocode = String(body.infocode ?? '');
  return infocode.startsWith('100') || /KEY|USER|SECURITY/i.test(`${info} ${detail}`)
    ? 'INVALID_CONFIG'
    : 'REQUEST_FAILED';
}

function amapErrorReason(body: AmapRecord): string {
  const info = optionalString(body, 'info') ?? '高德接口返回失败';
  const detail = optionalString(body, 'detail');
  const infocode = optionalString(body, 'infocode');
  return [info, detail, infocode ? `错误码 ${infocode}` : undefined].filter(Boolean).join('：');
}

function placeSearchError(result: unknown): AmapSearchError {
  const record = asRecord(result) ?? { info: typeof result === 'string' ? result : '高德地点搜索失败' };
  return new AmapSearchError(classifyAmapError(record), amapErrorReason(record));
}

function loadPlaceSearch(amap: AmapNamespace): Promise<new (options: {
  type: string;
  pageSize: number;
  pageIndex: number;
  extensions: 'all';
}) => AmapPlaceSearchInstance> {
  return new Promise((resolve, reject) => {
    try {
      amap.plugin('AMap.PlaceSearch', () => {
        if (!amap.PlaceSearch) {
          reject(new AmapSearchError('INVALID_RESPONSE', '高德地点搜索插件加载失败'));
          return;
        }
        resolve(amap.PlaceSearch);
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '高德地点搜索插件加载失败';
      reject(new AmapSearchError('REQUEST_FAILED', message));
    }
  });
}

export function normalizeAmapPoi(poi: unknown, fetchedAt: string): NearbyRestaurant {
  const record = asRecord(poi);
  const id = record && optionalString(record, 'id');
  const name = record && optionalString(record, 'name');
  if (!record || !id || !name) {
    throw new AmapSearchError('INVALID_RESPONSE', '高德餐厅结果缺少必要字段');
  }

  const type = typeof record.type === 'string' ? record.type : '';
  const result: NearbyRestaurant = {
    source: 'amap',
    id,
    name,
    type,
    categoryPath: type.split(';').map((item) => item.trim()).filter(Boolean),
    fetchedAt,
    providerData: poi,
  };

  const typeCode = optionalString(record, 'typecode');
  const location = parsePoint(record.location);
  const entranceLocation = parsePoint(record.entr_location);
  const distanceMeters = parseDistance(record.distance);
  if (typeCode) result.typeCode = typeCode;
  if (location) result.location = location;
  if (entranceLocation) result.entranceLocation = entranceLocation;
  if (distanceMeters !== undefined) result.distanceMeters = distanceMeters;

  type StringField = 'address' | 'province' | 'provinceCode' | 'city' | 'cityCode' | 'district' | 'districtCode' | 'businessArea' | 'telephone' | 'website' | 'email' | 'businessHours' | 'businessStatus';
  const fields: Array<[StringField, string]> = [
    ['address', 'address'],
    ['province', 'pname'],
    ['provinceCode', 'pcode'],
    ['city', 'cityname'],
    ['cityCode', 'citycode'],
    ['district', 'adname'],
    ['districtCode', 'adcode'],
    ['businessArea', 'business_area'],
    ['telephone', 'tel'],
    ['website', 'website'],
    ['email', 'email'],
    ['businessHours', 'business_time'],
    ['businessStatus', 'business_status'],
  ];
  for (const [target, source] of fields) {
    const value = optionalString(record, source);
    if (value) result[target] = value;
  }
  return result;
}

export async function searchNearbyRestaurants(input: {
  config: AmapConfig;
  center: GeoPoint;
  radiusMeters: number;
  loadAmap?: (config: AmapConfig) => Promise<AmapNamespace>;
  now?: () => string;
}): Promise<NearbyRestaurant[]> {
  const { config, center, radiusMeters } = input;
  if (!config.key.trim() || !config.securityJsCode.trim()) {
    throw new AmapSearchError('INVALID_CONFIG', '高德 Key 或 securityJsCode 未配置');
  }
  if (!Number.isFinite(center.longitude) || !Number.isFinite(center.latitude) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new AmapSearchError('INVALID_CONFIG', '附近搜索参数无效');
  }

  let amap: AmapNamespace;
  try {
    amap = await (input.loadAmap ?? loadAmapSdk)(config);
  } catch (cause) {
    if (cause instanceof AmapSearchError) throw cause;
    const message = cause instanceof Error ? cause.message : '高德地图服务加载失败';
    throw new AmapSearchError('REQUEST_FAILED', `附近餐厅搜索失败：${message}`);
  }
  const PlaceSearch = await loadPlaceSearch(amap);
  const fetchedAt = (input.now ?? (() => new Date().toISOString()))();
  const placeSearch = new PlaceSearch({
    type: '050000',
    pageSize: 20,
    pageIndex: 1,
    extensions: 'all',
  });

  return new Promise((resolve, reject) => {
    try {
      placeSearch.searchNearBy('', [center.longitude, center.latitude], radiusMeters, (status, result) => {
        if (status === 'no_data') {
          resolve([]);
          return;
        }
        if (status !== 'complete') {
          reject(placeSearchError(result));
          return;
        }
        const record = asRecord(result);
        const poiList = record && asRecord(record.poiList);
        if (!poiList || !Array.isArray(poiList.pois)) {
          reject(new AmapSearchError('INVALID_RESPONSE', '高德返回的数据缺少餐厅列表'));
          return;
        }
        try {
          resolve(poiList.pois.slice(0, 20).map((poi) => normalizeAmapPoi(poi, fetchedAt)));
        } catch (cause) {
          reject(cause);
        }
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '高德地点搜索请求失败';
      reject(new AmapSearchError('REQUEST_FAILED', `附近餐厅搜索失败：${message}`));
    }
  });
}
