import { LocateFixed, MapPin, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { prepareRoundChoices } from '@/features/choose-food/round-choice-order';
import { aggregateNearbyRestaurantsToFoodChoices, NEARBY_FALLBACK_TEMPLATES } from '@/features/nearby-food/nearby-food-adapter';
import { type NearbyFastTextClassifier } from '@/features/nearby-food/fasttext-browser-classifier';
import { createNearbyRoundStore } from '@/features/nearby-food/nearby-storage';
import type { NearbyRoundStore } from '@/features/nearby-food/nearby-round';
import { defaultNearbyRestaurantClassifier } from '@/features/nearby-food/useNearbyRestaurantClassifications';
import type { GeoPoint } from '@/features/nearby-food/types';
import {
  NEARBY_RADIUS_OPTIONS,
  useNearbyFoodSearch,
  type NearbyFoodSearchDependencies,
} from '@/features/nearby-food/useNearbyFoodSearch';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';

interface NearbyFoodPageProps {
  searchDependencies?: NearbyFoodSearchDependencies;
  roundStore?: NearbyRoundStore;
  classifier?: NearbyFastTextClassifier;
  repository: FoodChoiceRepository;
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

async function loadNearbyFoodTemplates(repository: FoodChoiceRepository): Promise<FoodChoice[]> {
  try {
    if (repository.loadCatalog) return (await repository.loadCatalog()).choices;
    const [large, small] = await Promise.all([repository.list('large'), repository.list('small')]);
    return [...large, ...small];
  } catch (cause) {
    console.warn('[nearby-food] 使用本地内置卡片模板', cause);
    return NEARBY_FALLBACK_TEMPLATES;
  }
}

export function NearbyFoodPage({ searchDependencies, roundStore = browserRoundStore, classifier, repository }: NearbyFoodPageProps) {
  const location = useRouterLocation();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const selectedLocation = selectedLocationFromState(location.state);
  const [initialSelectedLocation] = useState(selectedLocation);
  const effectiveDependencies = useMemo(
    () => initialSelectedLocation ? { ...searchDependencies, initialLocation: initialSelectedLocation } : searchDependencies,
    [initialSelectedLocation, searchDependencies],
  );
  const search = useNearbyFoodSearch(effectiveDependencies);
  const shownError = useRef<string | null>(null);
  const activeClassifier = classifier ?? defaultNearbyRestaurantClassifier;
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!selectedLocation) return;
    navigate('/nearby', { replace: true, state: null });
  }, [navigate, selectedLocation]);

  useEffect(() => {
    if (search.state.status !== 'error' || !search.state.errorMessage || shownError.current === search.state.errorMessage) return;
    shownError.current = search.state.errorMessage;
    toast({ message: search.state.errorMessage, tone: 'error' });
  }, [search.state.errorMessage, search.state.status, toast]);

  useEffect(() => {
    if (search.state.status === 'location-fallback') navigate('/nearby/location', { replace: true });
  }, [navigate, search.state.status]);

  const isBusy = search.state.status === 'locating' || search.state.status === 'searching';
  const hasPendingSearchChange = search.state.hasPendingRadiusChange || search.state.hasPendingResultLimitChange;
  const candidateRestaurants = search.state.candidateRestaurants.length > 0
    ? search.state.candidateRestaurants
    : search.state.restaurants;
  const canStart = candidateRestaurants.length >= 3
    && !hasPendingSearchChange
    && !isBusy
    && !isStarting;
  const startGame = async () => {
    if (!canStart) return;
    setIsStarting(true);
    try {
      await activeClassifier.ready();
      const classifications = new Map(
        await Promise.all(candidateRestaurants.map(async (restaurant) => [
          restaurant.id,
          await activeClassifier.classify(restaurant.name, restaurant.type),
        ] as const)),
      );
      const templates = await loadNearbyFoodTemplates(repository);
      const choices = aggregateNearbyRestaurantsToFoodChoices(candidateRestaurants, classifications, templates);
      if (choices.length === 0) {
        toast({ message: '附近商家暂时没有可识别的大类菜品，请扩大范围或重新搜索', tone: 'error' });
        return;
      }
      const itemIds = prepareRoundChoices(choices).map(({ id }) => id);
      roundStore.save({
        restaurants: search.state.restaurants,
        choices,
        itemIds,
        decisions: {},
        history: [],
        completedAt: null,
      });
      navigate('/game/single?dataset=nearby');
    } catch (cause) {
      console.error('[nearby-food] 准备游戏失败', cause);
      toast({
        message: cause instanceof Error ? `暂时无法准备附近菜品：${cause.message}` : '暂时无法准备附近菜品，请重试',
        tone: 'error',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <PageShell title="周围菜品">
      <section className="flex flex-1 flex-col gap-4">
        <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Nearby food</p>
              <h2 className="mt-2 text-2xl font-black">从附近开始挑</h2>
              <p className="mt-2 text-sm text-slate-300">评分最高的门店，滑动选择今天去哪吃。</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-400/20 text-sky-200"><MapPin className="h-6 w-6" /></div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-200">
            <div className="flex min-w-0 items-center gap-2" role="status">
              <span className={`h-2 w-2 shrink-0 rounded-full ${search.state.status === 'locating' ? 'bg-amber-300' : search.state.center ? 'bg-emerald-300' : 'bg-amber-300'}`} />
              <span className="truncate">{search.state.status === 'locating' ? '正在获取当前位置' : search.state.center ? '已准备搜索位置' : '正在准备搜索位置'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-sm font-black text-slate-700">搜索范围
              <select aria-label="搜索范围" value={search.state.radiusMeters} onChange={(event) => search.setRadius(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none focus:border-sky-400">
                {NEARBY_RADIUS_OPTIONS.map((radius) => <option key={radius} value={radius}>{radiusLabel(radius)}</option>)}
              </select>
            </label>
          </div>
          <button type="button" aria-label="更换位置" onClick={() => navigate('/nearby/location')} className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"><MapPin className="h-4 w-4 text-sky-600" />更换位置</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={!search.state.center || isBusy} onClick={() => void search.search()} className="pressable flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="h-4 w-4 text-sky-600" />{search.state.status === 'searching' ? '搜索中…' : '重新搜索'}</button>
          <button type="button" disabled={isBusy} onClick={() => void search.retryLocation()} className="pressable flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><LocateFixed className="h-4 w-4 text-sky-600" />{search.state.status === 'locating' ? '定位中…' : '定位到我'}</button>
        </div>

        <div className="space-y-2">
          <button type="button" disabled={!canStart} onClick={() => void startGame()} className="pressable flex w-full items-center justify-center rounded-2xl bg-[#FFD100] px-4 py-4 font-black text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">{hasPendingSearchChange ? '请先重新搜索' : isStarting ? '正在准备游戏…' : '开始游戏'}</button>
          <button type="button" onClick={() => navigate('/single/dataset')} className="pressable flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg hover:bg-slate-800">退出周围菜品</button>
        </div>

        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-black text-slate-900">{search.state.restaurants.length > 0 ? `找到 ${search.state.restaurants.length} 家餐厅` : '附近餐厅'}</p>
            <p className="mt-1 text-xs text-slate-400">显示评分最高的 {search.state.resultLimit} 家；开始游戏将从 {candidateRestaurants.length} 家候选门店聚合</p>
          </div>
        </div>

        {search.state.status === 'searching' && <div className="rounded-3xl bg-white px-5 py-8 text-center text-sm font-bold text-slate-500 shadow-sm"><Search className="mx-auto mb-3 h-7 w-7 animate-pulse text-sky-500" />正在搜索附近餐厅…</div>}
        {search.state.status === 'empty' && <div className="rounded-3xl bg-white px-5 py-8 text-center text-sm font-bold text-slate-500 shadow-sm">附近没有找到餐厅<br /><span className="mt-2 block text-xs font-normal text-slate-400">可以更换位置或扩大搜索范围。</span></div>}
        {search.state.status === 'insufficient' && <div className="rounded-3xl bg-amber-50 px-5 py-4 text-center text-sm font-bold text-amber-800">有效评分门店不足 3 家</div>}
        {search.state.status === 'error' && (
          <div className="rounded-3xl bg-rose-50 px-5 py-4 text-center text-sm font-bold text-rose-800">
            {search.state.restaurants.length > 0
              ? '本次操作失败，仍保留上次结果。可以重新定位或重新搜索。'
              : '本次搜索失败，请检查配置或更换位置后重试。'}
          </div>
        )}
        {search.state.errorCode === 'INVALID_CONFIG' && <button type="button" onClick={() => navigate('/settings?return=nearby')} className="pressable rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-black text-rose-700 shadow-sm">前往设置</button>}

      </section>
    </PageShell>
  );
}
