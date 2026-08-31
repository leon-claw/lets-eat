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

export interface AmapNamespace {
  Map: new (container: HTMLElement, options: { center: [number, number]; zoom: number }) => AmapMapInstance;
}

declare global {
  interface Window {
    AMap?: AmapNamespace;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}
