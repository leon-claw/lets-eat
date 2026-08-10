import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoice } from '@/entities/food-choice/types';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import App from './App';

const first: FoodChoice = {
  id: 'first',
  name: '粤菜',
  description: '清鲜细腻。',
  coverImage: 'https://example.com/first.jpg',
  tags: ['清鲜', '聚餐'],
  representativeFoods: ['白切鸡', '烧鹅'],
};

const second: FoodChoice = {
  id: 'second',
  name: '火锅',
  description: '热闹满足。',
  coverImage: 'https://example.com/second.jpg',
  tags: ['热闹', '多人'],
  representativeFoods: ['毛肚', '肥牛'],
};

const deterministicRandom = () => 0.99;

describe('App', () => {
  it('completes skip, select, and restart in one page', async () => {
    const user = userEvent.setup();
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockResolvedValue([first, second]),
    };

    render(<App repository={repository} random={deterministicRandom} />);
    expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '换一个' }));
    expect(await screen.findByRole('heading', { name: second.name })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '就吃这个' }));
    expect(await screen.findByText('今天就吃')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: second.name })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新选择' }));
    expect(await screen.findByRole('button', { name: '换一个' })).toBeInTheDocument();
  });

  it('shows an empty state when no choices are available', async () => {
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockResolvedValue([]),
    };

    render(<App repository={repository} random={deterministicRandom} />);

    expect(await screen.findByText('暂时没有可选的菜系')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('retries a failed repository and renders the recovered choice', async () => {
    const user = userEvent.setup();
    const repository: FoodChoiceRepository = {
      list: vi.fn()
        .mockRejectedValueOnce(new Error('network failed'))
        .mockResolvedValueOnce([first]),
    };

    render(<App repository={repository} random={deterministicRandom} />);
    expect(await screen.findByText('加载失败，请重试')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findByRole('heading', { name: first.name })).toBeInTheDocument();
  });

  it('shows exhausted state after skipping every choice', async () => {
    const user = userEvent.setup();
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockResolvedValue([first, second]),
    };

    render(<App repository={repository} random={deterministicRandom} />);
    await screen.findByRole('heading', { name: first.name });
    await user.click(screen.getByRole('button', { name: '换一个' }));
    await screen.findByRole('heading', { name: second.name });
    await user.click(screen.getByRole('button', { name: '换一个' }));

    await waitFor(() => expect(screen.getByText('这一轮已经看完了')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '重新开始' })).toBeInTheDocument();
  });
});
