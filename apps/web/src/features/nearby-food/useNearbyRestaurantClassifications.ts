import { useEffect, useMemo, useState } from 'react';
import { createNearbyFastTextClassifier, type NearbyFastTextClassifier } from './fasttext-browser-classifier';
import { classifyNearbyRestaurantName, type NearbyRestaurantClassification } from './restaurant-type-classifier';
import type { NearbyRestaurant } from './types';

const VISIBLE_RESTAURANT_LIMIT = 20;
export const defaultNearbyRestaurantClassifier = createNearbyFastTextClassifier();
const readyPromises = new WeakMap<NearbyFastTextClassifier, Promise<void>>();

function readyOnce(classifier: NearbyFastTextClassifier): Promise<void> {
  const previous = readyPromises.get(classifier);
  if (previous) return previous;
  const current = classifier.ready().catch(() => undefined);
  readyPromises.set(classifier, current);
  return current;
}

function inputKey(restaurants: NearbyRestaurant[]): string {
  return restaurants.map((restaurant) => `${restaurant.id}\u0000${restaurant.name}\u0000${restaurant.type}`).join('\u0001');
}

function fallbackMap(restaurants: NearbyRestaurant[]): Map<string, NearbyRestaurantClassification> {
  return new Map(
    restaurants.map((restaurant) => [
      restaurant.id,
      classifyNearbyRestaurantName(restaurant.name, restaurant.type),
    ]),
  );
}

type AsyncClassificationState = {
  key: string;
  results: Map<string, NearbyRestaurantClassification>;
};

export function useNearbyRestaurantClassifications(
  restaurants: NearbyRestaurant[],
  classifier: NearbyFastTextClassifier = defaultNearbyRestaurantClassifier,
): Map<string, NearbyRestaurantClassification> {
  const visibleRestaurants = useMemo(() => restaurants.slice(0, VISIBLE_RESTAURANT_LIMIT), [restaurants]);
  const currentKey = useMemo(() => inputKey(visibleRestaurants), [visibleRestaurants]);
  const immediateFallbacks = useMemo(() => fallbackMap(visibleRestaurants), [visibleRestaurants]);
  const [asyncState, setAsyncState] = useState<AsyncClassificationState>(() => ({
    key: currentKey,
    results: new Map(),
  }));

  useEffect(() => {
    let cancelled = false;

    if (visibleRestaurants.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const classify = async () => {
      await readyOnce(classifier);
      if (cancelled) return;

      const results = new Map<string, NearbyRestaurantClassification>();
      await Promise.all(visibleRestaurants.map(async (restaurant) => {
        try {
          results.set(restaurant.id, await classifier.classify(restaurant.name, restaurant.type));
        } catch {
          // The synchronous fallback is already present in the returned map.
        }
      }));

      if (!cancelled) setAsyncState({ key: currentKey, results });
    };

    void classify();
    return () => {
      cancelled = true;
    };
  }, [classifier, currentKey]);

  const modelResults = asyncState.key === currentKey ? asyncState.results : new Map();
  return useMemo(() => {
    const merged = new Map(immediateFallbacks);
    modelResults.forEach((classification, restaurantId) => merged.set(restaurantId, classification));
    return merged;
  }, [immediateFallbacks, modelResults]);
}
