import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NearbyRoundSession } from '@/features/nearby-food/types';
import { NearbyResultPage } from './NearbyResultPage';

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function createStore(session: NearbyRoundSession) {
  return { load: vi.fn(() => session), save: vi.fn(), clear: vi.fn() };
}

describe('NearbyResultPage', () => {
  it('附近结果页展示已喜欢的餐厅并复用备选清单交互', async () => {
    const user = userEvent.setup();
    const roundStore = createStore({
      restaurants: [1, 2, 3].map((index) => ({
        source: 'amap' as const,
        id: `poi-${index}`,
        name: `餐厅 ${index}`,
        type: '餐饮服务;中餐厅',
        fetchedAt: '2026-08-31T00:00:00.000Z',
      })),
      choices: [
        { id: 'amap:poi-1', name: '餐厅 1', description: '餐饮服务;中餐厅', coverImage: '/brand-logo.png', tags: ['评分 4.8'], representativeFoods: ['餐厅 1'] },
        { id: 'amap:poi-2', name: '餐厅 2', description: '餐饮服务;中餐厅', coverImage: '/brand-logo.png', tags: ['评分 4.6'], representativeFoods: ['餐厅 2'] },
      ],
      itemIds: ['amap:poi-1', 'amap:poi-2'],
      decisions: { 'amap:poi-1': 'liked', 'amap:poi-2': 'disliked' },
      history: ['amap:poi-1', 'amap:poi-2'],
      completedAt: '2026-08-31T00:00:00.000Z',
    });

    render(
      <MemoryRouter initialEntries={['/result/single?mode=nearby']}>
        <Routes>
          <Route path="/result/single" element={<NearbyResultPage roundStore={roundStore} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
    expect(screen.getByText('餐厅 1')).toBeInTheDocument();
    expect(screen.queryByText('餐厅 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看备选清单 (1)' }));
    expect(screen.getByRole('heading', { name: '备选清单 (1)' })).toBeInTheDocument();
    expect(screen.getAllByText('餐厅 1')).toHaveLength(2);
  });

  it('结束后清理附近回合存储，但不清理附近搜索会话', async () => {
    const user = userEvent.setup();
    const roundStore = createStore({ restaurants: [], choices: [], itemIds: [], decisions: {}, history: [], completedAt: null });
    render(
      <MemoryRouter initialEntries={['/result/single?mode=nearby']}>
        <Routes>
          <Route path="/result/single" element={<NearbyResultPage roundStore={roundStore} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '返回菜品数据集' }));
    expect(roundStore.clear).toHaveBeenCalledOnce();
    expect(screen.getByTestId('location')).toHaveTextContent('/single/dataset');
  });
});
