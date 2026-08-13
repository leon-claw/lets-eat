import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { MultiplayerResultPage } from './ResultPage';

const repository: FoodChoiceRepository = {
  list: vi.fn().mockResolvedValue([
    { id: 'cantonese', name: '粤菜', description: '清鲜细腻', coverImage: '', tags: [], representativeFoods: [] },
    { id: 'hotpot', name: '火锅', description: '热闹过瘾', coverImage: '', tags: [], representativeFoods: [] },
  ]),
};

describe('MultiplayerResultPage', () => {
  it('shows the common intersection and each player liked list', async () => {
    const roundClient = {
      getRound: vi.fn().mockResolvedValue({ roomId: 'room-1' }),
      getRoundResult: vi.fn().mockResolvedValue({
        roundId: 'round-1',
        catalogVersion: 'v1',
        catalogHash: 'a'.repeat(64),
        datasetType: 'large',
        commonItems: [
          { catalogItemId: 'cantonese', order: 1 },
        ],
        players: [
          { memberId: '11111111-1111-4111-8111-111111111111', displayName: '玩家 A', items: [{ catalogItemId: 'cantonese', order: 1 }, { catalogItemId: 'hotpot', order: 2 }] },
          { memberId: '22222222-2222-4222-8222-222222222222', displayName: '玩家 B', items: [{ catalogItemId: 'cantonese', order: 1 }] },
        ],
      }),
    };

    render(
      <MemoryRouter initialEntries={['/result/round/round-1']}>
        <MultiplayerResultPage repository={repository} roundId="round-1" roundClient={roundClient as never} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '大家都选中的菜品' })).toBeInTheDocument();
    expect(screen.getAllByText('粤菜')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: '所有玩家选中的菜品' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '玩家 A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '玩家 B' })).toBeInTheDocument();
    expect(screen.getByText('火锅')).toBeInTheDocument();
    expect(screen.queryByText(/人喜欢/)).not.toBeInTheDocument();
    expect(screen.queryByText('结果页将在多人选菜流程完成后开放。')).not.toBeInTheDocument();
  });
});
