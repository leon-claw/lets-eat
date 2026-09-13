import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const datasetMarkup = readFileSync(
  resolve(__dirname, '../src/pages/dataset/index.wxml'),
  'utf8',
);
const datasetConfig = JSON.parse(
  readFileSync(resolve(__dirname, '../src/pages/dataset/index.json'), 'utf8'),
) as { navigationBarTitleText?: string };

describe('dataset page', () => {
  it('contains the single-player dataset choices including custom foods', () => {
    expect(datasetConfig.navigationBarTitleText).toBe('确认菜品数据集');
    expect(datasetMarkup).toContain('今天想从哪一类菜品开始？');
    expect(datasetMarkup).toContain('大类菜品');
    expect(datasetMarkup).toContain('西餐、中餐、日料等大分类');
    expect(datasetMarkup).toContain('小类菜品');
    expect(datasetMarkup).toContain('螺蛳粉、火锅、披萨等小分类');
    expect(datasetMarkup).toContain('周围菜品');
    expect(datasetMarkup).toContain('按位置搜索高分餐厅');
    expect(datasetMarkup).toContain('自定义菜品');
    expect(datasetMarkup).toContain('至少选择 3 道菜品');
    expect(datasetMarkup).toContain('onLargeTap');
    expect(datasetMarkup).toContain('onSmallTap');
    expect(datasetMarkup).toContain('onNearbyTap');
    expect(datasetMarkup).toContain('onCustomTap');
  });

  it('routes the custom dataset choice to the local configuration or game', async () => {
    const script = readFileSync(resolve(__dirname, '../src/pages/dataset/index.ts'), 'utf8');

    expect(script).toContain('readCustomCatalog');
    expect(script).toContain('MIN_CUSTOM_CATALOG_ITEMS');
    expect(script).toContain('onShow()');
    expect(script).toContain('refreshCustomSummary');
    expect(script).toContain("/pages/game/index?dataset=custom");
    expect(script).toContain("/pages/settings/index");
    expect(script).toContain("/pages/nearby/index");
    expect(script).toContain('readAmapConfig');
  });
});
