import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { JoinRoomDialog } from './JoinRoomDialog';

describe('JoinRoomDialog', () => {
  it('requires exactly eight digits and can cancel without joining', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    const onClose = vi.fn();
    render(<JoinRoomDialog open displayName="小明" onJoin={onJoin} onClose={onClose} />);
    await user.type(screen.getByLabelText('房间号'), '12ab');
    await user.click(screen.getByRole('button', { name: '加入' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入 8 位数字房间号');
    expect(onJoin).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
