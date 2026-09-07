import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { GamePage } from './GamePage';
import type { NearbyRoundSession } from '@/features/nearby-food/types';
import type { FoodChoice } from '@/entities/food-choice/types';

const nearbyChoices: FoodChoice[] = [
  {
    id: 'amap:poi-1',
    name: '蜀香楼',
    description: '餐饮服务;中餐厅;四川菜（川菜）',
    coverImage: '/brand-logo.png',
    tags: ['评分 4.8'],
    representativeFoods: ['蜀香楼'],
  },
];

describe('GamePage feedback', () => {
  it('shows a toast when the single-player catalog cannot load', async () => {
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockRejectedValue(new Error('菜单读取失败')),
    };

    render(
      <FeedbackProvider>
        <MemoryRouter>
          <GamePage repository={repository} />
        </MemoryRouter>
      </FeedbackProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败，请重试');
    expect(screen.getByRole('alert')).toHaveClass('feedback-toast');
  });

  it('nearby dataset 路由不调用固定菜单 repository', async () => {
    const repository: FoodChoiceRepository = { list: vi.fn().mockResolvedValue([]) };
    const nearbyRoundStore = {
      load: vi.fn((): NearbyRoundSession => ({
        restaurants: [1, 2, 3].map((index) => ({ source: 'amap' as const, id: `poi-${index}`, name: `餐厅 ${index}`, type: '餐饮服务;中餐厅', fetchedAt: '2026-08-31T00:00:00.000Z' })),
        choices: nearbyChoices,
        itemIds: ['sichuan'],
        decisions: {}, history: [], completedAt: null,
      })),
      save: vi.fn(),
      clear: vi.fn(),
    };

    render(
      <FeedbackProvider>
        <MemoryRouter initialEntries={['/game/single?dataset=nearby']}>
          <GamePage repository={repository} nearbyRoundStore={nearbyRoundStore} />
        </MemoryRouter>
      </FeedbackProvider>,
    );

    expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '蜀香楼' })).toHaveAttribute('src', '/brand-logo.png');
    expect(screen.getByText('餐饮服务;中餐厅;四川菜（川菜）')).toBeInTheDocument();
    expect(screen.getByText('附近门店')).toBeInTheDocument();
    expect(screen.getAllByText('蜀香楼')).toHaveLength(2);
    expect(screen.getByText('菜系详情')).toBeInTheDocument();
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('附近游戏完成后进入 /result/single?mode=nearby', async () => {
    const user = userEvent.setup();
    const repository: FoodChoiceRepository = { list: vi.fn().mockResolvedValue([]) };
    const nearbyRoundStore = {
      load: vi.fn((): NearbyRoundSession => ({
        restaurants: [{ source: 'amap' as const, id: 'poi-1', name: '餐厅 1', type: '餐饮服务;中餐厅', fetchedAt: '2026-08-31T00:00:00.000Z' }],
        choices: nearbyChoices,
        itemIds: ['sichuan'], decisions: {}, history: [], completedAt: null,
      })),
      save: vi.fn(),
      clear: vi.fn(),
    };

    render(
      <FeedbackProvider>
        <MemoryRouter initialEntries={['/game/single?dataset=nearby']}>
          <Routes>
            <Route path="/game/single" element={<GamePage repository={repository} nearbyRoundStore={nearbyRoundStore} />} />
            <Route path="/result/single" element={<ResultLocationProbe />} />
          </Routes>
        </MemoryRouter>
      </FeedbackProvider>,
    );

    await user.click(await screen.findByTitle('喜欢'));
    expect(await screen.findByTestId('result-location')).toHaveTextContent('?mode=nearby');
  });
});

function ResultLocationProbe() {
  return <output data-testid="result-location">{useLocation().search}</output>;
}
