import { MODE_ROUTES } from './mode-model';

Page({
  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onSingleTap() {
    wx.navigateTo({ url: MODE_ROUTES.dataset });
  },

  onTeamTap() {
    wx.navigateTo({ url: MODE_ROUTES.room });
  },
});
