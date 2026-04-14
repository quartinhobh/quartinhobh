import { useCallback } from 'react';
import confetti from 'canvas-confetti';

const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'];

export function useConfettiBurst() {
  const burst = useCallback((centerX: number, centerY: number) => {
    const x = centerX / 100;
    const y = centerY / 100;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x, y },
      colors: COLORS,
    });
  }, []);

  return { burst };
}