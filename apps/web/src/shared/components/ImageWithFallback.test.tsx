import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageWithFallback } from './ImageWithFallback';

describe('ImageWithFallback', () => {
  it('renders a blank-image placeholder when no image is configured', () => {
    render(<ImageWithFallback src="" alt="火锅" />);

    expect(screen.getByRole('img', { name: '火锅' })).toHaveAttribute('data-image-state', 'empty');
    expect(screen.getByText('图片待补充')).toBeInTheDocument();
  });
});
