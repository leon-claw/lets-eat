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
  it('contains the three dataset choices and the single-player handoff', () => {
    expect(datasetConfig.navigationBarTitleText).toBe('确认菜品数据集');
    expect(datasetMarkup).toContain('今天想从哪一类菜品开始？');
    expect(datasetMarkup).toContain('大类菜品');
    expect(datasetMarkup).toContain('西餐、中餐、日料等大分类');
    expect(datasetMarkup).toContain('小类菜品');
    expect(datasetMarkup).toContain('螺蛳粉、火锅、披萨等小分类');
    expect(datasetMarkup).toContain('周围菜品');
    expect(datasetMarkup).toContain('待上线，点击催开发进度');
    expect(datasetMarkup).toContain('onLargeTap');
    expect(datasetMarkup).toContain('onSmallTap');
    expect(datasetMarkup).toContain('onNearbyTap');
  });
});
