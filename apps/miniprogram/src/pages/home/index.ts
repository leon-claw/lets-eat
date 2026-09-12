import { createWxDisplayNameStorage } from '../../adapters/wx-storage';
import {
  HOME_PLACEHOLDER_ROUTES,
  loadOrCreateDisplayName,
  saveDisplayName,
} from './home-model';
import { createShareConfig } from '../../shared/share-config';

interface HomePageData {
  displayName: string;
  toastMessage: string;
  toastVisible: boolean;
}

interface InputEvent {
  detail: {
    value: string;
  };
}

interface HomePageMethods {
  onDisplayNameInput(event: InputEvent): void;
  onStartTap(): void;
  onSettingsTap(): void;
  showToast(message: string): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

Page<HomePageData, HomePageMethods>({
  ...createShareConfig(),

  data: {
    displayName: '',
    toastMessage: '',
    toastVisible: false,
  },

  onLoad() {
    this.setData({
      displayName: loadOrCreateDisplayName(createWxDisplayNameStorage()),
    });
  },

  onDisplayNameInput(event: InputEvent) {
    this.setData({ displayName: event.detail.value });
  },

  onStartTap() {
    try {
      saveDisplayName(this.data.displayName, createWxDisplayNameStorage());
      wx.navigateTo({ url: HOME_PLACEHOLDER_ROUTES.mode });
    } catch (cause) {
      this.showToast(cause instanceof Error ? cause.message : '请输入用户名');
    }
  },

  onSettingsTap() {
    wx.navigateTo({ url: HOME_PLACEHOLDER_ROUTES.settings });
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
