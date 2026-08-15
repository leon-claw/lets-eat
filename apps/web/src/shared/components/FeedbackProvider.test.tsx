import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider, useFeedback } from './FeedbackProvider';

function FeedbackTrigger() {
  const { confirm, toast } = useFeedback();

  return (
    <>
      <button type="button" onClick={() => toast({ message: '保存成功', tone: 'success', duration: 0 })}>显示提示</button>
      <button type="button" onClick={async () => { const accepted = await confirm({ title: '关闭房间？', message: '关闭后成员将离开当前房间。' }); document.body.dataset.confirmed = String(accepted); }}>打开确认</button>
    </>
  );
}

describe('FeedbackProvider', () => {
  it('shows the latest toast in the shared feedback layer', async () => {
    const user = userEvent.setup();
    render(<FeedbackProvider><FeedbackTrigger /></FeedbackProvider>);

    await user.click(screen.getByRole('button', { name: '显示提示' }));

    expect(screen.getByRole('status')).toHaveTextContent('保存成功');
    expect(screen.getByRole('status')).toHaveClass('feedback-toast');
  });

  it('resolves confirm with false when the user cancels', async () => {
    const user = userEvent.setup();
    render(<FeedbackProvider><FeedbackTrigger /></FeedbackProvider>);

    await user.click(screen.getByRole('button', { name: '打开确认' }));
    expect(screen.getByRole('dialog', { name: '关闭房间？' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(document.body.dataset.confirmed).toBe('false');
  });

  it('resolves confirm with true when the user confirms', async () => {
    const user = userEvent.setup();
    render(<FeedbackProvider><FeedbackTrigger /></FeedbackProvider>);

    await user.click(screen.getByRole('button', { name: '打开确认' }));
    await user.click(screen.getByRole('button', { name: '确认' }));

    expect(document.body.dataset.confirmed).toBe('true');
  });
});
