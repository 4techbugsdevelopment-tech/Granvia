import { ButtonHTMLAttributes, ReactNode, useRef } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** How far the button eases toward the cursor (px). */
  strength?: number;
};

/** Button that eases toward the cursor within its bounds. */
export function MagneticButton({ children, strength = 14, style, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 15 });
  const sy = useSpring(y, { stiffness: 250, damping: 15 });

  if (reduce) {
    return (
      <button ref={ref} style={style} {...rest}>
        {children}
      </button>
    );
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * strength * 2);
        y.set(((e.clientY - r.top) / r.height - 0.5) * strength * 2);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileTap={{ scale: 0.96 }}
      style={{ ...style, x: sx, y: sy }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </motion.button>
  );
}
