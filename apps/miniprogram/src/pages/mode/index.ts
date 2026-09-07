import { MODE_ROUTES } from './mode-model';
import { createShareConfig } from '../../shared/share-config';

Page({
  ...createShareConfig(),

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  onSingleTap() {
    wx.navigateTo({ url: MODE_ROUTES.dataset });
  },

  onTeamTap() {
    wx.navigateTo({ url: `${MODE_ROUTES.room}?newRoom=1` });
  },
});
