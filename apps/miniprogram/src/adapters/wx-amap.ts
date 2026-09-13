import type {
  MiniAmapConfig,
  MiniGeoPoint,
  MiniNearbyRestaurant,
  MiniNearbyResultLimit,
} from '../features/nearby-food/types';

export type AmapSearchErrorCode = 'INVALID_CONFIG' | 'REQUEST_FAILED' | 'NO_RESULTS' | 'INVALID_RESPONSE';

export class AmapSearchError extends Error {
  readonly code: AmapSearchErrorCode;

  constructor(code: AmapSearchErrorCode, message: string) {
    super(message);
    this.name = 'AmapSearchError';
    this.code = code;
  }
}

interface AmapRequestResponse {
  statusCode: number;
  data: unknown;
}

interface AmapRequestOptions {
  url: string;
  success(response: AmapRequestResponse): void;
  fail(error: { errMsg?: string }): void;
}

export type AmapRequest = (options: AmapRequestOptions) => void;

type AmapRecord = Record<string, unknown>;

const AMAP_AROUND_SEARCH_URL = 'https://restapi.amap.com/v3/place/around';
const AMAP_JS_SDK_VERSION = '2.3.5.6';
const PAGE_SIZE = 50;
const MAX_CANDIDATE_PAGES = 4;
const DEFAULT_RESULT_LIMIT: MiniNearbyResultLimit = 20;

function asRecord(value: unknown): AmapRecord | null {
  return typeof value === 'object' && value !== null ? value as AmapRecord : null;
}

function optionalString(record: AmapRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePoint(value: unknown): MiniGeoPoint | undefined {
  const record = asRecord(value);
  const parts = typeof value === 'string'
    ? value.split(',').map((part) => part.trim())
    : record ? [record.lng, record.lat] : [];
  const longitude = parseNumber(parts[0]);
  const latitude = parseNumber(parts[1]);
  return longitude !== undefined && latitude !== undefined ? { longitude, latitude } : undefined;
}

function parseRating(value: unknown): number | undefined {
  const rating = parseNumber(value);
  return rating !== undefined && rating > 0 && rating <= 5 ? rating : undefined;
}

function parseHttpUrl(value: unknown): string | undefined {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined;
}

function readRating(record: AmapRecord): number | undefined {
  const candidates = [record.rating, asRecord(record.biz_ext)?.rating, asRecord(record.dining)?.rating];
  for (const candidate of candidates) {
    const rating = parseRating(candidate);
    if (rating !== undefined) return rating;
  }
  return undefined;
}

function readImageUrl(record: AmapRecord): string | undefined {
  for (const value of [record.photos, asRecord(record.dining)?.photos, asRecord(record.biz_ext)?.photos]) {
    if (!Array.isArray(value)) continue;
    for (const photo of value) {
      const photoRecord = asRecord(photo);
      const url = parseHttpUrl(typeof photo === 'string' ? photo : photoRecord?.url ?? photoRecord?.src ?? photoRecord?.imageUrl);
      if (url) return url;
    }
  }
  return undefined;
}

function readErrorMessage(record: AmapRecord): string {
  const info = optionalString(record, 'info') ?? '高德接口返回失败';
  const detail = optionalString(record, 'detail');
  const infocode = optionalString(record, 'infocode');
  return [info, detail, infocode ? `错误码 ${infocode}` : undefined].filter(Boolean).join('：');
}

function errorCode(record: AmapRecord): AmapSearchErrorCode {
  const detail = `${record.info ?? ''} ${record.detail ?? ''} ${record.infocode ?? ''}`;
  return /KEY|USER|SECURITY|DOMAIN/i.test(detail) ? 'INVALID_CONFIG' : 'REQUEST_FAILED';
}

export function buildAmapAroundUrl(input: {
  key: string;
  securityJsCode: string;
  center: MiniGeoPoint;
  radiusMeters: number;
  page: number;
}): string {
  const params: Record<string, string> = {
    platform: 'JS',
    s: 'rsv3',
    logversion: '2.0',
    key: input.key,
    jscode: input.securityJsCode,
    sdkversion: AMAP_JS_SDK_VERSION,
    location: `${input.center.longitude},${input.center.latitude}`,
    types: '050000',
    radius: String(Math.round(input.radiusMeters)),
    offset: String(PAGE_SIZE),
    page: String(input.page),
    extensions: 'all',
    language: 'zh_cn',
    sortrule: 'distance',
    type_: 'NEARBY',
    antiCrab: 'true',
  };
  return `${AMAP_AROUND_SEARCH_URL}?${Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')}`;
}

export function parseAmapAroundResponse(value: unknown, fetchedAt: string): MiniNearbyRestaurant[] {
  const body = asRecord(value);
  if (!body || body.status !== '1' || !Array.isArray(body.pois)) {
    throw new AmapSearchError(body ? errorCode(body) : 'INVALID_RESPONSE', body ? readErrorMessage(body) : '高德返回数据无效');
  }

  return body.pois.reduce<MiniNearbyRestaurant[]>((results, poi: unknown) => {
    const record = asRecord(poi);
    const id = record && optionalString(record, 'id');
    const name = record && optionalString(record, 'name');
    if (!record || !id || !name) return results;

    const type = optionalString(record, 'type') ?? '';
    const result: MiniNearbyRestaurant = {
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
    const distanceMeters = parseNumber(record.distance);
    const rating = readRating(record);
    const imageUrl = readImageUrl(record);
    if (typeCode) result.typeCode = typeCode;
    if (location) result.location = location;
    if (entranceLocation) result.entranceLocation = entranceLocation;
    if (distanceMeters !== undefined && distanceMeters >= 0) result.distanceMeters = distanceMeters;
    if (rating !== undefined) result.rating = rating;
    if (imageUrl) result.imageUrl = imageUrl;

    const fields: Array<[keyof MiniNearbyRestaurant, string]> = [
      ['address', 'address'], ['province', 'pname'], ['provinceCode', 'pcode'], ['city', 'cityname'],
      ['cityCode', 'citycode'], ['district', 'adname'], ['districtCode', 'adcode'], ['businessArea', 'business_area'],
      ['telephone', 'tel'], ['website', 'website'], ['email', 'email'], ['businessHours', 'business_time'],
      ['businessStatus', 'business_status'],
    ];
    for (const [target, source] of fields) {
      const field = optionalString(record, source);
      if (field) (result as unknown as Record<string, unknown>)[target] = field;
    }
    results.push(result);
    return results;
  }, []);
}

function requestWithWx(options: AmapRequestOptions): void {
  wx.request({
    url: options.url,
    method: 'GET',
    success: (response) => options.success({ statusCode: response.statusCode, data: response.data }),
    fail: (error) => options.fail({ errMsg: error.errMsg }),
  });
}

function requestPage(request: AmapRequest, url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    request({
      url,
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new AmapSearchError('REQUEST_FAILED', `高德请求失败（HTTP ${response.statusCode}）`));
          return;
        }
        resolve(response.data);
      },
      fail(error) {
        reject(new AmapSearchError('REQUEST_FAILED', error.errMsg ?? '高德请求失败，请检查网络和合法域名配置'));
      },
    });
  });
}

