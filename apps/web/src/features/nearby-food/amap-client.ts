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

type AmapFetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type AmapRecord = Record<string, unknown>;

function asRecord(value: unknown): AmapRecord | null {
  return typeof value === 'object' && value !== null ? value as AmapRecord : null;
}

function optionalString(record: AmapRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePoint(value: unknown): GeoPoint | undefined {
  if (typeof value !== 'string') return undefined;
  const [longitudeText, latitudeText] = value.split(',').map((part) => part.trim());
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
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
  fetcher?: AmapFetcher;
  now?: () => string;
}): Promise<NearbyRestaurant[]> {
  const { config, center, radiusMeters } = input;
  if (!config.key.trim()) throw new AmapSearchError('INVALID_CONFIG', '高德 Key 未配置');
  if (!Number.isFinite(center.longitude) || !Number.isFinite(center.latitude) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new AmapSearchError('INVALID_CONFIG', '附近搜索参数无效');
  }

  const params = new URLSearchParams({
    key: config.key,
    location: `${center.longitude},${center.latitude}`,
    types: '050000',
    radius: String(radiusMeters),
    sortrule: 'weight',
    offset: '20',
    page: '1',
    extensions: 'all',
  });
  const url = `https://restapi.amap.com/v3/place/around?${params.toString()}`;
  const fetcher = input.fetcher ?? globalThis.fetch.bind(globalThis);
  let response: Response;
  try {
    response = await fetcher(url);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '网络请求失败';
    throw new AmapSearchError('REQUEST_FAILED', `附近餐厅搜索失败：${message}`);
  }
  if (!response.ok) {
    throw new AmapSearchError('REQUEST_FAILED', `附近餐厅搜索失败：HTTP ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AmapSearchError('INVALID_RESPONSE', '高德返回的数据无法解析');
  }
  const record = asRecord(body);
  if (!record || String(record.status) !== '1') {
    throw new AmapSearchError(record ? classifyAmapError(record) : 'INVALID_RESPONSE', record ? amapErrorReason(record) : '高德返回的数据格式无效');
  }
  if (!Array.isArray(record.pois)) {
    throw new AmapSearchError('INVALID_RESPONSE', '高德返回的数据缺少餐厅列表');
  }
  const fetchedAt = (input.now ?? (() => new Date().toISOString()))();
  return record.pois.slice(0, 20).map((poi) => normalizeAmapPoi(poi, fetchedAt));
}
