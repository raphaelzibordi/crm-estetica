import { useEffect, useRef } from 'react';

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos
const CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

// Desloga o usuário automaticamente após 30 minutos sem interação (mouse/teclado/scroll/touch).
export function useIdleLogout(active: boolean, onIdle: () => void) {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!active) return;

    lastActivityRef.current = Date.now();
    const markActivity = () => { lastActivityRef.current = Date.now(); };

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, markActivity, { passive: true }));

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= IDLE_LIMIT_MS) {
        onIdle();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, markActivity));
      window.clearInterval(interval);
    };
  }, [active, onIdle]);
}
