import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pageRoot = resolve(process.cwd(), 'src/pages/nearby');

describe('nearby food page', () => {
  it('registers the location search page and its core controls', async () => {
    const appConfig = JSON.parse(await readFile(resolve(process.cwd(), 'src/app.json'), 'utf8')) as {
      pages: string[];
      requiredPrivateInfos?: string[];
    };
    const markup = await readFile(resolve(pageRoot, 'index.wxml'), 'utf8');
    const styles = await readFile(resolve(pageRoot, 'index.wxss'), 'utf8');
    const script = await readFile(resolve(pageRoot, 'index.ts'), 'utf8');

    expect(appConfig.pages).toContain('pages/nearby/index');
    expect(appConfig.requiredPrivateInfos).toContain('getLocation');
    expect(appConfig.requiredPrivateInfos).toContain('chooseLocation');
    expect(markup).toContain('周围菜品');
    expect(markup).toContain('搜索范围');
    expect(markup).not.toContain('菜品数量');
    expect(markup).toContain('重新搜索');
    expect(markup).toContain('定位到我');
    expect(markup).toContain('开始游戏');
    expect(markup).toContain('退出周围菜品');
    expect(markup).toContain('nearby-hero-status');
    expect(markup).toContain('change-location-button');
    expect(markup).not.toContain('class="location-card');
    expect(markup).not.toContain('class="build-info"');
    expect(markup).not.toContain('resultLimitOptions');
    expect(markup).not.toContain('class="restaurant-list');
    expect(markup).not.toContain('附近餐厅列表');
    expect(markup.indexOf('search-actions')).toBeGreaterThan(markup.indexOf('filter-card'));
    expect(markup.indexOf('nearby-actions')).toBeLessThan(markup.indexOf('results-heading'));
    expect(styles).toContain('.nearby-hero-status');
    expect(styles).toContain('.change-location-button');
    expect(script).toContain('wx.getLocation');
    expect(script).toContain('wx.chooseLocation');
    expect(script).toContain('wx.getSetting');
    expect(script).toContain('wx.openSetting');
    expect(script).toContain('error.errMsg');
    expect(script).toContain("includes(':cancel')");
    expect(script).toContain('onSettings');
    expect(script).toContain('searchNearbyRestaurants');
    expect(script).toContain('candidateLimit: 200');
    expect(script).toContain("/pages/game/index?dataset=nearby");
  });
});
