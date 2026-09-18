import { useEffect, useRef } from 'react';

export const VISIBLE_POLL_INTERVAL_MS = 15000;
export const HIDDEN_POLL_INTERVAL_MS = 60000;

export default function useVisibilityPolling(callback, {
  enabled = true,
  visibleInterval = VISIBLE_POLL_INTERVAL_MS,
  hiddenInterval = HIDDEN_POLL_INTERVAL_MS,
  refreshOnVisible = true,
} = {}) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let stopped = false;
    let running = false;

    const refresh = async () => {
      if (stopped || running) return;
      running = true;
      try {
        await callbackRef.current?.();
      } finally {
        running = false;
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      const delay = document.visibilityState === 'visible' ? visibleInterval : hiddenInterval;
      timer = window.setTimeout(() => {
        void refresh();
        schedule();
      }, delay);
    };
    const visibilityChanged = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible' && refreshOnVisible) void refresh();
      schedule();
    };

    document.addEventListener('visibilitychange', visibilityChanged);
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [enabled, hiddenInterval, refreshOnVisible, visibleInterval]);
}
