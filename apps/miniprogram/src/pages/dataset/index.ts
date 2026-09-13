import { loadCatalogCounts } from '../../adapters/wx-catalog';
import {
  MIN_CUSTOM_CATALOG_ITEMS,
  readCustomCatalog,
} from '../../adapters/wx-custom-catalog';
import { API_BASE_URL } from '../../config/runtime';
import { createShareConfig } from '../../shared/share-config';
import { readAmapConfig } from '../../adapters/wx-nearby-storage';

interface DatasetPageData {
  countsLoading: boolean;
  largeCount: number;
  smallCount: number;
  customCount: number;
  customConfigured: boolean;
  nearbyConfigured: boolean;
  toastMessage: string;
  toastVisible: boolean;
}

interface DatasetPageMethods {
  onShow(): void;
  onLargeTap(): void;
  onSmallTap(): void;
  onCustomTap(): void;
  onNearbyTap(): void;
  onBack(): void;
  refreshCustomSummary(): void;
  refreshNearbySummary(): void;
  showToast(message: string): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

Page<DatasetPageData, DatasetPageMethods>({
  ...createShareConfig(),

  data: {
    countsLoading: true,
    largeCount: 0,
    smallCount: 0,
    customCount: 0,
    customConfigured: false,
    nearbyConfigured: false,
    toastMessage: '',
    toastVisible: false,
  },

  onLoad() {
    this.refreshCustomSummary();
    this.refreshNearbySummary();
    void loadCatalogCounts(API_BASE_URL).then((counts) => {
      this.setData({
        countsLoading: false,
        largeCount: counts.large,
        smallCount: counts.small,
      });
    }).catch((cause: unknown) => {
      console.error('加载菜单统计失败', cause);
      this.setData({ countsLoading: false, largeCount: 0, smallCount: 0 });
      this.showToast(cause instanceof Error ? cause.message : '菜单统计加载失败');
    });
  },

  onShow() {
    this.refreshCustomSummary();
    this.refreshNearbySummary();
  },

  refreshCustomSummary() {
    const customCatalog = readCustomCatalog();
    this.setData({
      customCount: customCatalog?.itemIds.length ?? 0,
      customConfigured: (customCatalog?.itemIds.length ?? 0) >= MIN_CUSTOM_CATALOG_ITEMS,
    });
  },

  refreshNearbySummary() {
    this.setData({ nearbyConfigured: Boolean(readAmapConfig()) });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onLargeTap() {
    wx.navigateTo({ url: '/pages/game/index?dataset=large' });
  },

  onSmallTap() {
    wx.navigateTo({ url: '/pages/game/index?dataset=small' });
  },

  onCustomTap() {
    const customCatalog = readCustomCatalog();
    if (!customCatalog || customCatalog.itemIds.length < MIN_CUSTOM_CATALOG_ITEMS) {
      wx.navigateTo({ url: '/pages/settings/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/game/index?dataset=custom' });
  },

  onNearbyTap() {
    wx.navigateTo({
      url: readAmapConfig() ? '/pages/nearby/index' : '/pages/settings/index?return=nearby',
    });
  },

  showToast(message: string) {
    if (toastTimer) clearTimeout(toastTimer);
    this.setData({ toastMessage: message, toastVisible: true });
    toastTimer = setTimeout(() => {
      this.setData({ toastVisible: false });
      toastTimer = null;
    }, 1800);
  },
});
