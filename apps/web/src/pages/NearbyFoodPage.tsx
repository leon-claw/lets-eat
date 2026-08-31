import { MapPin, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { createNearbyRoundStore } from '@/features/nearby-food/nearby-storage';
import { nearbyRestaurantsToFoodChoices } from '@/features/nearby-food/nearby-food-adapter';
import { prepareRoundChoices } from '@/features/choose-food/round-choice-order';
import type { GeoPoint, NearbyRoundSession } from '@/features/nearby-food/types';
import {
  DEFAULT_NEARBY_RADIUS_METERS,
  NEARBY_RADIUS_OPTIONS,
  useNearbyFoodSearch,
  type NearbyFoodSearchDependencies,
} from '@/features/nearby-food/useNearbyFoodSearch';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';

interface NearbyRoundStore {
  load(): NearbyRoundSession | null;
  save(value: NearbyRoundSession): void;
  clear(): void;
}

interface NearbyFoodPageProps {
  searchDependencies?: NearbyFoodSearchDependencies;
  roundStore?: NearbyRoundStore;
}

const browserRoundStore = createNearbyRoundStore();

function selectedLocationFromState(state: unknown): GeoPoint | undefined {
  if (typeof state !== 'object' || state === null || !('selectedLocation' in state)) return undefined;
  const selectedLocation = state.selectedLocation;
  if (typeof selectedLocation !== 'object' || selectedLocation === null) return undefined;
  const candidate = selectedLocation as Record<string, unknown>;
  if (typeof candidate.longitude !== 'number' || typeof candidate.latitude !== 'number') return undefined;
  return { longitude: candidate.longitude, latitude: candidate.latitude };
}

function radiusLabel(radiusMeters: number): string {
  return radiusMeters >= 1000 ? `${radiusMeters / 1000} 公里` : `${radiusMeters} 米`;
}

export function NearbyFoodPage({ searchDependencies, roundStore = browserRoundStore }: NearbyFoodPageProps) {
  const location = useRouterLocation();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const selectedLocation = selectedLocationFromState(location.state);
  const effectiveDependencies = useMemo(
    () => selectedLocation ? { ...searchDependencies, initialLocation: selectedLocation } : searchDependencies,
    [searchDependencies, selectedLocation],
  );
  const search = useNearbyFoodSearch(effectiveDependencies);
  const shownError = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedLocation) return;
    navigate('/nearby', { replace: true, state: null });
  }, [navigate, selectedLocation]);

  useEffect(() => {
    if (search.state.status !== 'error' || !search.state.errorMessage || shownError.current === search.state.errorMessage) return;
    shownError.current = search.state.errorMessage;
    toast({ message: search.state.errorMessage, tone: 'error' });
  }, [search.state.errorMessage, search.state.status, toast]);

  const startGame = () => {
    if (search.state.restaurants.length < 3 || search.state.hasPendingRadiusChange || search.state.status === 'searching') return;
    const itemIds = prepareRoundChoices(nearbyRestaurantsToFoodChoices(search.state.restaurants)).map((choice) => choice.id);
    roundStore.save({
      restaurants: search.state.restaurants,
      itemIds,
      decisions: {},
      history: [],
      completedAt: null,
    });
    navigate('/game/single?dataset=nearby');
  };

  const canStart = search.state.restaurants.length >= 3
    && !search.state.hasPendingRadiusChange
    && search.state.status !== 'searching';

  return (
    <PageShell title="周围菜品">
      <section className="flex flex-1 flex-col gap-4">
        <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Nearby food</p>
              <h2 className="mt-2 text-2xl font-black">从附近开始挑</h2>
              <p className="mt-2 text-sm text-slate-300">搜索结果按高德综合排序展示，滑完后再决定今天去哪吃。</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-400/20 text-sky-200"><MapPin className="h-6 w-6" /></div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-200" role="status">
            <span className={`h-2 w-2 rounded-full ${search.state.center ? 'bg-emerald-300' : 'bg-amber-300'}`} />
            {search.state.center ? '已准备搜索位置' : '正在准备搜索位置'}
          </div>
        </div>

        <div className="flex items-end gap-3 rounded-3xl bg-white p-4 shadow-sm">
          <label className="min-w-0 flex-1 text-sm font-black text-slate-700">搜索范围
            <select aria-label="搜索范围" value={search.state.radiusMeters} onChange={(event) => search.setRadius(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-sky-400">
              {NEARBY_RADIUS_OPTIONS.map((radius) => <option key={radius} value={radius}>{radiusLabel(radius)}</option>)}
            </select>
          </label>
          <button type="button" aria-label="更换位置" onClick={() => navigate('/nearby/location')} className="pressable flex h-12 shrink-0 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-sm font-black text-slate-700 hover:bg-slate-50"><MapPin className="h-4 w-4 text-sky-600" />更换位置</button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-black text-slate-900">{search.state.restaurants.length > 0 ? `找到 ${search.state.restaurants.length} 家餐厅` : '附近餐厅'}</p>
            <p className="mt-1 text-xs text-slate-400">范围改变后，点击重新搜索才会更新结果</p>
          </div>
          <button type="button" disabled={!search.state.center || search.state.status === 'searching'} onClick={() => void search.search()} className="pressable inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-2 text-xs font-black text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />{search.state.status === 'searching' ? '搜索中…' : '重新搜索'}</button>
        </div>

        {search.state.status === 'searching' && <div className="rounded-3xl bg-white px-5 py-8 text-center text-sm font-bold text-slate-500 shadow-sm"><Search className="mx-auto mb-3 h-7 w-7 animate-pulse text-sky-500" />正在搜索附近餐厅…</div>}
        {search.state.status === 'empty' && <div className="rounded-3xl bg-white px-5 py-8 text-center text-sm font-bold text-slate-500 shadow-sm">附近没有找到餐厅<br /><span className="mt-2 block text-xs font-normal text-slate-400">可以更换位置或扩大搜索范围。</span></div>}
        {search.state.status === 'insufficient' && <div className="rounded-3xl bg-amber-50 px-5 py-4 text-center text-sm font-bold text-amber-800">至少需要 3 家餐厅才能开始游戏</div>}
        {search.state.status === 'error' && <div className="rounded-3xl bg-rose-50 px-5 py-4 text-center text-sm font-bold text-rose-800">本次搜索失败，仍保留上次结果。点击重新搜索再试一次。</div>}
        {search.state.errorCode === 'INVALID_CONFIG' && <button type="button" onClick={() => navigate('/settings?return=nearby')} className="pressable rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-black text-rose-700 shadow-sm">前往设置</button>}

        {search.state.restaurants.length > 0 && (
          <div className="space-y-2" aria-label="附近餐厅列表">
            {search.state.restaurants.map((restaurant) => (
              <article key={restaurant.id} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><UtensilsIcon /></div>
                <div className="min-w-0"><h3 className="truncate font-black text-slate-900">{restaurant.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{restaurant.type || '餐饮服务'}</p></div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-2 pt-2">
          <button type="button" disabled={!canStart} onClick={startGame} className="pressable flex w-full items-center justify-center rounded-2xl bg-[#FFD100] px-4 py-4 font-black text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">{search.state.hasPendingRadiusChange ? '请先重新搜索' : '开始游戏'}</button>
          <button type="button" onClick={() => navigate('/single/dataset')} className="pressable w-full rounded-2xl px-4 py-3 text-sm font-black text-slate-500 hover:bg-white">退出周围菜品</button>
        </div>
      </section>
    </PageShell>
  );
}

function UtensilsIcon() {
  return <span aria-hidden="true" className="text-lg">🍽️</span>;
}
