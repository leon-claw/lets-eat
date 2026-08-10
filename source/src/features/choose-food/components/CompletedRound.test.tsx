import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import { CompletedRound } from './CompletedRound';

const likedChoice: FoodChoice = {
  id: 'cantonese',
  name: '粤菜',
  description: '清鲜细腻。',
  coverImage: 'https://example.com/cantonese.jpg',
  tags: ['清鲜', '聚餐'],
  representativeFoods: ['白切鸡', '烧鹅'],
};

describe('CompletedRound', () => {
  it('restores the original completion surface and its actions', async () => {
    const user = userEvent.setup();
    const onOpenDecision = vi.fn();
    const onOpenCandidates = vi.fn();
    const onRestart = vi.fn();

    render(
      <CompletedRound
        likedChoices={[likedChoice]}
        onOpenDecision={onOpenDecision}
        onOpenCandidates={onOpenCandidates}
        onRestart={onRestart}
      />,
    );

    expect(screen.getByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
    expect(screen.getByText('1', { selector: 'span' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '今天吃什么？摇号帮你决断！' }));
    await user.click(screen.getByRole('button', { name: '查看备选清单 (1)' }));
    await user.click(screen.getByRole('button', { name: '再刷一遍' }));

    expect(onOpenDecision).toHaveBeenCalledOnce();
    expect(onOpenCandidates).toHaveBeenCalledOnce();
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('offers only a new round when nothing was selected', () => {
    render(
      <CompletedRound
        likedChoices={[]}
        onOpenDecision={vi.fn()}
        onOpenCandidates={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.getByText(/你还没有选中菜系/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /查看备选清单/ })).not.toBeInTheDocument();
  });
});
