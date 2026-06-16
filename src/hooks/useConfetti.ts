import { useCallback } from 'react';
import confetti from 'canvas-confetti';

/** Celebratory burst — used on successful step submission / badge unlock. */
export function useConfetti() {
  return useCallback(() => {
    const end = Date.now() + 700;
    const colors = ['#10b981', '#0ea5e9', '#f59e0b'];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, []);
}
