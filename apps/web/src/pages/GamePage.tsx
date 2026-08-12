import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { DatasetType } from '@lets-eat/contracts';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { SwipeDeck } from '@/features/choose-food/components/SwipeDeck';
import { useSingleRound } from '@/features/single-round/useSingleRound';

interface GamePageProps { repository: FoodChoiceRepository; }

export function GamePage({ repository }: GamePageProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const datasetType: DatasetType = params.get('dataset') === 'small' ? 'small' : 'large';
  const game = useSingleRound(repository, datasetType);

  useEffect(() => {
    if (game.state.status !== 'exhausted') return;
    const timer = window.setTimeout(() => navigate('/result/single', { replace: true }), 0);
    return () => window.clearTimeout(timer);
  }, [game.state.status, navigate]);

  if (game.state.status === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在准备今天的选项…</div>;
  if (game.state.status === 'error') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-rose-500">加载失败，请返回重试</div>;
  if (game.state.status === 'empty') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">暂时没有可选菜品</div>;
  if (!game.currentChoice) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <SwipeDeck
          choice={game.currentChoice}
          nextChoice={game.nextChoice}
          current={game.progress.current}
          total={game.progress.total}
          canUndo={game.state.history.length > 0}
          onDislike={game.dislike}
          onLike={game.like}
          onUndo={game.undo}
          onInteractionLockChange={game.setInteractionLocked}
        />
      </main>
    </div>
  );
}
