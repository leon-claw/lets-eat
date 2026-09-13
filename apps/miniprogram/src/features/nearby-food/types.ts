export interface MiniAmapConfig {
  key: string;
  securityJsCode: string;
}

export interface MiniGeoPoint {
  longitude: number;
  latitude: number;
}

export type MiniNearbyResultLimit = 10 | 20 | 30;

export interface MiniNearbyRestaurant {
  source: 'amap';
  id: string;
  name: string;
  type: string;
  typeCode?: string;
  categoryPath?: string[];
  location?: MiniGeoPoint;
  entranceLocation?: MiniGeoPoint;
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
}

export interface MiniNearbySearchSession {
  center: MiniGeoPoint;
  radiusMeters: number;
  restaurants: MiniNearbyRestaurant[];
  candidateRestaurants: MiniNearbyRestaurant[];
  resultLimit: MiniNearbyResultLimit;
  searchedAt: string;
}
