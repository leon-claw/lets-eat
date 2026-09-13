import {
  loadCatalog,
  type CatalogSelection,
} from '../../adapters/wx-catalog';
import { hydrateCatalogSelectionImages } from '../../adapters/wx-image-cache';
import {
  AmapSearchError,
  searchNearbyRestaurants,
} from '../../adapters/wx-amap';
import {
  readAmapConfig,
  readNearbyLocation,
  readNearbySearchSession,
  saveNearbyLocation,
  saveNearbySearchSession,
  saveStoredNearbyRound,
} from '../../adapters/wx-nearby-storage';
import { API_BASE_URL } from '../../config/runtime';
import { BUILD_LABEL } from '../../config/build-info';
import {
  aggregateNearbyRestaurantsToFoodChoices,
  classifyMiniNearbyRestaurants,
} from '../../features/nearby-food/nearby-food-adapter';
import type {
  MiniGeoPoint,
  MiniNearbyRestaurant,
  MiniNearbyResultLimit,
} from '../../features/nearby-food/types';
import { createShareConfig } from '../../shared/share-config';

type NearbyPageStatus = 'loading' | 'locating' | 'searching' | 'ready' | 'empty' | 'insufficient' | 'error';

interface NearbyPageData {
  buildLabel: string;
  status: NearbyPageStatus;
  locationLabel: string;
  radiusLabels: string[];
  radiusIndex: number;
  resultLimitOptions: number[];
  resultLimitIndex: number;
  restaurants: MiniNearbyRestaurant[];
  candidateCount: number;
  resultLimit: MiniNearbyResultLimit;
  hasLocation: boolean;
  hasPendingSearchChange: boolean;
  isStarting: boolean;
  errorMessage: string;
  configMissing: boolean;
  locationPermissionDenied: boolean;
}

interface NearbyPageMethods {
  onLoad(): void;
  onShow(): void;
  onRadiusChange(event: PickerEvent): void;
  onResultLimitChange(event: PickerEvent): void;
  onChooseLocation(): void;
  onLocateTap(): void;
  onSearchTap(): void;
  searchAt(center: MiniGeoPoint): Promise<void>;
  onStartGame(): void;
  onSettings(): void;
  onOpenLocationSettings(): void;
  onExit(): void;
  locateAndSearch(): void;
  loadSavedSession(): void;
  showLocationError(error: { errMsg?: string }, action: string): void;
}

interface PickerEvent {
  detail: { value: string };
}

const RADIUS_OPTIONS = [500, 1000, 2000, 3000, 5000];
const RESULT_LIMIT_OPTIONS: MiniNearbyResultLimit[] = [10, 20, 30];
let pageSessionId = 0;
let searchToken = 0;
let hasStarted = false;

