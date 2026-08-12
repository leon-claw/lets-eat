import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import { CompletedRound } from './CompletedRound';

const likedChoice: FoodChoice = {
  id: 'cantonese', name: '粤菜', description: '清鲜细腻。', coverImage: 'https://example.com/cantonese.jpg',
  tags: ['清鲜', '聚餐'], representativeFoods: ['白切鸡', '烧鹅'],
};

describe('CompletedRound', () => {
  it('shows the selected list without roulette actions', async () => {
    const user = userEvent.setup();
    const onOpenCandidates = vi.fn();
    const onRestart = vi.fn();
    render(<CompletedRound likedChoices={[likedChoice]} onOpenCandidates={onOpenCandidates} onRestart={onRestart} />);

    expect(screen.getByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
    expect(screen.queryByText(/摇号/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看备选清单 (1)' }));
    await user.click(screen.getByRole('button', { name: '再刷一遍' }));
    expect(onOpenCandidates).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('offers only a new round when nothing was selected', () => {
    render(<CompletedRound likedChoices={[]} onOpenCandidates={vi.fn()} onRestart={vi.fn()} />);
    expect(screen.getByText(/你还没有选中菜系/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /查看备选清单/ })).not.toBeInTheDocument();
  });
});
