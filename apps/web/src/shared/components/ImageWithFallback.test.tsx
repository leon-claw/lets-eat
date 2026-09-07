import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageWithFallback } from './ImageWithFallback';

describe('ImageWithFallback', () => {
  it('renders a blank-image placeholder when no image is configured', () => {
    render(<ImageWithFallback src="" alt="火锅" />);

    expect(screen.getByRole('img', { name: '火锅' })).toHaveAttribute('data-image-state', 'empty');
    expect(screen.getByText('图片待补充')).toBeInTheDocument();
  });

  it('图片加载失败时切换到指定回退图片', () => {
    render(<ImageWithFallback src="https://example.com/restaurant.jpg" alt="餐厅" fallbackSrc="/brand-logo.png" />);

    fireEvent.error(screen.getByRole('img', { name: '餐厅' }));

    expect(screen.getByRole('img', { name: '餐厅' })).toHaveAttribute('src', '/brand-logo.png');
  });
});
