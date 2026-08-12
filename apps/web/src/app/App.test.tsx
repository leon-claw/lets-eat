import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import App from './App';

const choices: FoodChoice[] = [{
  id: 'cantonese',
  name: '粤菜',
  description: '清鲜细腻。',
  coverImage: 'https://example.com/cantonese.jpg',
  tags: ['清鲜'],
  representativeFoods: ['白切鸡'],
}];

describe('App', () => {
  it('renders the confirmed home page and starts the single-player flow', async () => {
    const user = userEvent.setup();
    const repository: FoodChoiceRepository = {
      list: async () => choices,
    };

    render(<App repository={repository} />);

    expect(screen.getByRole('heading', { name: '今天吃什么' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /返回/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(screen.getByRole('heading', { name: '选择游戏模式' })).toBeInTheDocument();
  });
});
