import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'default' | 'success' | 'error';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ToastState extends Required<Pick<ToastOptions, 'message' | 'tone'>> {
  id: number;
}

interface ConfirmState extends Required<Pick<ConfirmOptions, 'title' | 'confirmLabel' | 'cancelLabel'>> {
  message?: string;
}

interface FeedbackContextValue {
  toast: (input: string | ToastOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const defaultFeedback: FeedbackContextValue = {
  toast: () => undefined,
  confirm: async () => true,
};

const FeedbackContext = createContext<FeedbackContextValue>(defaultFeedback);

export function useFeedback() {
  return useContext(FeedbackContext);
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const toastId = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const confirmResolver = useRef<((accepted: boolean) => void) | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const toast = useCallback((input: string | ToastOptions) => {
    const options = typeof input === 'string' ? { message: input } : input;
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToastState({
      id: toastId.current++,
      message: options.message,
      tone: options.tone ?? 'default',
    });
    if (options.duration !== 0) {
      toastTimer.current = window.setTimeout(() => {
        setToastState(null);
        toastTimer.current = null;
      }, options.duration ?? 2600);
    }
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    confirmResolver.current?.(false);
    confirmResolver.current = resolve;
    setConfirmState({
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? '确认',
      cancelLabel: options.cancelLabel ?? '取消',
    });
  }), []);

  const settleConfirm = useCallback((accepted: boolean) => {
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    setConfirmState(null);
    resolve?.(accepted);
  }, []);

  useEffect(() => {
    if (!confirmState) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') settleConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmState, settleConfirm]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    confirmResolver.current?.(false);
  }, []);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      <div className="feedback-provider">
        {children}
        <div className="feedback-layer">
          <AnimatePresence initial={false} mode="wait">
            {toastState && (
              <motion.div
                key={toastState.id}
                role={toastState.tone === 'error' ? 'alert' : 'status'}
                aria-atomic="true"
                data-tone={toastState.tone}
                className="feedback-toast"
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate(-50%, -46%) scale(0.96)' }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translate(-50%, -54%) scale(0.96)' }}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.2, ease: [0.23, 1, 0.32, 1] }}
              >
                {toastState.message}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {confirmState && (
              <motion.div
                key="feedback-confirm"
                className="feedback-confirm-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.2 }}
              >
                <motion.section
                  role="dialog"
                  aria-modal="true"
                  aria-label={confirmState.title}
                  className="feedback-confirm-panel"
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px) scale(0.98)' }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0) scale(1)' }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px) scale(0.98)' }}
                  transition={{ duration: prefersReducedMotion ? 0.12 : 0.24, ease: [0.23, 1, 0.32, 1] }}
                >
                  <h2 className="text-xl font-black text-slate-950">{confirmState.title}</h2>
                  {confirmState.message && <p className="mt-2 text-sm leading-6 text-slate-500">{confirmState.message}</p>}
                  <div className="mt-6 flex gap-3">
                    <button type="button" className="pressable feedback-confirm-cancel" onClick={() => settleConfirm(false)}>{confirmState.cancelLabel}</button>
                    <button type="button" autoFocus className="pressable feedback-confirm-submit" onClick={() => settleConfirm(true)}>{confirmState.confirmLabel}</button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}
