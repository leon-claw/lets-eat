import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NearbyRestaurant } from './types';
import {
  useNearbyRestaurantClassifications,
} from './useNearbyRestaurantClassifications';

function restaurant(index: number): NearbyRestaurant {
  return {
    source: 'amap',
    id: `poi-${index}`,
    name: `餐厅 ${index}`,
    type: '餐饮服务|中餐厅',
    fetchedAt: '2026-09-12T00:00:00.000Z',
    providerData: {},
  };
}

describe('useNearbyRestaurantClassifications', () => {
  it('does not initialize the model when there are no visible restaurants', () => {
    const classifier = {
      ready: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn(),
    };

    renderHook(() => useNearbyRestaurantClassifications([], classifier));

    expect(classifier.ready).not.toHaveBeenCalled();
    expect(classifier.classify).not.toHaveBeenCalled();
  });

  it('shows rule results immediately and replaces the first 20 with model results', async () => {
    const classifier = {
      ready: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn().mockResolvedValue({ category: '火锅', confidence: 0.91, source: 'fasttext' as const }),
    };
    const restaurants = [{ ...restaurant(1), name: '某家火锅', type: '餐饮服务|中餐厅|火锅店' }];

    const { result } = renderHook(() => useNearbyRestaurantClassifications(restaurants, classifier));

    expect(result.current.get('poi-1')).toMatchObject({ category: '火锅' });
    await waitFor(() => expect(classifier.classify).toHaveBeenCalledWith('某家火锅', '餐饮服务|中餐厅|火锅店'));
    await waitFor(() => expect(result.current.get('poi-1')).toMatchObject({ source: 'fasttext', confidence: 0.91 }));
  });

  it('does not classify the 21st restaurant', async () => {
    const classifier = {
      ready: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn().mockResolvedValue({ category: '其他', confidence: 0, source: 'fallback' as const }),
    };
    const restaurants = Array.from({ length: 21 }, (_, index) => restaurant(index));

    renderHook(() => useNearbyRestaurantClassifications(restaurants, classifier));

    await waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(20));
    expect(classifier.classify).not.toHaveBeenCalledWith('餐厅 20', '餐饮服务|中餐厅');
  });

  it('keeps the fallback result when one model prediction rejects', async () => {
    const classifier = {
      ready: vi.fn().mockResolvedValue(undefined),
      classify: vi.fn().mockRejectedValue(new Error('prediction failed')),
    };

    const { result } = renderHook(() => useNearbyRestaurantClassifications([restaurant(1)], classifier));

    await waitFor(() => expect(classifier.classify).toHaveBeenCalledTimes(1));
    expect(result.current.get('poi-1')).toMatchObject({ source: 'fallback' });
  });
});
