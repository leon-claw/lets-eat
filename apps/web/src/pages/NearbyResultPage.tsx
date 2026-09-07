import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNearbyRoundStore } from '@/features/nearby-food/nearby-storage';
import type { NearbyRoundSession } from '@/features/nearby-food/types';
import type { NearbyRoundStore } from '@/features/nearby-food/nearby-round';
import { SingleRoundResultView } from '@/features/single-round/components/SingleRoundResultView';

interface NearbyResultPageProps {
  roundStore?: NearbyRoundStore;
}

const browserRoundStore = createNearbyRoundStore();

export function NearbyResultPage({ roundStore = browserRoundStore }: NearbyResultPageProps) {
  const navigate = useNavigate();
  const session = roundStore.load();
  const choices = useMemo(() => {
    if (!session) return [];
    return session.choices
      .filter((choice) => session.decisions[choice.id] === 'liked');
  }, [session]);

  const leave = () => {
    roundStore.clear();
    navigate('/single/dataset', { replace: true });
  };

  return <SingleRoundResultView choices={choices} loaded onLeave={leave} leaveLabel="返回菜品数据集" />;
}

export type { NearbyRoundSession };
