import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserLocation } from './browser-location';
import { searchNearbyRestaurants } from './amap-client';
import {
  createNearbyConfigStore,
  createNearbyLocationStore,
  createNearbySearchSessionStore,
} from './nearby-storage';
import type { AmapConfig, GeoPoint, NearbyRestaurant, NearbyResultLimit, NearbySearchSession } from './types';

export const DEFAULT_NEARBY_RADIUS_METERS = 2000;
export const NEARBY_RADIUS_OPTIONS = [500, 1000, 2000, 3000, 5000] as const;
export const DEFAULT_NEARBY_RESULT_LIMIT: NearbyResultLimit = 20;
export const NEARBY_RESULT_LIMIT_OPTIONS = [10, 20, 30] as const;

export type NearbySearchStatus =
  | 'restoring'
  | 'locating'
  | 'location-fallback'
  | 'searching'
  | 'success'
  | 'empty'
  | 'insufficient'
  | 'ready'
  | 'error';

export interface NearbyFoodSearchState {
  status: NearbySearchStatus;
  radiusMeters: number;
  resultLimit: NearbyResultLimit;
  center: GeoPoint | null;
  restaurants: NearbyRestaurant[];
  errorMessage: string | null;
  errorCode: string | null;
  hasPendingRadiusChange: boolean;
  hasPendingResultLimitChange: boolean;
}

export interface NearbyFoodSearchController {
  state: NearbyFoodSearchState;
  setRadius(radiusMeters: number): void;
  setResultLimit(resultLimit: NearbyResultLimit): void;
  search(): Promise<void>;
  useLocation(point: GeoPoint): Promise<void>;
  retryLocation(): Promise<void>;
}

interface Store<T> {
  load(): T | null;
  save(value: T): void;
  clear(): void;
}

export interface NearbyFoodSearchDependencies {
  configStore?: Store<AmapConfig>;
  locationStore?: Store<GeoPoint>;
  searchSessionStore?: Store<NearbySearchSession>;
  initialLocation?: GeoPoint;
  getLocation?: () => Promise<GeoPoint>;
  searchRestaurants?: (input: { config: AmapConfig; center: GeoPoint; radiusMeters: number; resultLimit: NearbyResultLimit }) => Promise<NearbyRestaurant[]>;
}

const initialState: NearbyFoodSearchState = {
  status: 'restoring',
  radiusMeters: DEFAULT_NEARBY_RADIUS_METERS,
  resultLimit: DEFAULT_NEARBY_RESULT_LIMIT,
  center: null,
  restaurants: [],
  errorMessage: null,
  errorCode: null,
  hasPendingRadiusChange: false,
  hasPendingResultLimitChange: false,
};

function resultStatus(count: number): NearbySearchStatus {
  if (count === 0) return 'empty';
  if (count < 3) return 'insufficient';
  return 'ready';
}

function errorDetails(cause: unknown): { code: string; message: string } {
  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return {
      code: cause.code,
      message: cause instanceof Error ? cause.message : '附近餐厅搜索失败',
    };
  }
  return {
    code: 'REQUEST_FAILED',
    message: cause instanceof Error ? cause.message : '附近餐厅搜索失败',
  };
}

