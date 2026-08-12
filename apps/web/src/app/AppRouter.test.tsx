import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { AppRouter } from './AppRouter';

const choices: FoodChoice[] = Array.from({ length: 10 }, (_, index) => ({
  id: `large-${index}`,
  name: `大类 ${index + 1}`,
  description: '适合今天的用餐灵感。',
  coverImage: `https://example.com/large-${index}.jpg`,
  tags: ['测试'],
  representativeFoods: ['代表菜'],
}));

const repository: FoodChoiceRepository = {
  list: async (datasetType = 'large') => datasetType === 'large'
    ? choices
    : choices.slice(0, 2),
};

describe('AppRouter', () => {
  beforeEach(() => window.localStorage.clear());

  it('runs home to mode to dataset to the single-player game', async () => {
    const user = userEvent.setup();
    render(<AppRouter repository={repository} initialPath="/" />);

    expect(screen.queryByRole('button', { name: /返回/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    await user.click(screen.getByRole('button', { name: '单人游戏' }));
    expect(screen.getByRole('button', { name: /大类菜品.*10 条/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /大类菜品/ }));

    expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
  });

  it('keeps the group entry staged until the multiplayer flow is implemented', async () => {
    const user = userEvent.setup();
    render(<AppRouter repository={repository} initialPath="/mode" />);

    await user.click(screen.getByRole('button', { name: '组队游戏' }));

    expect(screen.getByText('组队功能正在连接中')).toBeInTheDocument();
  });

  it('moves a completed single-player round to the result page', async () => {
    const user = userEvent.setup();
    const oneChoiceRepository: FoodChoiceRepository = {
      list: async () => choices.slice(0, 1),
    };
    render(<AppRouter repository={oneChoiceRepository} initialPath="/game/single?dataset=large" />);

    await user.click(await screen.findByRole('button', { name: '喜欢' }));

    expect(await screen.findByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看备选清单 (1)' })).toBeInTheDocument();
  });
});
