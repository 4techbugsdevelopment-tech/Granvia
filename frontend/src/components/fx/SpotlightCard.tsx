import { CSSProperties, ReactNode, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Spotlight colour (rgba). */
  color?: string;
  size?: number;
};

/**
 * A cursor-following radial spotlight glow. Cheaper than Tilt; combine or use
 * alone on flat cards. No-op under reduced motion.
 */
export function SpotlightCard({
  children,
  className,
  style,
  color = 'rgba(59,130,246,0.15)',
  size = 260,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      onMouseMove={
        reduce
          ? undefined
          : (e) => {
              const r = ref.current!.getBoundingClientRect();
              setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
            }
      }
      onMouseLeave={() => setPos(null)}
    >
      {pos && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(${size}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 70%)`,
            transition: 'opacity 200ms',
          }}
        />
      )}
      {children}
    </div>
  );
}
