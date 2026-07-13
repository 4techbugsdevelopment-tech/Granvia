import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Props = {
  children: ReactNode;
  className?: string;
  /** Vertical/rotational variant for a light 3D page swap. */
  variant?: 'fade' | 'slide' | 'flip';
};

/**
 * Wrap a page/screen body. Pair with a changing `key` (route/page id) so the
 * enter animation replays on navigation. Under reduced motion it just fades.
 */
export function PageTransition({ children, className, variant = 'slide' }: Props) {
  const reduce = useReducedMotion();

  const variants = {
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    slide: { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 } },
    flip: { initial: { opacity: 0, rotateX: -8, y: 24 }, animate: { opacity: 1, rotateX: 0, y: 0 } },
  }[reduce ? 'fade' : variant];

  return (
    <motion.div
      className={className}
      initial={variants.initial}
      animate={variants.animate}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformPerspective: 1200 }}
    >
      {children}
    </motion.div>
  );
}
