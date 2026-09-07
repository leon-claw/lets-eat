import { loadCatalogSelection, type CatalogItem } from '../../adapters/wx-catalog';
import {
  filterCatalogItemsByIds,
  loadLocalCustomCatalogSelection,
} from '../../adapters/wx-custom-catalog';
import { API_BASE_URL } from '../../config/runtime';
import {
  clearStoredSingleRound,
  readStoredSingleRound,
  type StoredSingleRound,
} from '../game/single-round-storage';
import { createShareConfig } from '../../shared/share-config';

type SingleResultStatus = 'loading' | 'ready' | 'empty' | 'error';

interface SingleResultPageData {
  status: SingleResultStatus;
  choices: CatalogItem[];
  selectedCount: number;
  listVisible: boolean;
  errorMessage: string;
}

interface SingleResultPageMethods {
  onLoad(): void;
  onBack(): void;
  onRestart(): void;
  onRetry(): void;
  onToggleList(): void;
  loadResult(): void;
}

let storedRound: StoredSingleRound | null = null;
let loadToken = 0;

Page<SingleResultPageData, SingleResultPageMethods>({
  ...createShareConfig(),

  data: {
    status: 'loading',
    choices: [],
    selectedCount: 0,
    listVisible: true,
    errorMessage: '',
  },

  onLoad() {
    this.loadResult();
  },

  onBack() {
    clearStoredSingleRound();
    wx.redirectTo({ url: '/pages/mode/index' });
  },

  onRestart() {
    clearStoredSingleRound();
    wx.redirectTo({ url: '/pages/dataset/index' });
  },

  onRetry() {
    this.loadResult();
  },

  onToggleList() {
    this.setData({ listVisible: !this.data.listVisible });
  },

  loadResult() {
    const currentLoadToken = ++loadToken;
    storedRound = readStoredSingleRound();
    this.setData({
      status: 'loading',
      choices: [],
      selectedCount: 0,
      errorMessage: '',
      listVisible: true,
    });
    if (!storedRound) {
      this.setData({ status: 'empty' });
      return;
    }

    const selectionPromise = storedRound.datasetType === 'custom'
      ? loadLocalCustomCatalogSelection(API_BASE_URL)
      : loadCatalogSelection(API_BASE_URL, storedRound.datasetType);
    void selectionPromise
      .then((selection) => {
        if (currentLoadToken !== loadToken || !storedRound) return;
        if (
          selection.catalogVersion !== storedRound.catalogVersion ||
          selection.catalogHash !== storedRound.catalogHash
        ) {
          throw new Error('本轮菜单版本已变化，暂时无法整理结果');
        }
        const likedIds = storedRound.history
          .filter((record) => record.decision === 'liked')
          .map((record) => record.choiceId);
        const choices = filterCatalogItemsByIds(selection.items, likedIds);
        this.setData({ status: 'ready', choices, selectedCount: choices.length });
      })
      .catch((cause: unknown) => {
        if (currentLoadToken !== loadToken) return;
        this.setData({
          status: 'error',
          errorMessage: cause instanceof Error ? cause.message : '结果加载失败，请重试',
        });
      });
  },
});
