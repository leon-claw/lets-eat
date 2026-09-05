import { loadCatalogCounts } from '../../adapters/wx-catalog';
import { API_BASE_URL } from '../../config/runtime';
import { createShareConfig } from '../../shared/share-config';

interface DatasetPageData {
  countsLoading: boolean;
  largeCount: number;
  smallCount: number;
  toastMessage: string;
  toastVisible: boolean;
}

interface DatasetPageMethods {
  onLargeTap(): void;
  onSmallTap(): void;
  onNearbyTap(): void;
  onBack(): void;
  showToast(message: string): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

Page<DatasetPageData, DatasetPageMethods>({
  ...createShareConfig(),

  data: {
    countsLoading: true,
    largeCount: 0,
    smallCount: 0,
    toastMessage: '',
    toastVisible: false,
  },

  onLoad() {
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

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onLargeTap() {
    wx.navigateTo({ url: '/pages/game/index?dataset=large' });
  },

  onSmallTap() {
    wx.navigateTo({ url: '/pages/game/index?dataset=small' });
  },

  onNearbyTap() {
    this.showToast('周围菜品待上线，敬请期待');
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
