import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FoodChoiceRepository } from '@/entities/food-choice/repository';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { GamePage } from './GamePage';

describe('GamePage feedback', () => {
  it('shows a toast when the single-player catalog cannot load', async () => {
    const repository: FoodChoiceRepository = {
      list: vi.fn().mockRejectedValue(new Error('菜单读取失败')),
    };

    render(
      <FeedbackProvider>
        <MemoryRouter>
          <GamePage repository={repository} />
        </MemoryRouter>
      </FeedbackProvider>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败，请重试');
    expect(screen.getByRole('alert')).toHaveClass('feedback-toast');
  });
});
