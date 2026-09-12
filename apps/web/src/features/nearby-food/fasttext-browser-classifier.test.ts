import { describe, expect, it, vi } from 'vitest';
import { createNearbyFastTextClassifier } from './fasttext-browser-classifier';

function model(label: string, probability = 0.92) {
  return {
    predict: vi.fn(() => ({
      size: () => 1,
      get: () => [probability, `__label__${label}`] as const,
    })),
  };
}

describe('browser fastText classifier', () => {
  it('loads once and classifies with both name and Amap type', async () => {
    const loaded = model('火锅');
    const loadModel = vi.fn().mockResolvedValue(loaded);
    const classifier = createNearbyFastTextClassifier({ loadModel });

    const result = await classifier.classify('蜀香火锅', '餐饮服务|中餐厅|火锅店');
    await classifier.classify('另一家火锅', '餐饮服务|中餐厅|火锅店');

    expect(loadModel).toHaveBeenCalledTimes(1);
    expect(loaded.predict).toHaveBeenCalledWith(
      'name_蜀香火锅 amap_餐饮服务 amap_中餐厅 amap_火锅店',
      1,
      0,
    );
    expect(result).toMatchObject({ category: '火锅', confidence: 0.92, source: 'fasttext' });
  });

  it('falls back when loading or prediction fails', async () => {
    const classifier = createNearbyFastTextClassifier({
      loadModel: vi.fn().mockRejectedValue(new Error('WASM unavailable')),
    });

    await expect(classifier.ready()).resolves.toBeUndefined();
    const result = await classifier.classify('没有明显类型的餐厅', '餐饮服务|中餐厅');
    expect(result.source).toBe('fallback');
  });
});
