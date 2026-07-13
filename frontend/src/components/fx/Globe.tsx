import { CSSProperties, useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { useReducedMotion } from 'framer-motion';

type Props = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** [lat, lng] marker points — defaults to major Indian metros. */
  markers?: [number, number][];
  dark?: boolean;
};

const INDIA_METROS: [number, number][] = [
  [19.076, 72.8777], // Mumbai
  [28.7041, 77.1025], // Delhi
  [12.9716, 77.5946], // Bengaluru
  [13.0827, 80.2707], // Chennai
  [22.5726, 88.3639], // Kolkata
  [17.385, 78.4867], // Hyderabad
  [18.5204, 73.8567], // Pune
  [23.0225, 72.5714], // Ahmedabad
];

/**
 * WebGL globe via `cobe` (~5 kB, no three.js). Auto-rotates; static under
 * reduced motion. Lazy-load this component so cobe stays out of the initial bundle.
 */
export default function Globe({ size = 420, className, style, markers = INDIA_METROS, dark = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const phiRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const options = {
      devicePixelRatio: dpr,
      width: size * dpr,
      height: size * dpr,
      phi: 0,
      theta: 0.25,
      dark: dark ? 1 : 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.15, 0.35, 0.55],
      markerColor: [0.1, 0.9, 0.5],
      glowColor: [0.2, 0.5, 0.9],
      markers: markers.map((location) => ({ location, size: 0.05 })),
      onRender: (state: Record<string, number>) => {
        if (!reduce) phiRef.current += 0.0045;
        state.phi = phiRef.current;
        state.width = size * dpr;
        state.height = size * dpr;
      },
    };

    const globe = createGlobe(canvas, options as unknown as Parameters<typeof createGlobe>[1]);

    return () => globe.destroy();
  }, [size, dark, reduce, markers]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width: size, height: size, maxWidth: '100%', aspectRatio: '1', ...style }}
    />
  );
}
