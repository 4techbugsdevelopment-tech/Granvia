import { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Props = {
  className?: string;
  style?: CSSProperties;
  /** Blob colours. */
  colors?: string[];
};

/** Slow drifting aurora/mesh-gradient blobs. Absolute; place behind content. */
export function AuroraBackground({
  className,
  style,
  colors = ['#1d4ed8', '#166534', '#5b21b6'],
}: Props) {
  const reduce = useReducedMotion();

  const blobs = [
    { c: colors[0], x: ['-10%', '30%', '-10%'], y: ['0%', '20%', '0%'], size: 520 },
    { c: colors[1], x: ['60%', '40%', '60%'], y: ['30%', '0%', '30%'], size: 480 },
    { c: colors[2 % colors.length], x: ['20%', '55%', '20%'], y: ['55%', '35%', '55%'], size: 440 },
  ];

  return (
    <div
      aria-hidden
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', filter: 'blur(70px)', ...style }}
    >
      {blobs.map((b, i) => (
        <motion.span
          key={i}
          initial={{ left: b.x[0], top: b.y[0] }}
          animate={reduce ? { left: b.x[0], top: b.y[0] } : { left: b.x, top: b.y }}
          transition={{ duration: 18 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: b.c,
            opacity: 0.45,
          }}
        />
      ))}
    </div>
  );
}
