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
  it('keeps the original deck and completion flow on one page', async () => {
    const user = userEvent.setup();
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockResolvedValue([first, second]),
    };

    render(<App repository={repository} random={deterministicRandom} />);
    expect(await screen.findByRole('heading', { name: first.name, level: 2 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '喜欢 / 想吃' }));
    expect(await screen.findByRole('heading', { name: second.name, level: 2 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '不喜欢 / 换一个' }));
    expect(await screen.findByRole('heading', { name: '看完全部菜品啦！' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看备选清单 (1)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看备选清单 (1)' }));
    expect(screen.getByRole('dialog', { name: '备选清单 (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: first.name })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭备选清单' }));

    await user.click(screen.getByRole('button', { name: '今天吃什么？摇号帮你决断！' }));
    expect(screen.getByRole('dialog', { name: '今天吃什么？摇号决断！' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭摇号' }));

    await user.click(screen.getByRole('button', { name: '再刷一遍' }));
    expect(await screen.findByText('滑动选菜器')).toBeInTheDocument();
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
    await screen.findByRole('heading', { name: first.name, level: 2 });
    await user.click(screen.getByRole('button', { name: '不喜欢 / 换一个' }));
    await screen.findByRole('heading', { name: second.name, level: 2 });
    await user.click(screen.getByRole('button', { name: '不喜欢 / 换一个' }));

    await waitFor(() => expect(screen.getByText(/你还没有选中菜系/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '再刷一遍' })).toBeInTheDocument();
  });
});
