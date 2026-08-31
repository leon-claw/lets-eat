import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import type { RoundResult, RoundSnapshot } from '@lets-eat/contracts';
import type { MultiplayerRoundClient } from '@/features/multiplayer/useMultiplayerRound';
import { createSingleRoundStore } from '@/features/single-round/single-round-store';
import { PageShell } from '@/shared/components/PageShell';
import { useFeedback } from '@/shared/components/FeedbackProvider';
import { ImageWithFallback } from '@/shared/components/ImageWithFallback';
import { SingleRoundResultView } from '@/features/single-round/components/SingleRoundResultView';

interface ResultPageProps { repository: FoodChoiceRepository; }

export interface MultiplayerResultClient extends Pick<MultiplayerRoundClient, 'getRound'> {
  getRoundResult(roundId: string): Promise<RoundResult>;
  getCustomCatalog?: MultiplayerRoundClient['getCustomCatalog'];
  clearCustomCatalog?: (roomId: string) => void;
}

export function ResultPage({ repository }: ResultPageProps) {
  const navigate = useNavigate();
  const [choices, setChoices] = useState<FoodChoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const store = createSingleRoundStore();
  const session = store.load();

  useEffect(() => {
    if (!session) { setLoaded(true); return; }
    repository.list(session.datasetType, {
      catalogVersion: session.catalogVersion,
      catalogHash: session.catalogHash,
    }).then((items) => {
      setChoices(items.filter((item) => session.decisions[item.id] === 'liked'));
    }).finally(() => setLoaded(true));
  }, [repository, session?.catalogHash, session?.catalogVersion, session?.datasetType]);

  const leave = () => {
    store.clear();
    navigate('/mode', { replace: true });
  };

  return <SingleRoundResultView choices={choices} loaded={loaded} onLeave={leave} leaveLabel="返回模式选择" />;
}

interface MultiplayerResultPageProps {
  repository: FoodChoiceRepository;
  roundId: string;
  roundClient: MultiplayerResultClient;
}

interface MultiplayerResultPlayer {
  memberId: string;
  displayName: string;
  choices: FoodChoice[];
}

export function MultiplayerResultPage({ repository, roundId, roundClient }: MultiplayerResultPageProps) {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const [round, setRound] = useState<RoundSnapshot | null>(null);
  const [commonChoices, setCommonChoices] = useState<FoodChoice[]>([]);
  const [players, setPlayers] = useState<MultiplayerResultPlayer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    void Promise.all([roundClient.getRound(roundId), roundClient.getRoundResult(roundId)])
      .then(async ([nextRound, result]) => {
        const choices = result.datasetType === 'custom'
          ? await loadCustomResultChoices(repository, roundClient, nextRound, result)
          : await repository.list(result.datasetType, {
              catalogVersion: result.catalogVersion,
              catalogHash: result.catalogHash,
            });
        if (!active) return;
        const choicesById = new Map(choices.map((choice) => [choice.id, choice]));
        const resolveChoices = (items: RoundResult['commonItems']) => items
          .map((item) => choicesById.get(item.catalogItemId))
          .filter((choice): choice is FoodChoice => choice !== undefined);
        setRound(nextRound);
        setCommonChoices(resolveChoices(result.commonItems));
        setPlayers(result.players.map((player) => ({
          memberId: player.memberId,
          displayName: player.displayName,
          choices: resolveChoices(player.items),
        })));
        if (result.datasetType === 'custom') roundClient.clearCustomCatalog?.(nextRound.roomId);
      })
      .catch((cause) => {
        if (active) {
          const message = cause instanceof Error ? cause.message : '结果加载失败，请重试';
          toast({ message, tone: 'error' });
          setError(message);
        }
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, [repository, roundClient, roundId, toast]);

  if (!loaded) return <ResultStatusPage message="正在整理大家的选择…" />;
  if (error || !round) return <ResultStatusPage message="结果暂时无法加载" detail="请重试，具体原因已通过提示显示。" error onRetry={() => window.location.reload()} />;

  return (
    <PageShell title="本轮结果">
      <section className="rounded-[2rem] bg-white p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFD100] text-3xl">🎉</div>
        <h2 className="text-2xl font-black">大家都选中的菜品</h2>
        <p className="mt-2 text-sm text-slate-500">
          {commonChoices.length > 0 ? `共有 ${commonChoices.length} 道菜是大家共同喜欢的` : '这轮暂时没有共同喜欢的菜品'}
        </p>
        {commonChoices.length > 0 && (
          <div className="mt-6 space-y-3 text-left">
            {commonChoices.map((choice) => (
              <article key={choice.id} className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3">
                <ImageWithFallback src={choice.coverImage} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-black text-amber-950">{choice.name}</h3>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-8 border-t border-slate-100 pt-6 text-left">
          <h3 className="text-lg font-black text-slate-950">所有玩家选中的菜品</h3>
          <div className="mt-4 space-y-4">
            {players.map((player) => (
              <section key={player.memberId} className="rounded-2xl bg-slate-50 p-4">
                <h4 className="font-black text-slate-900">{player.displayName}</h4>
                {player.choices.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {player.choices.map((choice) => <span key={choice.id} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-700">{choice.name}</span>)}
                  </div>
                ) : <p className="mt-2 text-sm text-slate-400">没有选中菜品</p>}
              </section>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => navigate(`/room/${round.roomId}`)} className="mt-6 w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white">返回房间</button>
      </section>
    </PageShell>
  );
}

async function loadCustomResultChoices(
  repository: FoodChoiceRepository,
  roundClient: MultiplayerResultClient,
  round: RoundSnapshot,
  result: RoundResult,
): Promise<FoodChoice[]> {
  if (!roundClient.getCustomCatalog || !repository.listByIds) throw new Error('当前客户端不支持自定义菜品');
  const customCatalog = await roundClient.getCustomCatalog(round.roomId, result.customCatalog?.selectionHash);
  if (result.customCatalog && customCatalog.selectionHash !== result.customCatalog.selectionHash) {
    throw new Error('自定义菜品版本已变化，请重新进入房间');
  }
  return repository.listByIds(customCatalog.itemIds, {
    catalogVersion: customCatalog.catalogVersion,
    catalogHash: customCatalog.catalogHash,
  });
}

function ResultStatusPage({ message, detail, error = false, onRetry }: { message: string; detail?: string; error?: boolean; onRetry?: () => void }) {
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
