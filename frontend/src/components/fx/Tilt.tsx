import { CSSProperties, ReactNode, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';

type TiltProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Max rotation in degrees. */
  max?: number;
  /** Show the moving glare highlight. */
  glare?: boolean;
  /** Lift on hover (px). */
  lift?: number;
};

/**
 * 3D tilt-toward-cursor wrapper. GPU-only (transform), spring-smoothed, and a
 * no-op when the user prefers reduced motion. Give the child `position:relative`
 * + a border-radius; the glare inherits the radius.
 */
export function Tilt({ children, className, style, max = 12, glare = true, lift = 6 }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 200, damping: 20 });
  const sy = useSpring(my, { stiffness: 200, damping: 20 });

  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const glareBg = useTransform(
    () =>
      `radial-gradient(circle at ${sx.get() * 100}% ${sy.get() * 100}%, rgba(255,255,255,0.35), transparent 55%)`
  );

  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
      whileHover={{ y: -lift }}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 1000,
      }}
    >
      {children}
      {glare && (
        <motion.span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
            background: glareBg,
          }}
        />
      )}
    </motion.div>
  );
}
