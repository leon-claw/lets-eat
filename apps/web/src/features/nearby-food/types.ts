import type { Decision } from '@lets-eat/contracts';
import type { FoodChoice } from '@/entities/food-choice/types';

export type GeoPoint = {
  longitude: number;
  latitude: number;
};

export type AmapConfig = {
  key: string;
  securityJsCode: string;
};

export type NearbyResultLimit = 10 | 20 | 30;

export type NearbyRestaurant = {
  source: 'amap';
  id: string;
  name: string;
  type: string;
  typeCode?: string;
  categoryPath?: string[];
  location?: GeoPoint;
  entranceLocation?: GeoPoint;
  distanceMeters?: number;
  rating?: number;
  imageUrl?: string;
  address?: string;
  province?: string;
  provinceCode?: string;
  city?: string;
  cityCode?: string;
  district?: string;
  districtCode?: string;
  businessArea?: string;
  telephone?: string;
  website?: string;
  email?: string;
  businessHours?: string;
  businessStatus?: string;
  fetchedAt: string;
  providerData?: unknown;
};

export type NearbySearchSession = {
  center: GeoPoint;
  radiusMeters: number;
  restaurants: NearbyRestaurant[];
  candidateRestaurants?: NearbyRestaurant[];
  resultLimit?: NearbyResultLimit;
  searchedAt: string;
};

export type NearbyRoundSession = {
  restaurants: NearbyRestaurant[];
  choices: FoodChoice[];
  itemIds: string[];
  decisions: Record<string, Decision>;
  history: string[];
  completedAt: string | null;
};
