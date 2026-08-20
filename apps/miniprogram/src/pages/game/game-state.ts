export type {
  FoodChoice as GameChoice,
  GameDecision,
  GameDecisionRecord,
  GameState,
} from '@lets-eat/client-core';
export {
  advanceGameState,
  createGameState,
  getCurrentChoice,
  getNextChoice,
  getProgress,
  shuffleChoices,
  undoGameState,
} from '@lets-eat/client-core';
