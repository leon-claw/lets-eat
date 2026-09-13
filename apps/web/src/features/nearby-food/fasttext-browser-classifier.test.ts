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

  it('uses the explicit brand mapping before consulting the model', async () => {
    const loaded = model('其他');
    const loadModel = vi.fn().mockResolvedValue(loaded);
    const classifier = createNearbyFastTextClassifier({ loadModel });

    await expect(classifier.classify('麦当劳(农林下路店)', '餐饮服务|快餐厅')).resolves.toMatchObject({
      category: '西餐',
      source: 'local-model',
    });
    expect(loadModel).not.toHaveBeenCalled();
    expect(loaded.predict).not.toHaveBeenCalled();
  });

  it.each([
    ['肯德基(邦华店)', '餐饮服务|快餐厅'],
    ['达美乐比萨(龙溪店)', '餐饮服务|西餐厅'],
    ['尊宝比萨', '餐饮服务|西餐厅'],
  ])('保留已知连锁品牌的明确分类：%s', async (name, amapType) => {
    const loaded = model('螺蛳粉');
    const loadModel = vi.fn().mockResolvedValue(loaded);
    const classifier = createNearbyFastTextClassifier({ loadModel });

    await expect(classifier.classify(name, amapType)).resolves.toMatchObject({
      category: '西餐',
      source: 'local-model',
    });
    expect(loadModel).not.toHaveBeenCalled();
  });

  it('不会接受缺少螺蛳粉证据的模型误判，但保留明确的螺蛳粉门店', async () => {
    const loaded = model('螺蛳粉');
    const classifier = createNearbyFastTextClassifier({
      loadModel: vi.fn().mockResolvedValue(loaded),
    });

    await expect(classifier.classify('汇林小食店', '餐饮服务;中餐厅')).resolves.toMatchObject({
      category: '其他',
      source: 'fallback',
    });
    await expect(classifier.classify('龙螺鲜·柳州螺蛳粉(高岗街店)', '餐饮服务;快餐厅')).resolves.toMatchObject({
      category: '螺蛳粉',
      source: 'fasttext',
    });
  });

  it('falls back to other for low-confidence predictions on neutral names', async () => {
    const loaded = model('粤菜', 0.34);
    const loadModel = vi.fn().mockResolvedValue(loaded);
    const classifier = createNearbyFastTextClassifier({ loadModel });

    await expect(classifier.classify('味然香(执信店)', '餐饮服务;中餐厅')).resolves.toMatchObject({
      category: '其他',
      source: 'fallback',
    });
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
