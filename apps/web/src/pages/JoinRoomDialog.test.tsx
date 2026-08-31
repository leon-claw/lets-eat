import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '@/shared/components/FeedbackProvider';
import { JoinRoomDialog } from './JoinRoomDialog';

describe('JoinRoomDialog', () => {
  it('requires exactly four digits and can cancel without joining', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    const onClose = vi.fn();
    render(<FeedbackProvider><JoinRoomDialog open displayName="小明" onJoin={onJoin} onClose={onClose} /></FeedbackProvider>);
    await user.type(screen.getByLabelText('房间号'), '12ab');
    await user.click(screen.getByRole('button', { name: '加入' }));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入 4 位数字房间号');
    expect(screen.getByRole('alert')).toHaveClass('feedback-toast');
    expect(onJoin).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes a pop-in panel and an explicit pending label while joining', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn(() => new Promise<never>(() => {}));
    render(<FeedbackProvider><JoinRoomDialog open displayName="小明" onJoin={onJoin} onClose={vi.fn()} /></FeedbackProvider>);

    expect(screen.getByTestId('join-room-dialog-panel')).toHaveClass('entry-pop');
    await user.type(screen.getByLabelText('房间号'), '1234');
    await user.click(screen.getByRole('button', { name: '加入' }));
    expect(screen.getByRole('button', { name: '正在加入…' })).toBeDisabled();
  });
});