Page<NearbyPageData, NearbyPageMethods>({
  ...createShareConfig(),

  data: {
    buildLabel: BUILD_LABEL,
    status: 'loading',
    locationLabel: '',
    radiusLabels: RADIUS_OPTIONS.map(formatRadius),
    radiusIndex: 1,
    resultLimitOptions: RESULT_LIMIT_OPTIONS,
    resultLimitIndex: 1,
    restaurants: [],
    candidateCount: 0,
    resultLimit: 20,
    hasLocation: false,
    hasPendingSearchChange: false,
    isStarting: false,
    errorMessage: '',
    configMissing: false,
    locationPermissionDenied: false,
  },

  onLoad() {
    pageSessionId += 1;
    searchToken += 1;
    hasStarted = false;
    this.setData({
      status: 'loading',
      restaurants: [],
      candidateCount: 0,
      hasLocation: false,
      hasPendingSearchChange: false,
      isStarting: false,
      errorMessage: '',
      configMissing: false,
      locationPermissionDenied: false,
    });
    if (!readAmapConfig()) {
      this.setData({ status: 'error', configMissing: true, errorMessage: '请先在设置页填写你自己的高德 Key 和 securityJsCode' });
      wx.navigateTo({ url: '/pages/settings/index?return=nearby' });
      return;
    }
    this.loadSavedSession();
  },

  onShow() {
    if (!hasStarted && readAmapConfig() && this.data.status === 'loading') this.loadSavedSession();
  },

  onRadiusChange(event) {
    const nextIndex = Number(event.detail.value);
    if (!Number.isInteger(nextIndex) || !RADIUS_OPTIONS[nextIndex]) return;
    this.setData({ radiusIndex: nextIndex, hasPendingSearchChange: true });
  },

  onResultLimitChange(event) {
    const nextIndex = Number(event.detail.value);
    if (!Number.isInteger(nextIndex) || RESULT_LIMIT_OPTIONS[nextIndex] === undefined) return;
    this.setData({
      resultLimitIndex: nextIndex,
      resultLimit: RESULT_LIMIT_OPTIONS[nextIndex],
      hasPendingSearchChange: true,
    });
  },

  onChooseLocation() {
    wx.chooseLocation({
      success: (result) => {
        const center = { longitude: result.longitude, latitude: result.latitude };
        saveNearbyLocation(center);
        this.setData({ locationLabel: result.name || result.address || formatPoint(center), hasLocation: true });
        void this.searchAt(center);
      },
      fail: (error) => {
        // 用户取消选择时保持当前页面和已有结果；其他失败必须给出可操作的反馈。
        if (error.errMsg?.includes(':cancel')) return;
        this.showLocationError(error, '手动选择位置');
      },
    });
  },

  onLocateTap() {
    this.locateAndSearch();
  },

  onSearchTap() {
    const cached = readNearbyLocation();
    if (!cached || !this.data.hasLocation) return;
    void this.searchAt(cached);
  },

  onStartGame() {
    if (this.data.candidateCount < 3 || this.data.hasPendingSearchChange || this.data.status === 'searching' || this.data.status === 'locating' || this.data.isStarting) return;
    const session = readNearbySearchSession();
    if (!session || session.candidateRestaurants.length < 3) return;
    const currentPageSessionId = pageSessionId;
    this.setData({ isStarting: true, errorMessage: '' });
    void loadCatalog(API_BASE_URL)
      .then(async (catalog) => {
        const largeSelection: CatalogSelection = {
          catalogVersion: catalog.catalogVersion,
          catalogHash: catalog.catalogHash,
          datasetType: 'large',
          items: catalog.items.filter((item) => item.datasetType === 'large'),
        };
        return hydrateCatalogSelectionImages(API_BASE_URL, largeSelection);
      })
      .then((selection) => {
        if (currentPageSessionId !== pageSessionId) return;
        const classifications = classifyMiniNearbyRestaurants(session.candidateRestaurants);
        const choices = aggregateNearbyRestaurantsToFoodChoices(session.candidateRestaurants, classifications, selection.items);
        if (choices.length === 0) throw new Error('附近商家暂时没有可识别的大类菜品，请扩大范围或重新搜索');
        const itemIds = shuffleChoices(choices).map((choice) => choice.id);
        saveStoredNearbyRound({
          choices,
          itemIds,
          history: [],
          restaurants: session.restaurants,
          completedAt: null,
        });
        wx.navigateTo({ url: '/pages/game/index?dataset=nearby' });
      })
      .catch((cause: unknown) => {
        if (currentPageSessionId !== pageSessionId) return;
        console.error('准备周围菜品游戏失败', cause);
        this.setData({
          status: 'error',
          errorMessage: cause instanceof Error ? cause.message : '暂时无法准备附近菜品，请重试',
        });
      })
      .finally(() => {
        if (currentPageSessionId === pageSessionId) this.setData({ isStarting: false });
      });
  },

  onExit() {
    wx.navigateBack({ delta: 1 });
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/index?return=nearby' });
  },

  onOpenLocationSettings() {
    wx.openSetting({
      success: (result) => {
        if (result.authSetting?.['scope.userLocation']) {
          this.locateAndSearch();
          return;
        }
        this.setData({
          status: 'error',
          locationPermissionDenied: true,
          errorMessage: '定位权限仍未开启，请允许后再试。',
        });
      },
      fail: (error) => {
        console.error('打开定位权限设置失败', error);
        this.setData({
          status: 'error',
          locationPermissionDenied: true,
          errorMessage: '无法打开定位权限设置，请在微信的“设置 > 小程序”中允许定位。',
        });
      },
    });
  },

  locateAndSearch() {
    if (this.data.status === 'locating' || this.data.status === 'searching') return;
    const currentPageSessionId = pageSessionId;
    hasStarted = true;
    this.setData({ status: 'locating', errorMessage: '', configMissing: false, locationPermissionDenied: false });
    wx.getLocation({
      type: 'gcj02',
      success: (result) => {
        if (currentPageSessionId !== pageSessionId) return;
        const center = { longitude: result.longitude, latitude: result.latitude };
        saveNearbyLocation(center);
        this.setData({ locationLabel: `当前位置 · ${formatPoint(center)}`, hasLocation: true });
        void this.searchAt(center);
      },
      fail: (error) => {
        if (currentPageSessionId !== pageSessionId) return;
        const cached = readNearbyLocation();
        if (cached) {
          this.setData({ locationLabel: `上次位置 · ${formatPoint(cached)}`, hasLocation: true });
          void this.searchAt(cached);
          return;
        }
        this.showLocationError(error, '获取当前位置');
      },
    });
  },

  showLocationError(error, action) {
    const errMsg = error.errMsg ?? '';
    console.error(`${action}失败`, errMsg || error);
    const updateError = (permissionDenied: boolean) => this.setData({
      status: 'error',
      locationPermissionDenied: permissionDenied,
      errorMessage: permissionDenied
        ? '定位权限未开启，请点击“打开定位权限”后重试。'
        : `${action}失败${errMsg ? `（${errMsg}）` : ''}，请重试或手动选择位置。`,
    });
    if (/auth deny|permission denied|authorize denied/i.test(errMsg)) {
      updateError(true);
      return;
    }
    wx.getSetting({
      success: (result) => {
        updateError(result.authSetting?.['scope.userLocation'] === false);
      },
      fail: () => updateError(false),
    });
  },

  loadSavedSession() {
    hasStarted = true;
    const session = readNearbySearchSession();
    if (!session) {
      this.locateAndSearch();
      return;
    }
    const radiusIndex = nearestRadiusIndex(session.radiusMeters);
    const resultLimitIndex = RESULT_LIMIT_OPTIONS.indexOf(session.resultLimit);
    saveNearbyLocation(session.center);
    this.setData({
      status: session.candidateRestaurants.length === 0 ? 'empty' : session.candidateRestaurants.length < 3 ? 'insufficient' : 'ready',
      locationLabel: `上次搜索位置 · ${formatPoint(session.center)}`,
      radiusIndex,
      resultLimitIndex: resultLimitIndex >= 0 ? resultLimitIndex : 1,
      resultLimit: session.resultLimit,
      restaurants: session.restaurants,
      candidateCount: session.candidateRestaurants.length,
      hasLocation: true,
      hasPendingSearchChange: false,
      errorMessage: '',
    });
  },

  searchAt(center: MiniGeoPoint) {
    const currentPageSessionId = pageSessionId;
    const currentSearchToken = ++searchToken;
    const radiusMeters = RADIUS_OPTIONS[this.data.radiusIndex] ?? 1000;
    const resultLimit = this.data.resultLimit;
    const previousRestaurants = this.data.restaurants;
    hasStarted = true;
    this.setData({ status: 'searching', errorMessage: '', hasLocation: true });
    const config = readAmapConfig();
    if (!config) {
      this.setData({ status: 'error', configMissing: true, errorMessage: '请先配置高德 Key 和 securityJsCode' });
      return Promise.resolve();
    }
    return searchNearbyRestaurants({ config, center, radiusMeters, resultLimit, candidateLimit: 200 })
      .then((candidates) => {
        if (currentPageSessionId !== pageSessionId || currentSearchToken !== searchToken) return;
        const restaurants = candidates.slice(0, resultLimit);
        saveNearbySearchSession({
          center,
          radiusMeters,
          restaurants,
          candidateRestaurants: candidates,
          resultLimit,
          searchedAt: new Date().toISOString(),
        });
        const status: NearbyPageStatus = candidates.length === 0 ? 'empty' : candidates.length < 3 ? 'insufficient' : 'ready';
        this.setData({
          status,
          restaurants,
          candidateCount: candidates.length,
          hasLocation: true,
          hasPendingSearchChange: false,
          locationLabel: `搜索位置 · ${formatPoint(center)}`,
        });
      })
      .catch((cause: unknown) => {
        if (currentPageSessionId !== pageSessionId || currentSearchToken !== searchToken) return;
        const errorMessage = cause instanceof AmapSearchError && cause.code === 'INVALID_CONFIG'
          ? `${cause.message}。请检查高德 Key 类型、securityJsCode 和请求合法域名。`
          : cause instanceof Error ? cause.message : '本次搜索失败，请检查网络和合法域名配置。';
        this.setData({ status: 'error', errorMessage, restaurants: previousRestaurants });
      });
  },
});

function formatRadius(radius: number): string {
  return radius >= 1000 ? `${radius / 1000} 公里` : `${radius} 米`;
}

function formatPoint(point: MiniGeoPoint): string {
  return `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
}

function nearestRadiusIndex(radius: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  RADIUS_OPTIONS.forEach((option, index) => {
    const distance = Math.abs(option - radius);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
}

function shuffleChoices<T>(choices: readonly T[]): T[] {
  const result = choices.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