export async function searchNearbyRestaurants(input: {
  config: MiniAmapConfig;
  center: MiniGeoPoint;
  radiusMeters: number;
  resultLimit?: MiniNearbyResultLimit;
  candidateLimit?: number;
  request?: AmapRequest;
  now?: () => string;
}): Promise<MiniNearbyRestaurant[]> {
  const resultLimit = input.resultLimit ?? DEFAULT_RESULT_LIMIT;
  const candidateLimit = input.candidateLimit ?? 200;
  if (!input.config.key.trim() || !input.config.securityJsCode.trim()) {
    throw new AmapSearchError('INVALID_CONFIG', '高德 Key 或 securityJsCode 未配置');
  }
  if (![10, 20, 30].includes(resultLimit) || !Number.isInteger(candidateLimit) || candidateLimit < resultLimit || candidateLimit > PAGE_SIZE * MAX_CANDIDATE_PAGES) {
    throw new AmapSearchError('INVALID_CONFIG', '附近餐厅数量配置无效');
  }
  if (!Number.isFinite(input.center.longitude) || !Number.isFinite(input.center.latitude) || !Number.isFinite(input.radiusMeters) || input.radiusMeters <= 0) {
    throw new AmapSearchError('INVALID_CONFIG', '附近搜索参数无效');
  }

  const request = input.request ?? requestWithWx;
  const fetchedAt = (input.now ?? (() => new Date().toISOString()))();
  const candidates: MiniNearbyRestaurant[] = [];
  for (let page = 1; page <= MAX_CANDIDATE_PAGES; page += 1) {
    const response = await requestPage(request, buildAmapAroundUrl({
      key: input.config.key,
      securityJsCode: input.config.securityJsCode,
      center: input.center,
      radiusMeters: input.radiusMeters,
      page,
    }));
    const pageRestaurants = parseAmapAroundResponse(response, fetchedAt);
    candidates.push(...pageRestaurants);
    if (pageRestaurants.length === 0 || (pageRestaurants.length < PAGE_SIZE && candidates.length >= candidateLimit)) break;
  }

  const unique = Array.from(new Map(candidates.map((restaurant) => [restaurant.id, restaurant])).values());
  return unique
    .filter((restaurant) => restaurant.rating !== undefined)
    .map((restaurant, index) => ({ restaurant, index }))
    .sort((left, right) => (right.restaurant.rating! - left.restaurant.rating!) || (left.index - right.index))
    .slice(0, candidateLimit)
    .map(({ restaurant }) => restaurant);
}
