import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage motion hooks', () => {
  it('keeps the hero hierarchy and primary action pressable', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const logo = screen.getByRole('img', { name: '今天吃什么 Logo' });

    expect(logo).toHaveAttribute('src', '/brand-logo.png');
    expect(logo).toHaveClass('entry-pop');
    expect(screen.getByRole('heading', { name: '今天吃什么' }).parentElement).toHaveClass('entry-fade-up');
    expect(screen.getByRole('button', { name: '开始游戏' })).toHaveClass('pressable');
  });
});