export function useNearbyFoodSearch(dependencies: NearbyFoodSearchDependencies = {}): NearbyFoodSearchController {
  const configStore = useMemo(() => dependencies.configStore ?? createNearbyConfigStore(), [dependencies.configStore]);
  const locationStore = useMemo(() => dependencies.locationStore ?? createNearbyLocationStore(), [dependencies.locationStore]);
  const searchSessionStore = useMemo(() => dependencies.searchSessionStore ?? createNearbySearchSessionStore(), [dependencies.searchSessionStore]);
  const getLocation = dependencies.getLocation ?? getBrowserLocation;
  const searchRestaurants = dependencies.searchRestaurants ?? searchNearbyRestaurants;
  const [state, setState] = useState<NearbyFoodSearchState>(initialState);
  const centerRef = useRef<GeoPoint | null>(null);
  const radiusRef = useRef(DEFAULT_NEARBY_RADIUS_METERS);
  const resultLimitRef = useRef<NearbyResultLimit>(DEFAULT_NEARBY_RESULT_LIMIT);
  const appliedResultLimitRef = useRef<NearbyResultLimit>(DEFAULT_NEARBY_RESULT_LIMIT);
  const configRef = useRef<AmapConfig | null>(null);
  const requestRef = useRef<Promise<void> | null>(null);
  const locationRequestRef = useRef<Promise<void> | null>(null);

  const performSearch = useCallback((center: GeoPoint, radiusMeters: number, resultLimit: NearbyResultLimit): Promise<void> => {
    if (requestRef.current) return requestRef.current;
    const config = configRef.current;
    if (!config) return Promise.resolve();

    centerRef.current = center;
    radiusRef.current = radiusMeters;
    resultLimitRef.current = resultLimit;
    setState((current) => ({
      ...current,
      status: 'searching',
      center,
      radiusMeters,
      errorMessage: null,
      errorCode: null,
    }));

    const request = Promise.resolve()
      .then(() => searchRestaurants({ config, center, radiusMeters, resultLimit }))
      .then((items) => {
        const restaurants = items.slice(0, resultLimit);
        const session: NearbySearchSession = {
          center,
          radiusMeters,
          restaurants,
          resultLimit,
          searchedAt: new Date().toISOString(),
        };
        locationStore.save(center);
        searchSessionStore.save(session);
        setState((current) => ({
          ...current,
          status: resultStatus(restaurants.length),
          center,
          radiusMeters,
          resultLimit,
          restaurants,
          errorMessage: null,
          errorCode: null,
          hasPendingRadiusChange: false,
          hasPendingResultLimitChange: false,
        }));
        appliedResultLimitRef.current = resultLimit;
      })
      .catch((cause: unknown) => {
        const error = errorDetails(cause);
        setState((current) => ({
          ...current,
          status: 'error',
          errorMessage: error.message,
          errorCode: error.code,
        }));
      })
      .finally(() => {
        requestRef.current = null;
      });
    requestRef.current = request;
    return request;
  }, [locationStore, searchRestaurants, searchSessionStore]);

  const locate = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, status: 'locating', errorMessage: null, errorCode: null }));
    try {
      const point = await getLocation();
      await performSearch(point, radiusRef.current, resultLimitRef.current);
    } catch (cause) {
      const cachedPoint = locationStore.load();
      if (cachedPoint) {
        await performSearch(cachedPoint, radiusRef.current, resultLimitRef.current);
        return;
      }
      const error = errorDetails(cause);
      setState((current) => ({
        ...current,
        status: 'location-fallback',
        errorMessage: error.message,
        errorCode: error.code,
      }));
    }
  }, [getLocation, locationStore, performSearch]);

  const retryLocation = useCallback((): Promise<void> => {
    if (locationRequestRef.current) return locationRequestRef.current;
    if (requestRef.current) return requestRef.current;

    setState((current) => ({ ...current, status: 'locating', errorMessage: null, errorCode: null }));
    const request = Promise.resolve()
      .then(() => getLocation())
      .then((point) => performSearch(point, radiusRef.current, resultLimitRef.current))
      .catch((cause: unknown) => {
        const error = errorDetails(cause);
        setState((current) => ({
          ...current,
          status: 'error',
          errorMessage: error.message,
          errorCode: error.code,
        }));
      })
      .finally(() => {
        locationRequestRef.current = null;
      });
    locationRequestRef.current = request;
    return request;
  }, [getLocation, performSearch]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const config = configStore.load();
      if (!config) {
        if (active) setState((current) => ({ ...current, status: 'error', errorCode: 'INVALID_CONFIG', errorMessage: '请先配置高德 Key 和 securityJsCode' }));
        return;
      }
      configRef.current = config;
      const session = searchSessionStore.load();
      if (dependencies.initialLocation) {
        const radiusMeters = session?.radiusMeters ?? radiusRef.current;
        const resultLimit = session?.resultLimit ?? DEFAULT_NEARBY_RESULT_LIMIT;
        radiusRef.current = radiusMeters;
        resultLimitRef.current = resultLimit;
        await performSearch(dependencies.initialLocation, radiusMeters, resultLimit);
        return;
      }
      if (session) {
        centerRef.current = session.center;
        radiusRef.current = session.radiusMeters;
        resultLimitRef.current = session.resultLimit ?? DEFAULT_NEARBY_RESULT_LIMIT;
        appliedResultLimitRef.current = resultLimitRef.current;
        if (active) {
          setState({
            status: resultStatus(session.restaurants.length),
            radiusMeters: session.radiusMeters,
            resultLimit: resultLimitRef.current,
            center: session.center,
            restaurants: session.restaurants,
            errorMessage: null,
            errorCode: null,
            hasPendingRadiusChange: false,
            hasPendingResultLimitChange: false,
          });
        }
        return;
      }
      if (active) setState((current) => ({ ...current, status: 'locating' }));
      await locate();
    };
    void restore();
    return () => { active = false; };
  }, [configStore, dependencies.initialLocation, locate, performSearch, searchSessionStore]);

  const setRadius = useCallback((radiusMeters: number) => {
    radiusRef.current = radiusMeters;
    setState((current) => ({ ...current, radiusMeters, hasPendingRadiusChange: true }));
  }, []);

  const setResultLimit = useCallback((resultLimit: NearbyResultLimit) => {
    resultLimitRef.current = resultLimit;
    setState((current) => ({
      ...current,
      resultLimit,
      hasPendingResultLimitChange: resultLimit !== appliedResultLimitRef.current,
    }));
  }, []);

  const search = useCallback(() => {
    const center = centerRef.current;
    if (!center) return Promise.resolve();
    return performSearch(center, radiusRef.current, resultLimitRef.current);
  }, [performSearch]);

  const useLocation = useCallback((point: GeoPoint) => {
    centerRef.current = point;
    return performSearch(point, radiusRef.current, resultLimitRef.current);
  }, [performSearch]);

  return {
    state,
    setRadius,
    setResultLimit,
    search,
    useLocation,
    retryLocation,
  };
}
