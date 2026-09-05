import { useEffect, useMemo, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { DatasetType } from '@lets-eat/contracts';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import type { FoodChoice } from '@/entities/food-choice/types';
import { createCustomCatalogStore, MIN_CUSTOM_CATALOG_ITEMS, type CustomCatalogStore } from '@/features/custom-catalog/custom-catalog-store';
import { createNearbyConfigStore } from '@/features/nearby-food/nearby-storage';
import type { AmapConfig } from '@/features/nearby-food/types';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';
import { ImageWithFallback } from '@/shared/components/ImageWithFallback';

interface SettingsPageProps {
  repository: FoodChoiceRepository;
  store?: CustomCatalogStore;
  amapConfigStore?: ReturnType<typeof createNearbyConfigStore>;
  defaultAmapConfig?: AmapConfig | null;
}

type Filter = 'all' | DatasetType;

const browserCustomCatalogStore = createCustomCatalogStore();
const browserAmapConfigStore = createNearbyConfigStore();
const localAmapConfig = (import.meta.env as ImportMetaEnv & {
  readonly LETS_EAT_LOCAL_AMAP_CONFIG?: AmapConfig | null;
}).LETS_EAT_LOCAL_AMAP_CONFIG ?? null;

export function SettingsPage({
  repository,
  store = browserCustomCatalogStore,
  amapConfigStore = browserAmapConfigStore,
  defaultAmapConfig = localAmapConfig,
}: SettingsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm, toast } = useFeedback();
  const [choices, setChoices] = useState<FoodChoice[]>([]);
  const [catalog, setCatalog] = useState<{ catalogVersion: string; catalogHash: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => store.load()?.itemIds ?? []);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const initialAmapConfig = amapConfigStore.load() ?? defaultAmapConfig;
  const [amapKey, setAmapKey] = useState(() => initialAmapConfig?.key ?? '');
  const [securityJsCode, setSecurityJsCode] = useState(() => initialAmapConfig?.securityJsCode ?? '');

  useEffect(() => {
    if (!repository.loadCatalog) {
      setLoading(false);
      toast({ message: '当前菜单暂时无法编辑', tone: 'error' });
      return;
    }
    void repository.loadCatalog().then((loaded) => {
      setChoices(loaded.choices);
      setCatalog({ catalogVersion: loaded.catalogVersion, catalogHash: loaded.catalogHash });
      const stored = store.load();
      const validIds = new Set(loaded.choices.map((choice) => choice.id));
      setSelectedIds(stored?.itemIds.filter((itemId) => validIds.has(itemId)) ?? []);
      setLoading(false);
    }).catch((cause) => {
      setLoading(false);
      toast({ message: cause instanceof Error ? cause.message : '菜单加载失败', tone: 'error' });
    });
  }, [repository, store, toast]);

  const visibleChoices = useMemo(() => filter === 'all'
    ? choices
    : choices.filter((choice) => choice.datasetType === filter), [choices, filter]);
  const dirty = catalog !== null && JSON.stringify(selectedIds) !== JSON.stringify(store.load()?.itemIds ?? []);

  const toggle = (itemId: string) => {
    setSelectedIds((previous) => previous.includes(itemId)
      ? previous.filter((id) => id !== itemId)
      : [...previous, itemId]);
  };

  const save = () => {
    if (!catalog) return;
    try {
      store.save({ ...catalog, itemIds: selectedIds });
      toast({ message: '自定义菜品已保存', tone: 'success' });
    } catch (cause) {
      toast({ message: cause instanceof Error ? cause.message : '保存失败', tone: 'error' });
    }
  };

  const saveAmapConfig = () => {
    const config: AmapConfig = { key: amapKey.trim(), securityJsCode: securityJsCode.trim() };
    if (!config.key || !config.securityJsCode) {
      toast({ message: '请完整填写高德 Key 和 securityJsCode', tone: 'error' });
      return;
    }
    try {
      amapConfigStore.save(config);
      toast({ message: '高德地图配置已保存', tone: 'success' });
      if (new URLSearchParams(location.search).get('return') === 'nearby') {
        navigate('/nearby', { replace: true });
      }
    } catch (cause) {
      toast({ message: cause instanceof Error ? cause.message : '高德配置保存失败', tone: 'error' });
    }
  };

  const back = async () => {
    if (!dirty || await confirm({ title: '放弃未保存的选择？', message: '返回后本次修改不会保留。', confirmLabel: '放弃修改' })) {
      navigate(-1);
    }
  };

  return (
    <PageShell title="菜品设置" onBack={() => void back()}>
      <section className="flex flex-1 flex-col gap-4">
        <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-lg">
          <p className="text-sm text-slate-300">自定义菜品</p>
          <p className="mt-2 text-3xl font-black">已选 {selectedIds.length} 道</p>
          <p className="mt-2 text-sm text-slate-400">选择至少 {MIN_CUSTOM_CATALOG_ITEMS} 道，组队时房主会带着这份菜单开始游戏。</p>
        </div>
        <section className="rounded-3xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-950">高德地图配置</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">用于搜索周围餐厅，只保存在当前设备，不会上传到 Lets Eat。</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-sky-700">Web</span>
          </div>
          <label className="mt-4 block text-sm font-bold text-slate-700">
            高德 Key
            <input value={amapKey} onChange={(event) => setAmapKey(event.target.value)} className="mt-2 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400" />
          </label>
          <label className="mt-3 block text-sm font-bold text-slate-700">
            securityJsCode
            <input value={securityJsCode} onChange={(event) => setSecurityJsCode(event.target.value)} className="mt-2 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400" />
          </label>
          <button type="button" disabled={!amapKey.trim() || !securityJsCode.trim()} onClick={saveAmapConfig} className="pressable mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">保存高德配置</button>
        </section>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm">
          {(['all', 'large', 'small'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`pressable rounded-xl px-3 py-2 text-sm font-black ${filter === value ? 'bg-[#FFD100]' : 'bg-slate-50 text-slate-500'}`}>
              {value === 'all' ? '全部' : value === 'large' ? '大类' : '小类'}
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-2">
          {loading && <p className="py-12 text-center text-sm text-slate-400">正在加载菜单…</p>}
          {!loading && visibleChoices.map((choice) => {
            const selected = selectedIds.includes(choice.id);
            return (
              <button key={choice.id} type="button" role="checkbox" aria-checked={selected} aria-label={choice.name} onClick={() => toggle(choice.id)} className={`pressable flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm ${selected ? 'border-amber-300 bg-amber-50' : 'border-transparent bg-white'}`}>
                <ImageWithFallback src={choice.coverImage} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-amber-400 bg-[#FFD100] text-slate-950' : 'border-slate-200 text-transparent'}`}><Check className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block font-black">{choice.name}</strong><small className="mt-1 block truncate text-xs text-slate-400">{choice.description}</small></span>
                <span className="text-xs font-bold text-slate-400">{choice.datasetType === 'small' ? '小类' : '大类'}</span>
              </button>
            );
          })}
        </div>
        <button type="button" disabled={!catalog || selectedIds.length < MIN_CUSTOM_CATALOG_ITEMS} onClick={save} className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFD100] px-5 py-4 font-black shadow-lg disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"><Save className="h-5 w-5" />保存自定义菜品</button>
      </section>
    </PageShell>
  );
}
