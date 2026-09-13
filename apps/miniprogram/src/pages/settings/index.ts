import {
  loadCatalog,
  type CatalogItem,
  type CatalogSnapshot,
} from '../../adapters/wx-catalog';
import {
  MIN_CUSTOM_CATALOG_ITEMS,
  readCustomCatalog,
  saveCustomCatalog,
} from '../../adapters/wx-custom-catalog';
import { BUILD_LABEL } from '../../config/build-info';
import { API_BASE_URL } from '../../config/runtime';
import { createShareConfig } from '../../shared/share-config';
import { readAmapConfig, saveAmapConfig } from '../../adapters/wx-nearby-storage';

type SettingsPageStatus = 'loading' | 'ready' | 'error';
type CatalogFilter = 'all' | 'large' | 'small';

interface SettingsItemView extends CatalogItem {
  selected: boolean;
}

interface SettingsPageData {
  buildLabel: string;
  amapKey: string;
  amapSecurityJsCode: string;
  amapConfigured: boolean;
  status: SettingsPageStatus;
  filter: CatalogFilter;
  minItems: number;
  draftSelectedCount: number;
  visibleItems: SettingsItemView[];
  errorMessage: string;
  confirmVisible: boolean;
  toastMessage: string;
  toastVisible: boolean;
}

interface FilterEvent {
  currentTarget: { dataset: { filter?: string } };
}

interface ItemEvent {
  currentTarget: { dataset: { id?: string } };
}

interface InputEvent {
  detail: { value: string };
}

interface SettingsPageMethods {
  onLoad(options?: { return?: string }): void;
  onUnload(): void;
  onBack(): void;
  onFilterTap(event: FilterEvent): void;
  onToggleItem(event: ItemEvent): void;
  onSave(): void;
  onAmapKeyInput(event: InputEvent): void;
  onAmapSecurityJsCodeInput(event: InputEvent): void;
  onSaveAmapConfig(): void;
  onRetry(): void;
  onConfirmDiscard(): void;
  onCancelConfirm(): void;
  noop(): void;
  showToast(message: string): void;
  loadSettingsCatalog(): void;
}

let catalog: CatalogSnapshot | null = null;
let draftSelectedIds: string[] = [];
let savedSelectedIds: string[] = [];
let draftAmapKey = '';
let savedAmapKey = '';
let draftAmapSecurityJsCode = '';
let savedAmapSecurityJsCode = '';
let returnToNearby = false;
let currentFilter: CatalogFilter = 'all';
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let loadToken = 0;

