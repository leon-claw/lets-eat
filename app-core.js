(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LETS_EAT_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const NEARBY_SEARCH_KEYWORD = '餐饮';
  const MAX_POI_RESULTS = 200;
  const SEARCH_PAGE_SIZE = 50;
  const LIST_PAGE_SIZE = 20;

  function getLocationArray(location) {
    if (!location) return null;
    if (Array.isArray(location)) return [Number(location[0]), Number(location[1])];
    if (typeof location.getLng === 'function') return [location.getLng(), location.getLat()];
    if (location.lng !== undefined && location.lat !== undefined) return [Number(location.lng), Number(location.lat)];
    return null;
  }

  function extractHours(poi) {
    const values = [
      poi?.business?.opentime_today,
      poi?.business?.opentime_week,
      poi?.business?.opentime,
      poi?.biz_ext?.opentime_today,
      poi?.biz_ext?.opentime,
      poi?.opentime,
    ];
    const value = values.find((item) => item && String(item).trim());
    return value ? String(value).trim() : '未提供';
  }

  function formatDistance(meters) {
    if (meters === null || meters === undefined || meters === '') return '未知距离';
    const value = Number(meters);
    if (!Number.isFinite(value)) return '未知距离';
    return value < 1000 ? `${Math.round(value)} 米` : `${(value / 1000).toFixed(1)} 公里`;
  }

  function getPoiKey(poi) {
    if (poi.id) return String(poi.id);
    const location = Array.isArray(poi.location) ? poi.location.join(',') : '';
    return [poi.name || '未命名餐饮店', location, poi.address || ''].join('|');
  }

  function mergeUniquePois(current, incoming, maxCount = MAX_POI_RESULTS) {
    const result = current.slice();
    const keys = new Set(result.map(getPoiKey));
    for (const poi of incoming) {
      if (result.length >= maxCount) break;
      const key = getPoiKey(poi);
      if (keys.has(key)) continue;
      keys.add(key);
      result.push(poi);
    }
    return result;
  }

  function getLeafCategory(type) {
    const parts = String(type || '').split(';').map((part) => part.trim()).filter(Boolean);
    return parts.at(-1) || '未细分';
  }

  function aggregateCategories(places) {
    const counts = new Map();
    for (const place of places) {
      const name = getLeafCategory(place.type);
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function paginate(items, page, pageSize = LIST_PAGE_SIZE) {
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(Math.max(1, page), pageCount);
    const start = (safePage - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), page: safePage, pageCount, total: items.length };
  }

  function normalizePoi(poi, index) {
    const type = String(poi.type || poi.typecode || '餐饮服务');
    const location = getLocationArray(poi.location);
    const fallbackId = ['poi', poi.name || '未命名餐饮店', location?.join(',') || '', poi.address || ''].join('|');
    return {
      id: poi.id || poi.uid || poi.pguid || fallbackId || `poi-${index}`,
      name: poi.name || '未命名餐饮店',
      type,
      address: poi.address || poi.adname || '未提供',
      distance: poi.distance ?? null,
      hours: extractHours(poi),
      location,
      raw: poi,
    };
  }

  return {
    aggregateCategories,
    extractHours,
    formatDistance,
    getLeafCategory,
    getLocationArray,
    getPoiKey,
    mergeUniquePois,
    normalizePoi,
    paginate,
    NEARBY_SEARCH_KEYWORD,
    MAX_POI_RESULTS,
    SEARCH_PAGE_SIZE,
    LIST_PAGE_SIZE,
  };
}));
