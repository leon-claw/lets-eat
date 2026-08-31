import { Crosshair, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMapPicker, loadAmap } from '@/features/nearby-food/amap-map';
import type { AmapNamespace } from '@/features/nearby-food/amap-types';
import { CITY_CENTERS, getCitiesForProvince } from '@/features/nearby-food/city-centers';
import {
  createNearbyConfigStore,
  createNearbyLocationStore,
  createNearbySearchSessionStore,
} from '@/features/nearby-food/nearby-storage';
import type { AmapConfig, GeoPoint } from '@/features/nearby-food/types';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';

type MapPicker = { getCenter(): GeoPoint; destroy(): void };

interface NearbyLocationPageProps {
  configStore?: ReturnType<typeof createNearbyConfigStore>;
  locationStore?: ReturnType<typeof createNearbyLocationStore>;
  searchSessionStore?: ReturnType<typeof createNearbySearchSessionStore>;
  loadMap?: (config: AmapConfig) => Promise<AmapNamespace>;
  createPicker?: (options: { container: HTMLElement; initialCenter: GeoPoint; amap: AmapNamespace }) => MapPicker;
}

const browserConfigStore = createNearbyConfigStore();
const browserLocationStore = createNearbyLocationStore();
const browserSearchSessionStore = createNearbySearchSessionStore();

export function NearbyLocationPage({
  configStore = browserConfigStore,
  locationStore = browserLocationStore,
  searchSessionStore = browserSearchSessionStore,
  loadMap = loadAmap,
  createPicker = createMapPicker,
}: NearbyLocationPageProps) {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const config = configStore.load();
  const cachedCenter = useMemo(() => searchSessionStore.load()?.center ?? locationStore.load(), [locationStore, searchSessionStore]);
  const [center, setCenter] = useState<GeoPoint | null>(cachedCenter);
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [mapStatus, setMapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const mapContainer = useRef<HTMLDivElement>(null);
  const picker = useRef<MapPicker | null>(null);
  const cities = getCitiesForProvince(province);

  useEffect(() => {
    if (!center || !config || !mapContainer.current) return undefined;
    let active = true;
    setMapStatus('loading');
    void loadMap(config).then((amap) => {
      if (!active || !mapContainer.current) return;
      picker.current?.destroy();
      picker.current = createPicker({ container: mapContainer.current, initialCenter: center, amap });
      setMapStatus('ready');
    }).catch((cause) => {
      if (!active) return;
      setMapStatus('error');
      toast({ message: cause instanceof Error ? cause.message : '地图加载失败，请重试', tone: 'error' });
    });
    return () => {
      active = false;
      picker.current?.destroy();
      picker.current = null;
    };
  }, [center, config, createPicker, loadMap, toast]);

  if (!config) {
    return (
      <PageShell title="选择位置">
        <section className="rounded-3xl bg-white p-6 text-center shadow-lg">
          <MapPin className="mx-auto h-10 w-10 text-sky-600" />
          <h2 className="mt-4 text-xl font-black">先配置高德地图</h2>
          <p className="mt-2 text-sm text-slate-500">完成配置后才能在地图上选择附近餐厅。</p>
          <button type="button" onClick={() => navigate('/settings?return=nearby')} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">前往设置</button>
        </section>
      </PageShell>
    );
  }

  const selectProvince = (value: string) => {
    setProvince(value);
    setCity('');
    setCenter(null);
  };
  const selectCity = (value: string) => {
    setCity(value);
    setCenter(cities.find((item) => item.name === value)?.center ?? null);
  };
  const useCurrentCenter = () => {
    const selectedCenter = picker.current?.getCenter() ?? center;
    if (!selectedCenter) return;
    navigate('/nearby', { replace: true, state: { selectedLocation: selectedCenter } });
  };

  return (
    <PageShell title="选择位置">
      <section className="flex flex-1 flex-col gap-4">
        {!center && (
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><MapPin className="h-5 w-5" /></div>
              <div><h2 className="font-black">先选一个城市</h2><p className="mt-1 text-xs text-slate-500">之后可以拖动地图微调中心位置</p></div>
            </div>
            <label className="mt-5 block text-sm font-bold text-slate-700">省份
              <select aria-label="省份" value={province} onChange={(event) => selectProvince(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400">
                <option value="">请选择省份</option>
                {CITY_CENTERS.map((item) => <option key={item.province} value={item.province}>{item.province}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-bold text-slate-700">城市
              <select aria-label="城市" value={city} onChange={(event) => selectCity(event.target.value)} disabled={!province} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-sky-400 disabled:text-slate-400">
                <option value="">请选择城市</option>
                {cities.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </label>
          </div>
        )}
        {center && (
          <div className="relative min-h-[min(62vh,520px)] flex-1 overflow-hidden rounded-[2rem] bg-slate-200 shadow-lg">
            <div ref={mapContainer} className="absolute inset-0" aria-label="高德地图" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><Crosshair className="h-10 w-10 text-sky-700 drop-shadow" strokeWidth={2.5} /></div>
            {mapStatus === 'loading' && <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">正在加载地图…</p>}
            {mapStatus === 'error' && <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 shadow-sm">地图暂时无法加载</p>}
          </div>
        )}
        <button type="button" disabled={!center || mapStatus !== 'ready'} onClick={useCurrentCenter} className="pressable w-full rounded-2xl bg-[#FFD100] px-4 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">使用此位置</button>
      </section>
    </PageShell>
  );
}
