export { ClientApiError } from './api-error.js';
export type { GameApi, CatalogSelection } from './ports/game-api.js';
export type { KeyValueStore } from './ports/storage.js';
export type { RealtimeStaleState, RealtimeTransport } from './ports/realtime.js';
export {
  hasExactChoiceOrder,
  shuffleChoices,
} from './catalog/round-choice-order.js';
export { filterCatalogItemsByIds } from './catalog/catalog-selection.js';
export type {
  CatalogDatasetType,
  FoodChoice,
} from './catalog/types.js';
export {
  advanceGameState,
  createGameState,
  getCurrentChoice,
  getNextChoice,
  getProgress,
  undoGameState,
} from './single-round/choose-food-state.js';
export type {
  GameDecision,
  GameDecisionRecord,
  GameState,
} from './single-round/choose-food-state.js';
export {
  isCustomCatalogSelection,
  isCustomCatalogSnapshot,
  MIN_CUSTOM_CATALOG_ITEMS,
  validateCustomCatalog,
} from './custom-catalog/custom-catalog.js';
export type {
  CustomCatalogSelection,
  CustomCatalogSnapshot,
  CustomCatalogValidation,
} from './custom-catalog/custom-catalog.js';
export {
  classifyMultiplayerError,
  isRoomTerminalPolicy,
} from './multiplayer/error-policy.js';
export type { ErrorPolicy } from './multiplayer/error-policy.js';
export { normalizeRoomState, normalizeRoundState } from './multiplayer/state-normalizer.js';
export type { RoomState, RoundState, SyncStateOptions } from './multiplayer/state-types.js';
export {
  getBackActionTarget,
  getRoomStateTarget,
  getRoundStateTarget,
} from './multiplayer/navigation-policy.js';
export type {
  BackAction,
  BackContext,
  NavigationTarget,
} from './multiplayer/navigation-policy.js';
export { DecisionQueue } from './multiplayer/decision-queue.js';
export type {
  DecisionOperationStore,
  DecisionTransport,
  QueuedDecisionOperation,
} from './multiplayer/decision-queue.js';
