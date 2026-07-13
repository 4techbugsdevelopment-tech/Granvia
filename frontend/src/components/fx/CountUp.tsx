import { useEffect, useRef, useState } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

type Props = {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Group thousands with locale separators (e.g. 12,400). */
  separator?: boolean;
};

/** Spring/ease number roll-up when the element scrolls into view. */
export function CountUp({
  value,
  duration = 1.4,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  separator = true,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  const format = (n: number) => {
    const fixed = n.toFixed(decimals);
    if (!separator) return fixed;
    const [int, frac] = fixed.split('.');
    const grouped = Number(int).toLocaleString('en-IN');
    return frac ? `${grouped}.${frac}` : grouped;
  };

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {format(display)}
      {suffix}
    </span>
  );
}
