(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LETS_EAT_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

  function normalizePoi(poi, index) {
    const type = String(poi.type || poi.typecode || '餐饮服务').split(';')[0].split('|')[0];
    return {
      id: poi.id || poi.uid || `poi-${index}`,
      name: poi.name || '未命名餐饮店',
      type,
      address: poi.address || poi.adname || '未提供',
      distance: poi.distance ?? null,
      hours: extractHours(poi),
      location: getLocationArray(poi.location),
      raw: poi,
    };
  }

  return { getLocationArray, extractHours, formatDistance, normalizePoi };
}));
