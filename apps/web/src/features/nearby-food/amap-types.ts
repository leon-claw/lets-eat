export interface AmapCenter {
  lng: number;
  lat: number;
  getLng?: () => number;
  getLat?: () => number;
}

export interface AmapMapInstance {
  on(event: string, listener: () => void): void;
  off(event: string, listener: () => void): void;
  getCenter(): AmapCenter;
  destroy(): void;
}

export interface AmapPlaceSearchOptions {
  type: string;
  pageSize: number;
  pageIndex: number;
  extensions: 'base' | 'all';
}

export interface AmapPlaceSearchInstance {
  searchNearBy(
    keyword: string,
    center: [number, number],
    radiusMeters: number,
    callback: (status: string, result: unknown) => void,
  ): void;
}

export interface AmapNamespace {
  Map: new (container: HTMLElement, options: { center: [number, number]; zoom: number }) => AmapMapInstance;
  PlaceSearch?: new (options: AmapPlaceSearchOptions) => AmapPlaceSearchInstance;
  plugin(name: string, callback: () => void): void;
}

declare global {
  interface Window {
    AMap?: AmapNamespace;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}
