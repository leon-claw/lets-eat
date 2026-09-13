import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import { SwipeDeck } from './SwipeDeck';

const choice: FoodChoice = {
  id: 'cantonese', name: '粤菜', description: '清鲜细腻，适合想吃得舒服的一餐。',
  coverImage: 'https://example.com/cantonese.jpg', tags: ['清鲜', '聚餐'], representativeFoods: ['白切鸡', '烧鹅'],
};

const nextChoice: FoodChoice = {
  id: 'hotpot', name: '火锅', description: '一锅容纳多种口味。',
  coverImage: 'https://example.com/hotpot.jpg', tags: ['热闹', '多人'], representativeFoods: ['毛肚', '肥牛'],
};

describe('SwipeDeck', () => {
  it('places the like and dislike overlays on the opposite sides of the card', () => {
    render(<SwipeDeck choice={choice} current={1} total={1} canUndo={false} onDislike={vi.fn()} onLike={vi.fn()} onUndo={vi.fn()} onInteractionLockChange={vi.fn()} />);

    const likeOverlay = screen.getAllByText('喜欢').find((element) => element.className.includes('absolute'));
    const dislikeOverlay = screen.getAllByText('不喜欢').find((element) => element.className.includes('absolute'));

    expect(likeOverlay).toHaveClass('left-6');
    expect(likeOverlay).not.toHaveClass('right-6');
    expect(likeOverlay).toHaveClass('border-emerald-500', 'bg-white', 'text-emerald-600');
    expect(likeOverlay).not.toHaveClass('bg-emerald-500', 'text-white');
    expect(dislikeOverlay).toHaveClass('right-6');
    expect(dislikeOverlay).not.toHaveClass('left-6');
    expect(dislikeOverlay).toHaveClass('border-rose-500', 'bg-white', 'text-rose-600');
    expect(dislikeOverlay).not.toHaveClass('bg-rose-500', 'text-white');
  });

  it('keeps horizontal binary controls and removes old decision controls', async () => {
    const user = userEvent.setup();
    const onDislike = vi.fn();
    const onLike = vi.fn();
    const onUndo = vi.fn();

    render(<SwipeDeck choice={choice} nextChoice={nextChoice} current={1} total={16} canUndo representativeFoodsLabel="附近门店" emphasizeRepresentativeFoods onDislike={onDislike} onLike={onLike} onUndo={onUndo} onInteractionLockChange={vi.fn()} />);

    expect(screen.getByText('滑动选菜器')).toBeInTheDocument();
    expect(screen.getByText('附近门店')).toBeInTheDocument();
    expect(screen.getByText('白切鸡 · 烧鹅')).toHaveClass('text-base', 'line-clamp-2');
    expect(screen.queryByText(/强推|必吃超赞|摇号|2人想吃/)).not.toBeInTheDocument();
    await user.click(screen.getByTitle('不喜欢'));
    await waitFor(() => expect(onDislike).toHaveBeenCalledOnce());
    await user.click(screen.getByTitle('喜欢'));
    await waitFor(() => expect(onLike).toHaveBeenCalledOnce());
    await user.click(screen.getByTitle('撤销上一划'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('keeps the original representative food section for fixed-menu games', () => {
    render(<SwipeDeck choice={choice} current={1} total={16} canUndo={false} onDislike={vi.fn()} onLike={vi.fn()} onUndo={vi.fn()} onInteractionLockChange={vi.fn()} />);

    expect(screen.getByText('代表食物')).toBeInTheDocument();
    expect(screen.getByText('白切鸡 · 烧鹅')).toHaveClass('text-sm', 'truncate');
  });

  it('附近游戏优先使用内置大类封面，而不是默认品牌图', () => {
    const nearbyChoice = { ...choice, id: 'nearby-category:cantonese', coverImage: '/brand-logo.png' };
    render(<SwipeDeck choice={nearbyChoice} current={1} total={1} canUndo={false} representativeFoodsLabel="附近门店" emphasizeRepresentativeFoods onDislike={vi.fn()} onLike={vi.fn()} onUndo={vi.fn()} onInteractionLockChange={vi.fn()} />);

    expect(screen.getByRole('img', { name: nearbyChoice.name })).toHaveAttribute('src', '/api/catalog-assets/v3/images/cantonese.webp');
  });
});