Page<SettingsPageData, SettingsPageMethods>({
  ...createShareConfig(),

  data: {
    buildLabel: BUILD_LABEL,
    amapKey: '',
    amapSecurityJsCode: '',
    amapConfigured: false,
    status: 'loading',
    filter: 'all',
    minItems: MIN_CUSTOM_CATALOG_ITEMS,
    draftSelectedCount: 0,
    visibleItems: [],
    errorMessage: '',
    confirmVisible: false,
    toastMessage: '',
    toastVisible: false,
  },

  onLoad(options) {
    const stored = readCustomCatalog();
    const amapConfig = readAmapConfig();
    draftAmapKey = amapConfig?.key ?? '';
    savedAmapKey = draftAmapKey;
    draftAmapSecurityJsCode = amapConfig?.securityJsCode ?? '';
    savedAmapSecurityJsCode = draftAmapSecurityJsCode;
    returnToNearby = options?.return === 'nearby';
    draftSelectedIds = stored?.itemIds.slice() ?? [];
    savedSelectedIds = stored?.itemIds.slice() ?? [];
    currentFilter = 'all';
    catalog = null;
    this.setData({
      status: 'loading',
      amapKey: draftAmapKey,
      amapSecurityJsCode: draftAmapSecurityJsCode,
      amapConfigured: Boolean(amapConfig),
      filter: currentFilter,
      draftSelectedCount: draftSelectedIds.length,
      visibleItems: [],
      errorMessage: '',
      confirmVisible: false,
    });
    this.loadSettingsCatalog();
  },

  onUnload() {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    catalog = null;
    draftSelectedIds = [];
    savedSelectedIds = [];
    draftAmapKey = '';
    savedAmapKey = '';
    draftAmapSecurityJsCode = '';
    savedAmapSecurityJsCode = '';
    returnToNearby = false;
  },

  onBack() {
    if (isDirty()) {
      this.setData({ confirmVisible: true });
      return;
    }
    wx.navigateBack({ delta: 1 });
  },

  onFilterTap(event) {
    const nextFilter = event.currentTarget.dataset.filter;
    if (nextFilter !== 'all' && nextFilter !== 'large' && nextFilter !== 'small') return;
    currentFilter = nextFilter;
    this.setData({ filter: currentFilter, visibleItems: getVisibleItems() });
  },

  onToggleItem(event) {
    const itemId = event.currentTarget.dataset.id;
    if (!itemId || !catalog?.items.some((item) => item.id === itemId)) return;
    draftSelectedIds = draftSelectedIds.includes(itemId)
      ? draftSelectedIds.filter((id) => id !== itemId)
      : [...draftSelectedIds, itemId];
    this.setData({
      draftSelectedCount: draftSelectedIds.length,
      visibleItems: getVisibleItems(),
    });
  },

  onSave() {
    if (!catalog) return;
    if (draftSelectedIds.length < MIN_CUSTOM_CATALOG_ITEMS) {
      this.showToast(`至少选择 ${MIN_CUSTOM_CATALOG_ITEMS} 道菜品`);
      return;
    }
    try {
      saveCustomCatalog({
        catalogVersion: catalog.catalogVersion,
        catalogHash: catalog.catalogHash,
        itemIds: draftSelectedIds,
      });
      savedSelectedIds = draftSelectedIds.slice();
      this.showToast('自定义菜品已保存');
    } catch (cause) {
      this.showToast(cause instanceof Error ? cause.message : '保存失败，请重试');
    }
  },

  onAmapKeyInput(event) {
    draftAmapKey = event.detail.value;
    this.setData({
      amapKey: draftAmapKey,
      amapConfigured: Boolean(draftAmapKey.trim() && draftAmapSecurityJsCode.trim()),
    });
  },

  onAmapSecurityJsCodeInput(event) {
    draftAmapSecurityJsCode = event.detail.value;
    this.setData({
      amapSecurityJsCode: draftAmapSecurityJsCode,
      amapConfigured: Boolean(draftAmapKey.trim() && draftAmapSecurityJsCode.trim()),
    });
  },

  onSaveAmapConfig() {
    try {
      saveAmapConfig({ key: draftAmapKey, securityJsCode: draftAmapSecurityJsCode });
      savedAmapKey = draftAmapKey.trim();
      savedAmapSecurityJsCode = draftAmapSecurityJsCode.trim();
      this.setData({ amapKey: savedAmapKey, amapSecurityJsCode: savedAmapSecurityJsCode, amapConfigured: true });
      if (returnToNearby) wx.redirectTo({ url: '/pages/nearby/index' });
      else this.showToast('高德配置已保存在本机');
    } catch (cause) {
      this.showToast(cause instanceof Error ? cause.message : '保存高德配置失败');
    }
  },

  onRetry() {
    this.loadSettingsCatalog();
  },

  onConfirmDiscard() {
    this.setData({ confirmVisible: false });
    wx.navigateBack({ delta: 1 });
  },

  onCancelConfirm() {
    this.setData({ confirmVisible: false });
  },

  noop() {},

  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    this.setData({ toastMessage: message, toastVisible: true });
    toastTimer = setTimeout(() => {
      this.setData({ toastVisible: false });
      toastTimer = null;
    }, 1800);
  },

  loadSettingsCatalog() {
    const currentLoadToken = ++loadToken;
    this.setData({ status: 'loading', errorMessage: '' });
    void loadCatalog(API_BASE_URL)
      .then((loaded) => {
        if (currentLoadToken !== loadToken) return;
        catalog = loaded;
        const validIds = new Set(loaded.items.map((item) => item.id));
        draftSelectedIds = draftSelectedIds.filter((itemId) => validIds.has(itemId));
        this.setData({
          status: 'ready',
          draftSelectedCount: draftSelectedIds.length,
          visibleItems: getVisibleItems(),
        });
      })
      .catch((cause: unknown) => {
        if (currentLoadToken !== loadToken) return;
        catalog = null;
        this.setData({
          status: 'error',
          visibleItems: [],
          errorMessage: cause instanceof Error ? cause.message : '菜单加载失败，请重试',
        });
      });
  },
});

function getVisibleItems(): SettingsItemView[] {
  if (!catalog) return [];
  return catalog.items
    .filter((item) => currentFilter === 'all' || item.datasetType === currentFilter)
    .map((item) => ({ ...item, selected: draftSelectedIds.includes(item.id) }));
}

function isDirty(): boolean {
  return JSON.stringify(draftSelectedIds) !== JSON.stringify(savedSelectedIds)
    || draftAmapKey.trim() !== savedAmapKey
    || draftAmapSecurityJsCode.trim() !== savedAmapSecurityJsCode;
}
