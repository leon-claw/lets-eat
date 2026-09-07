import { loadAmap as loadAmapSdk } from './amap-map';
import type { AmapNamespace, AmapPlaceSearchInstance } from './amap-types';
import type { AmapConfig, GeoPoint, NearbyRestaurant, NearbyResultLimit } from './types';

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

const DEFAULT_NEARBY_RESULT_LIMIT: NearbyResultLimit = 20;
const CANDIDATE_PAGE_SIZE = 50;
const MAX_CANDIDATE_PAGES = 4;

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

function parseRating(value: unknown): number | undefined {
  const rating = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : undefined;
}

function optionalHttpUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined;
}

function readAmapRating(record: AmapRecord): number | undefined {
  const candidates = [
    record.rating,
    asRecord(record.dining)?.rating,
    asRecord(record.biz_ext)?.rating,
  ];
  for (const candidate of candidates) {
    const rating = parseRating(candidate);
    if (rating !== undefined) return rating;
  }
  return undefined;
}

function readAmapImageUrl(record: AmapRecord): string | undefined {
  const photoLists = [
    asRecord(record.dining)?.photos,
    record.photos,
    asRecord(record.biz_ext)?.photos,
  ];
  for (const photos of photoLists) {
    if (!Array.isArray(photos)) continue;
    for (const photo of photos) {
      const photoRecord = asRecord(photo);
      const imageUrl = optionalHttpUrl(typeof photo === 'string'
        ? photo
        : photoRecord?.url ?? photoRecord?.src ?? photoRecord?.imageUrl);
      if (imageUrl) return imageUrl;
    }
  }
  return undefined;
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
  const rating = readAmapRating(record);
  const imageUrl = readAmapImageUrl(record);
  if (typeCode) result.typeCode = typeCode;
  if (location) result.location = location;
  if (entranceLocation) result.entranceLocation = entranceLocation;
  if (distanceMeters !== undefined) result.distanceMeters = distanceMeters;
  if (rating !== undefined) result.rating = rating;
  if (imageUrl) result.imageUrl = imageUrl;

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

function searchAmapPage(input: {
  PlaceSearch: new (options: {
    type: string;
    pageSize: number;
    pageIndex: number;
    extensions: 'all';
  }) => AmapPlaceSearchInstance;
  center: GeoPoint;
  radiusMeters: number;
  pageIndex: number;
  fetchedAt: string;
}): Promise<NearbyRestaurant[] | null> {
  const placeSearch = new input.PlaceSearch({
    type: '050000',
    pageSize: CANDIDATE_PAGE_SIZE,
    pageIndex: input.pageIndex,
    extensions: 'all',
  });

  return new Promise((resolve, reject) => {
    try {
      placeSearch.searchNearBy('', [input.center.longitude, input.center.latitude], input.radiusMeters, (status, result) => {
        if (status === 'no_data') {
          resolve(null);
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
          resolve(poiList.pois.map((poi) => normalizeAmapPoi(poi, input.fetchedAt)));
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

export async function searchNearbyRestaurants(input: {
  config: AmapConfig;
  center: GeoPoint;
  radiusMeters: number;
  resultLimit?: NearbyResultLimit;
  loadAmap?: (config: AmapConfig) => Promise<AmapNamespace>;
  now?: () => string;
}): Promise<NearbyRestaurant[]> {
  const { config, center, radiusMeters, resultLimit = DEFAULT_NEARBY_RESULT_LIMIT } = input;
  if (!config.key.trim() || !config.securityJsCode.trim()) {
    throw new AmapSearchError('INVALID_CONFIG', '高德 Key 或 securityJsCode 未配置');
  }
  if (![10, 20, 30].includes(resultLimit)) {
    throw new AmapSearchError('INVALID_CONFIG', '附近餐厅数量无效');
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
  const candidates: NearbyRestaurant[] = [];
  for (let pageIndex = 1; pageIndex <= MAX_CANDIDATE_PAGES; pageIndex += 1) {
    const page = await searchAmapPage({ PlaceSearch, center, radiusMeters, pageIndex, fetchedAt });
    if (!page) break;
    candidates.push(...page);
    if (page.length < CANDIDATE_PAGE_SIZE) break;
  }

  const uniqueCandidates = Array.from(new Map(candidates.map((restaurant) => [restaurant.id, restaurant])).values());
  return uniqueCandidates
    .map((restaurant, index) => ({ restaurant, index }))
    .filter(({ restaurant }) => restaurant.rating !== undefined)
    .sort((left, right) => (right.restaurant.rating! - left.restaurant.rating!) || (left.index - right.index))
    .slice(0, resultLimit)
    .map(({ restaurant }) => restaurant);
}
