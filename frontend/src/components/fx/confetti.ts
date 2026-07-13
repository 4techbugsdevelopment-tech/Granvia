import confetti from 'canvas-confetti';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Celebratory burst for milestones (Aadhaar verified, check-in, hire). */
export function successBurst() {
  if (prefersReduced()) return;
  const colors = ['#166534', '#1d4ed8', '#22c55e', '#fbbf24'];
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors });
  setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors }), 150);
  setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors }), 150);
}
