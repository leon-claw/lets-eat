(() => {
  'use strict';

  const CONFIG = window.LETS_EAT_CONFIG || {};
  const CITY_DATA = window.LETS_EAT_CITY_DATA || [];
  const CORE = window.LETS_EAT_CORE;
  const RADIUS_METERS = 2000;
  const DEFAULT_CITY = { province: '上海市', name: '上海市', center: [121.4737, 31.2304] };

  const state = {
    map: null,
    placeSearch: null,
    markers: [],
    places: [],
    selectedId: null,
    selectedProvince: DEFAULT_CITY.province,
    selectedCity: DEFAULT_CITY,
    searchCenter: DEFAULT_CITY.center.slice(),
    live: false,
    ignoreNextMove: false,
    requestId: 0,
  };

  const elements = {
    dataMode: document.querySelector('#dataMode'),
    provinceSelect: document.querySelector('#provinceSelect'),
    citySelect: document.querySelector('#citySelect'),
    citySearchButton: document.querySelector('#citySearchButton'),
    statusText: document.querySelector('#statusText'),
    cityLabel: document.querySelector('#cityLabel'),
    resultList: document.querySelector('#resultList'),
    resultCount: document.querySelector('#resultCount'),
    emptyState: document.querySelector('#emptyState'),
    map: document.querySelector('#map'),
    mapFallback: document.querySelector('#mapFallback'),
    searchHereButton: document.querySelector('#searchHereButton'),
    detailPanel: document.querySelector('#detailPanel'),
    detailType: document.querySelector('#detailType'),
    detailName: document.querySelector('#detailName'),
    detailHours: document.querySelector('#detailHours'),
    detailAddress: document.querySelector('#detailAddress'),
    detailDistance: document.querySelector('#detailDistance'),
    detailCloseButton: document.querySelector('#detailCloseButton'),
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setStatus(message, tone = 'neutral') {
    elements.statusText.textContent = message;
    elements.statusText.dataset.tone = tone;
  }

  function setMode(live) {
    state.live = live;
    elements.dataMode.textContent = live ? '高德实时数据' : '演示数据';
    elements.dataMode.classList.toggle('is-live', live);
  }

  function getProvinceRecord(provinceName) {
    return CITY_DATA.find((item) => item.province === provinceName) || null;
  }

  function getCityRecord(provinceName, cityName) {
    const province = getProvinceRecord(provinceName);
    return province?.cities.find((item) => item.name === cityName) || null;
  }

  function populateProvinces() {
    elements.provinceSelect.innerHTML = CITY_DATA
      .map((item) => `<option value="${escapeHtml(item.province)}">${escapeHtml(item.province)}</option>`)
      .join('');
    elements.provinceSelect.value = DEFAULT_CITY.province;
    populateCities(DEFAULT_CITY.province, DEFAULT_CITY.name);
  }

  function populateCities(provinceName, preferredCityName = '') {
    const province = getProvinceRecord(provinceName);
    const cities = province?.cities || [];
    elements.citySelect.innerHTML = cities
      .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
      .join('');
    elements.citySelect.disabled = cities.length === 0;
    if (cities.length) {
      elements.citySelect.value = cities.some((item) => item.name === preferredCityName)
        ? preferredCityName
        : cities[0].name;
    }
  }

  function getSelectedCity() {
    return getCityRecord(elements.provinceSelect.value, elements.citySelect.value);
  }

  function updateCityState(city) {
    if (!city) return;
    state.selectedProvince = elements.provinceSelect.value;
    state.selectedCity = city;
    state.searchCenter = city.center.slice();
    elements.cityLabel.textContent = city.name;
    closeDetail();
  }

  function cityChanged() {
    const city = getSelectedCity();
    if (!city) return;
    updateCityState(city);
    if (state.live && state.map) {
      state.ignoreNextMove = true;
      state.map.setCenter(city.center);
      state.map.setZoom(14);
    }
    searchNearby(city.center);
  }

  function clearMarkers() {
    if (!state.map || !state.markers.length) return;
    state.map.remove(state.markers);
    state.markers = [];
  }

  function renderMarkers() {
    if (!state.map || !state.live || !window.AMap) return;
    clearMarkers();
    const markers = state.places
      .filter((place) => place.location)
      .map((place, index) => {
        const marker = new window.AMap.Marker({
          position: place.location,
          offset: new window.AMap.Pixel(-14, -14),
          content: `<div class="amap-number-marker ${place.id === state.selectedId ? 'is-selected' : ''}"><span>${String(index + 1).padStart(2, '0')}</span></div>`,
          zIndex: place.id === state.selectedId ? 120 : 20,
        });
        marker.on('click', () => selectPlace(place.id));
        return marker;
      });
    state.markers = markers;
    if (markers.length) state.map.add(markers);
  }

  function renderCards() {
    const places = state.places;
    elements.resultCount.textContent = `${places.length} 家`;
    elements.emptyState.hidden = places.length > 0;
    elements.resultList.innerHTML = places.map((place, index) => `
      <button class="result-card ${place.id === state.selectedId ? 'is-selected' : ''}" data-place-id="${escapeHtml(place.id)}" type="button">
        <span class="result-index">${String(index + 1).padStart(2, '0')}</span>
        <span class="result-body">
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml(place.type)} · ${escapeHtml(place.address)}</span>
          <small>营业时间：${escapeHtml(place.hours)}</small>
        </span>
        <span class="result-distance">${escapeHtml(CORE.formatDistance(place.distance))}</span>
      </button>
    `).join('');
    elements.resultList.querySelectorAll('[data-place-id]').forEach((card) => {
      card.addEventListener('click', () => selectPlace(card.dataset.placeId));
    });
  }

  function renderResults(places) {
    state.places = places.slice().sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    state.selectedId = null;
    closeDetail();
    renderCards();
    renderMarkers();
  }

  function renderDemoMap() {
    elements.map.hidden = true;
    elements.mapFallback.hidden = false;
  }

  function hideDemoMap() {
    elements.map.hidden = false;
    elements.mapFallback.hidden = true;
  }

  function buildDemoPlaces(center) {
    const rawPlaces = [
      { id: 'demo-1', name: '演示餐馆 A', type: '中餐厅', address: '演示地址 1', distance: 320, location: [center[0] + 0.003, center[1] + 0.002], business: { opentime: '11:00-21:30' } },
      { id: 'demo-2', name: '演示餐馆 B', type: '快餐', address: '演示地址 2', distance: 780, location: [center[0] - 0.004, center[1] + 0.004], business: { opentime: '10:00-22:00' } },
      { id: 'demo-3', name: '演示餐馆 C', type: '咖啡厅', address: '演示地址 3', distance: 1450, location: [center[0] + 0.006, center[1] - 0.004] },
    ];
    return rawPlaces.map((place, index) => CORE.normalizePoi(place, index));
  }

  function renderDemo(center, message = '演示数据 · 未配置高德 Key') {
    setMode(false);
    state.places = buildDemoPlaces(center);
    state.selectedId = null;
    renderCards();
    renderDemoMap();
    elements.searchHereButton.hidden = true;
    setStatus(message, 'notice');
  }

  function showDetail(place) {
    if (!place) return;
    state.selectedId = place.id;
    elements.detailType.textContent = place.type || '餐饮服务';
    elements.detailName.textContent = place.name;
    elements.detailHours.textContent = place.hours || '未提供';
    elements.detailAddress.textContent = place.address || '未提供';
    elements.detailDistance.textContent = CORE.formatDistance(place.distance);
    elements.detailPanel.hidden = false;
    renderCards();
    renderMarkers();
  }

  function selectPlace(placeId) {
    const place = state.places.find((item) => item.id === placeId);
    if (!place) return;
    showDetail(place);
    if (state.live && state.map && place.location) {
      state.ignoreNextMove = true;
      state.map.setCenter(place.location);
      state.map.setZoom(Math.max(state.map.getZoom(), 15));
    }
  }

  function closeDetail() {
    if (!elements.detailPanel) return;
    state.selectedId = null;
    elements.detailPanel.hidden = true;
  }

  function markMapMoved() {
    if (state.ignoreNextMove) {
      state.ignoreNextMove = false;
      return;
    }
    state.searchCenter = CORE.getLocationArray(state.map.getCenter()) || state.searchCenter;
    elements.searchHereButton.hidden = false;
    setStatus('地图位置已改变，点击按钮搜索新区域', 'notice');
  }

  function searchNearby(center) {
    state.searchCenter = center.slice();
    elements.searchHereButton.hidden = true;

    if (!state.live || !state.placeSearch) {
      renderDemo(center);
      return;
    }

    const requestId = ++state.requestId;
    setStatus(`正在搜索${state.selectedCity.name}附近餐饮…`, 'loading');
    elements.resultList.innerHTML = '';
    elements.emptyState.hidden = true;

    state.placeSearch.searchNearBy('', center, RADIUS_METERS, (status, result) => {
      if (requestId !== state.requestId) return;
      if (status !== 'complete') {
        renderResults([]);
        setStatus(`高德搜索失败（${status}）：${result?.info || result?.message || '接口未返回详细原因'}`, 'error');
        return;
      }
      const pois = result?.poiList?.pois || [];
      if (!pois.length) {
        renderResults([]);
        setStatus('高德搜索完成：附近没有返回餐饮 POI', 'notice');
        return;
      }
      renderResults(pois.map((poi, index) => CORE.normalizePoi(poi, index)));
      setStatus(`高德搜索完成：返回 ${pois.length} 家餐饮`, 'success');
    });
  }

  function searchAtMapCenter() {
    if (!state.live || !state.map) return;
    const center = CORE.getLocationArray(state.map.getCenter());
    if (!center) {
      setStatus('无法读取当前地图中心，请重试', 'error');
      return;
    }
    searchNearby(center);
  }

  function initLiveMap() {
    state.map = new window.AMap.Map('map', {
      center: state.searchCenter,
      zoom: 14,
      viewMode: '2D',
      resizeEnable: true,
      zooms: [3, 20],
    });
    state.map.on('moveend', markMapMoved);
    setMode(true);
    hideDemoMap();
    window.AMap.plugin(['AMap.PlaceSearch'], () => {
      state.placeSearch = new window.AMap.PlaceSearch({
        city: '全国',
        citylimit: false,
        type: '餐饮服务',
        pageSize: 20,
        pageIndex: 1,
        extensions: 'all',
      });
      searchNearby(state.searchCenter);
    });
  }

  function hasAmapConfig() {
    return Boolean(String(CONFIG.key || '').trim());
  }

  function loadAmap() {
    if (!hasAmapConfig()) {
      renderDemo(state.searchCenter);
      return;
    }

    window._AMapSecurityConfig = { securityJsCode: CONFIG.securityJsCode || '' };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(CONFIG.key)}&plugin=AMap.PlaceSearch`;
    script.async = true;
    script.onload = initLiveMap;
    script.onerror = () => renderDemo(state.searchCenter, '高德地图加载失败 · 当前显示演示数据');
    document.head.appendChild(script);
  }

  function bindEvents() {
    elements.provinceSelect.addEventListener('change', () => {
      populateCities(elements.provinceSelect.value);
      cityChanged();
    });
    elements.citySelect.addEventListener('change', cityChanged);
    elements.citySearchButton.addEventListener('click', cityChanged);
    elements.searchHereButton.addEventListener('click', searchAtMapCenter);
    elements.detailCloseButton.addEventListener('click', closeDetail);
  }

  function boot() {
    populateProvinces();
    bindEvents();
    loadAmap();
  }

  boot();
})();
