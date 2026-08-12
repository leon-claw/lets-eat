import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import { ImageWithFallback } from '@/shared/components/ImageWithFallback';
import { ChoiceHeader } from './ChoiceHeader';
import { ChoiceResult } from './ChoiceResult';
import { FoodChoiceCard } from './FoodChoiceCard';

const choice: FoodChoice = {
  id: 'cantonese',
  name: '粤菜',
  description: '清鲜细腻，适合想吃得舒服的一餐。',
  coverImage: 'https://example.com/cantonese.jpg',
  tags: ['清鲜', '聚餐'],
  representativeFoods: ['白切鸡', '烧鹅'],
};

describe('food choice presentation components', () => {
  it('renders the title and progress', () => {
    render(<ChoiceHeader current={3} total={16} />);

    expect(screen.getByRole('heading', { name: '今天吃什么' })).toBeInTheDocument();
    expect(screen.getByText('3 / 16')).toBeInTheDocument();
  });

  it('renders the food choice details', () => {
    render(<FoodChoiceCard choice={choice} />);

    expect(screen.getByRole('heading', { name: choice.name })).toBeInTheDocument();
    expect(screen.getByText('白切鸡 · 烧鹅')).toBeInTheDocument();
    expect(screen.getByText('清鲜')).toBeInTheDocument();
  });

  it('calls onRestart from the selected result', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(<ChoiceResult choice={choice} onRestart={onRestart} />);

    await user.click(screen.getByRole('button', { name: '重新选择' }));

    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('shows a fallback when the cover image fails', () => {
    render(<ImageWithFallback src={choice.coverImage} alt={choice.name} />);
    fireEvent.error(screen.getByRole('img', { name: choice.name }));

    expect(screen.getByText('图片暂不可用')).toBeInTheDocument();
  });
});
