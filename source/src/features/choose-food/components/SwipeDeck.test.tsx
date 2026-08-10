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

describe('SwipeDeck', () => {
  it('exposes skip as a button action', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    const onSelect = vi.fn();
    const onInteractionLockChange = vi.fn();

    render(
      <SwipeDeck
        choice={choice}
        onSkip={onSkip}
        onSelect={onSelect}
        onInteractionLockChange={onInteractionLockChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '换一个' }));

    await waitFor(() => expect(onSkip).toHaveBeenCalledOnce());
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('exposes select as a button action', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    const onSelect = vi.fn();

    render(
      <SwipeDeck
        choice={choice}
        onSkip={onSkip}
        onSelect={onSelect}
        onInteractionLockChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '就吃这个' }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce());
    expect(onSkip).not.toHaveBeenCalled();
  });
});
