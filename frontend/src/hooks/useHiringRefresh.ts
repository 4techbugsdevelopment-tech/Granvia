import { useEffect, useRef } from 'react';

// Mutations update this session immediately; other signed-in sessions refresh
// while visible, and as soon as they regain focus.
export function useHiringRefresh(refresh: () => void | Promise<unknown>) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    let busy = false;
    const reload = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try { await latest.current(); } catch { /* Screen keeps its own error state. */ }
      finally { busy = false; }
    };
    const timer = window.setInterval(reload, 5000);
    window.addEventListener('granvia:hiring-changed', reload);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('granvia:hiring-changed', reload);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, []);
}
