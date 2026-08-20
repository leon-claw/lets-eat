import { loadCatalogSelection, type CatalogItem } from '../../adapters/wx-catalog';
import {
  getRound,
  getRoundResult,
  type RoundResultItem,
} from '../../adapters/wx-round';
import { loadCustomCatalogSelection } from '../../adapters/wx-room';
import { clearWxDecisionQueue } from '../../adapters/wx-decision-queue';
import { clearStoredMultiplayerRound } from '../game/multiplayer-round-storage';
import { API_BASE_URL } from '../../config/runtime';

type ResultPageStatus = 'loading' | 'ready' | 'error';

interface ResultPlayerView {
  memberId: string;
  displayName: string;
  choices: CatalogItem[];
}

interface ResultPageData {
  status: ResultPageStatus;
  commonChoices: CatalogItem[];
  players: ResultPlayerView[];
  errorMessage: string;
}

interface ResultPageMethods {
  onLoad(options?: { roundId?: string }): void;
  onBack(): void;
  onRetry(): void;
  loadResult(): void;
}

let roundId = '';
let loadToken = 0;

Page<ResultPageData, ResultPageMethods>({
  data: {
    status: 'loading',
    commonChoices: [],
    players: [],
    errorMessage: '',
  },

  onLoad(options) {
    roundId = options?.roundId ?? '';
    this.loadResult();
  },

  onBack() {
    wx.navigateBack({ delta: 2 });
  },

  onRetry() {
    this.loadResult();
  },

  loadResult() {
    const currentLoadToken = ++loadToken;
    this.setData({ status: 'loading', errorMessage: '', commonChoices: [], players: [] });
    if (!roundId) {
      this.setData({ status: 'error', errorMessage: '缺少轮次信息，请返回房间重试' });
      return;
    }

    void getRound(API_BASE_URL, roundId)
      .then(async (round) => {
        const result = await getRoundResult(API_BASE_URL, roundId);
        if (currentLoadToken !== loadToken) return;
        const selection = result.datasetType === 'custom'
          ? await loadCustomCatalogSelection(API_BASE_URL, round.roomId)
          : await loadCatalogSelection(API_BASE_URL, result.datasetType);
        if (currentLoadToken !== loadToken) return;
        if (
          selection.catalogVersion !== result.catalogVersion ||
          selection.catalogHash !== result.catalogHash
        ) {
          throw new Error('本轮菜单版本已变化，暂时无法整理结果');
        }
        const choicesById = new Map(selection.items.map((item) => [item.id, item]));
        const resolveChoices = (items: RoundResultItem[]): CatalogItem[] => items
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((item) => choicesById.get(item.catalogItemId))
          .filter((item): item is CatalogItem => item !== undefined);

        this.setData({
          status: 'ready',
          commonChoices: resolveChoices(result.commonItems),
          players: result.players.map((player) => ({
            memberId: player.memberId,
            displayName: player.displayName,
            choices: resolveChoices(player.items),
          })),
        });
        clearStoredMultiplayerRound(roundId);
        clearWxDecisionQueue(roundId);
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
