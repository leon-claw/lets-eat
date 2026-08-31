import { useEffect, useState } from 'react';
import { MapPin, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DatasetType } from '@lets-eat/contracts';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { createNearbyConfigStore } from '@/features/nearby-food/nearby-storage';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';

interface DatasetPageProps {
  repository: FoodChoiceRepository;
  amapConfigStore?: ReturnType<typeof createNearbyConfigStore>;
}

const browserAmapConfigStore = createNearbyConfigStore();

export function DatasetPage({ repository, amapConfigStore = browserAmapConfigStore }: DatasetPageProps) {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [counts, setCounts] = useState({ large: 0, small: 0 });

  useEffect(() => {
    Promise.all([repository.list('large'), repository.list('small')]).then(([large, small]) => {
      setCounts({ large: large.length, small: small.length });
    }).catch((cause) => {
      console.error('加载菜单统计失败', cause);
      toast({ message: cause instanceof Error ? cause.message : '菜单统计加载失败', tone: 'error' });
      setCounts({ large: 0, small: 0 });
    });
  }, [repository, toast]);

  const choose = (datasetType: DatasetType) => navigate(`/game/single?dataset=${datasetType}`);
  const chooseNearby = () => navigate(amapConfigStore.load() ? '/nearby' : '/settings?return=nearby');
  return (
    <PageShell title="确认菜品数据集">
      <section className="space-y-4">
        <p className="mb-6 text-center text-sm text-slate-500">今天想从哪一类菜品开始？</p>
        <button type="button" onClick={() => choose('large')} className="w-full rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-md transition hover:-translate-y-0.5">
          <span className="flex items-center gap-3"><Utensils className="h-6 w-6 text-amber-500" /><strong className="text-lg">大类菜品</strong><span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">{counts.large} 条</span></span>
          <span className="mt-3 block text-sm text-slate-500">西餐、中餐、日料等大分类</span>
        </button>
        <button type="button" onClick={() => choose('small')} className="w-full rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-md transition hover:-translate-y-0.5">
          <span className="flex items-center gap-3"><Utensils className="h-6 w-6 text-rose-500" /><strong className="text-lg">小类菜品</strong><span className="ml-auto rounded-full bg-rose-100 px-3 py-1 text-sm font-black text-rose-700">{counts.small} 条</span></span>
          <span className="mt-3 block text-sm text-slate-500">螺蛳粉、火锅、披萨等小分类</span>
        </button>
        <button type="button" onClick={chooseNearby} className="pressable hover-lift w-full rounded-3xl border border-sky-100 bg-sky-50 p-5 text-left shadow-md">
          <span className="flex items-center gap-3"><MapPin className="h-6 w-6 text-sky-600" /><strong className="text-lg">周围菜品</strong><span className="ml-auto rounded-full bg-white px-3 py-1 text-sm font-black text-sky-700">附近</span></span>
          <span className="mt-3 block text-sm text-slate-500">按位置搜索附近餐厅，再滑动选择今天吃什么</span>
        </button>
      </section>
    </PageShell>
  );
}
