export const MULTIPLAYER_ROUND_STORAGE_KEY_PREFIX = 'lets-eat.miniprogram.multiplayer-round.v1:';

export function clearStoredMultiplayerRound(roundId: string): void {
  if (roundId) wx.removeStorageSync(`${MULTIPLAYER_ROUND_STORAGE_KEY_PREFIX}${roundId}`);
}
