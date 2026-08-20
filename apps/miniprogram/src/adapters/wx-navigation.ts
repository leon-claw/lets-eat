import type { NavigationTarget } from '@lets-eat/client-core';

export function navigateToTarget(target: NavigationTarget): void {
  switch (target.type) {
    case 'home':
      wx.reLaunch({ url: '/pages/home/index' });
      return;
    case 'mode':
      wx.redirectTo({ url: '/pages/mode/index' });
      return;
    case 'room':
      wx.navigateTo({ url: target.roomId ? `/pages/room/index?roomId=${target.roomId}` : '/pages/room/index' });
      return;
    case 'choose':
      wx.navigateTo({ url: `/pages/game/index?roundId=${target.roundId}` });
      return;
    case 'waiting':
      wx.navigateTo({ url: `/pages/result/index?roundId=${target.roundId}&waiting=1` });
      return;
    case 'result':
      wx.navigateTo({ url: `/pages/result/index?roundId=${target.roundId}` });
      return;
  }
}
