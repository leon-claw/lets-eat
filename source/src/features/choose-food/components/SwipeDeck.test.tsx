import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import { SwipeDeck } from './SwipeDeck';

const choice: FoodChoice = {
  id: 'cantonese',
  name: '粤菜',
  description: '清鲜细腻，适合想吃得舒服的一餐。',
  coverImage: 'https://example.com/cantonese.jpg',
  tags: ['清鲜', '聚餐'],
  representativeFoods: ['白切鸡', '烧鹅'],
};

const nextChoice: FoodChoice = {
  id: 'hotpot',
  name: '火锅',
  description: '一锅容纳多种口味。',
  coverImage: 'https://example.com/hotpot.jpg',
  tags: ['热闹', '多人'],
  representativeFoods: ['毛肚', '肥牛'],
};

describe('SwipeDeck', () => {
  it('restores the original deck controls and maps their actions', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    const onLike = vi.fn();
    const onSuperlike = vi.fn();
    const onUndo = vi.fn();
    const onOpenDecision = vi.fn();
    const onInteractionLockChange = vi.fn();

    render(
      <SwipeDeck
        choice={choice}
        nextChoice={nextChoice}
        current={1}
        total={16}
        likedCount={2}
        canUndo
        onSkip={onSkip}
        onLike={onLike}
        onSuperlike={onSuperlike}
        onUndo={onUndo}
        onOpenDecision={onOpenDecision}
        onInteractionLockChange={onInteractionLockChange}
      />,
    );

    expect(screen.getByText('滑动选菜器')).toBeInTheDocument();
    expect(screen.getByText('已挑 1 / 16')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: nextChoice.name })).toBeInTheDocument();

    await user.click(screen.getByTitle('不喜欢 / 换一个'));

    await waitFor(() => expect(onSkip).toHaveBeenCalledOnce());
    await user.click(screen.getByTitle('喜欢 / 想吃'));
    await waitFor(() => expect(onLike).toHaveBeenCalledOnce());

    await user.click(screen.getByTitle('必吃榜 / 强推'));
    await waitFor(() => expect(onSuperlike).toHaveBeenCalledOnce());

    await user.click(screen.getByTitle('撤销上一划'));
    expect(onUndo).toHaveBeenCalledOnce();

    await user.click(screen.getByTitle('决策转盘摇号'));
    expect(onOpenDecision).toHaveBeenCalledOnce();
  });
});
