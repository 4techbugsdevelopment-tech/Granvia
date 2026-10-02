import { useEffect, useRef } from 'react';

// Refresh after hiring actions and when returning to the app.
// Do not poll idle screens.
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
    window.addEventListener('granvia:hiring-changed', reload);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      window.removeEventListener('granvia:hiring-changed', reload);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, []);
}
