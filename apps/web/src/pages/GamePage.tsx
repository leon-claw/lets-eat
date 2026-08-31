import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { DatasetType } from '@lets-eat/contracts';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import type { MultiplayerRoundClient } from '@/features/multiplayer/useMultiplayerRound';
import { SwipeDeck } from '@/features/choose-food/components/SwipeDeck';
import { useSingleRound } from '@/features/single-round/useSingleRound';
import { useNearbyRound, type NearbyRoundStore } from '@/features/nearby-food/nearby-round';
import { useMultiplayerRound } from '@/features/multiplayer/useMultiplayerRound';
import { useFeedback } from '@/shared/components/FeedbackProvider';

interface GamePageProps {
  repository: FoodChoiceRepository;
  mode?: 'single' | 'multiplayer';
  roundId?: string;
  roundClient?: MultiplayerRoundClient;
  nearbyRoundStore?: NearbyRoundStore;
}

export function GamePage({ repository, mode = 'single', roundId, roundClient, nearbyRoundStore }: GamePageProps) {
  if (mode === 'multiplayer' && roundId && roundClient) {
    return <MultiplayerGamePage repository={repository} roundId={roundId} roundClient={roundClient} />;
  }

  return <SingleGamePage repository={repository} nearbyRoundStore={nearbyRoundStore} />;
}

function SingleGamePage({ repository, nearbyRoundStore }: { repository: FoodChoiceRepository; nearbyRoundStore?: NearbyRoundStore }) {
  const [params] = useSearchParams();
  if (params.get('dataset') === 'nearby') return <NearbySingleGamePage nearbyRoundStore={nearbyRoundStore} />;

  const datasetType: DatasetType = params.get('dataset') === 'small' ? 'small' : 'large';
  return <CatalogSingleGamePage repository={repository} datasetType={datasetType} />;
}

function CatalogSingleGamePage({ repository, datasetType }: { repository: FoodChoiceRepository; datasetType: DatasetType }) {
  const navigate = useNavigate();
  const game = useSingleRound(repository, datasetType);
  const { toast } = useFeedback();

  useEffect(() => {
    if (game.state.status !== 'exhausted') return;
    const timer = window.setTimeout(() => navigate('/result/single', { replace: true }), 0);
    return () => window.clearTimeout(timer);
  }, [game.state.status, navigate]);

  useEffect(() => {
    if (game.state.status === 'error') toast({ message: '加载失败，请重试', tone: 'error' });
  }, [game.state.status, toast]);

  if (game.state.status === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在准备今天的选项…</div>;
  if (game.state.status === 'error') return <StatusPage message="暂时无法加载菜品" detail="请重试，具体原因已通过提示显示。" error onRetry={() => navigate('/single/dataset')} />;
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

function NearbySingleGamePage({ nearbyRoundStore }: { nearbyRoundStore?: NearbyRoundStore }) {
  const navigate = useNavigate();
  const game = useNearbyRound(nearbyRoundStore);

  useEffect(() => {
    if (game.state.status !== 'exhausted') return;
    const timer = window.setTimeout(() => navigate('/result/single?mode=nearby', { replace: true }), 0);
    return () => window.clearTimeout(timer);
  }, [game.state.status, navigate]);

  if (game.state.status === 'loading') return <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] text-sm font-bold text-slate-500">正在准备附近餐厅…</div>;
  if (game.state.status === 'empty') return <StatusPage message="附近回合没有可选餐厅" detail="请返回附近菜品重新搜索。" onRetry={() => navigate('/nearby')} />;
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
          variant="nearby"
          onDislike={game.dislike}
          onLike={game.like}
          onUndo={game.undo}
          onInteractionLockChange={game.setInteractionLocked}
        />
      </main>
    </div>
  );
}

function MultiplayerGamePage({ repository, roundId, roundClient }: { repository: FoodChoiceRepository; roundId: string; roundClient: MultiplayerRoundClient }) {
  const navigate = useNavigate();
  const game = useMultiplayerRound(roundId, roundClient, repository);
  const { toast } = useFeedback();

  useEffect(() => {
    if (game.status !== 'completed') return;
    const timer = window.setTimeout(() => navigate(`/result/round/${roundId}`, { replace: true }), 0);
    return () => window.clearTimeout(timer);
  }, [game.status, navigate, roundId]);

  useEffect(() => {
    if (game.errorMessage) toast({ message: game.errorMessage, tone: 'error' });
  }, [game.errorMessage, toast]);

  if (game.status === 'loading') return <StatusPage message="正在恢复本轮选择…" />;
  if (game.status === 'error') return <StatusPage message="暂时无法恢复本轮" detail="请重试，具体原因已通过提示显示。" error onRetry={game.retry} />;
  if (game.status === 'empty') return <StatusPage message="本轮没有可选菜品" />;
  if (game.status === 'waiting') return (
    <StatusPage message="等待其他小伙伴完成选择" detail="你的选择已经安全保存，其他成员完成后会自动进入结果页。" />
  );
  if (game.status === 'syncing') return <StatusPage message="正在同步选择…" detail="请稍候，正在把本轮选择保存到房间。" />;
  if (!game.currentChoice) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center">
        <SwipeDeck
          choice={game.currentChoice}
          nextChoice={game.nextChoice}
          current={game.progress.current}
          total={game.progress.total}
          canUndo={game.canUndo}
          onDislike={game.dislike}
          onLike={game.like}
          onUndo={game.undo}
          onInteractionLockChange={game.setInteractionLocked}
        />
      </main>
    </div>
  );
}

function StatusPage({ message, detail, error = false, onRetry }: { message: string; detail?: string; error?: boolean; onRetry?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-6 text-center">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${error ? 'bg-rose-100' : 'bg-amber-100'}`}>{error ? '!' : '🍽️'}</div>
        <h1 className="text-xl font-black">{message}</h1>
        {detail && <p className="mt-3 text-sm text-slate-500">{detail}</p>}
        {onRetry && <button type="button" onClick={onRetry} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">重试</button>}
      </section>
    </div>
  );
}

export function MultiplayerGameRoute({ repository, roundClient }: { repository: FoodChoiceRepository; roundClient?: MultiplayerRoundClient }) {
  const { roundId } = useParams();
  if (!roundId || !roundClient) return <StatusPage message="正在恢复多人回合…" />;
  return <GamePage repository={repository} mode="multiplayer" roundId={roundId} roundClient={roundClient} />;
}
