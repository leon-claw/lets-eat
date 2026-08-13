import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BackButton } from './BackButton';
import { PageShell } from './PageShell';

describe('entry motion hooks', () => {
  it('exposes stable hooks for page entry and shared back-button feedback', () => {
    render(
      <MemoryRouter>
        <PageShell title="测试页面">
          <BackButton />
        </PageShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('main')).toHaveClass('page-shell-enter');
    expect(screen.getAllByTestId('page-back-button')[0]).toHaveClass('pressable');
  });
});
