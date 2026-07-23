import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GranviaLogo from '../components/GranviaLogo';

interface MobileSplashProps {
  onComplete: () => void;
}

export default function MobileSplash({ onComplete }: MobileSplashProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    const t4 = setTimeout(() => onComplete(), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #060d1a 0%, #0f1e3c 50%, #1a0505 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Background circles */}
      {[300, 220, 150].map((size, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            border: `1px solid rgba(139,26,26,${0.1 + i * 0.05})`,
          }}
          animate={{ scale: [1, 1.05 + i * 0.02, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
          initial={{ scale: 0, opacity: 0 }}
        />
      ))}

      {/* Spinning ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 130,
          height: 130,
          border: '2.5px solid transparent',
          borderTopColor: '#8b1a1a',
          borderRightColor: 'rgba(139,26,26,0.4)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />

      {/* Logo */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 0, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : {}}
        transition={{ type: 'spring', stiffness: 250, damping: 18 }}
      >
        <GranviaLogo size={56} showText={false} iconColor="white" accentColor="#8b1a1a" />
      </motion.div>

      {/* Floating particles */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute rounded-full"
          style={{
            width: 3,
            height: 3,
            background: i % 2 === 0 ? '#8b1a1a' : 'rgba(255,255,255,0.4)',
            left: `${15 + ((i * 7 + 3) % 70)}%`,
            top: `${20 + ((i * 11 + 5) % 60)}%`,
          }}
          animate={{ opacity: [0, 0.8, 0], y: [-20, -60], scale: [0, 1, 0] }}
          transition={{ duration: 2 + (i % 3), delay: (i % 5) * 0.4, repeat: Infinity }}
        />
      ))}

      {/* Text reveal */}
      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-white font-bold tracking-widest text-2xl" style={{ fontFamily: 'Georgia, serif' }}>
          GRANVIA
        </h1>
        <p className="tracking-widest mt-1 text-xs" style={{ color: '#8b1a1a', letterSpacing: '0.25em' }}>
          SECURITY SOLUTIONS
        </p>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        className="mt-3 text-gray-500 text-xs tracking-wider"
        initial={{ opacity: 0 }}
        animate={phase >= 3 ? { opacity: 1 } : {}}
        transition={{ duration: 0.4 }}
      >
        ASSOCIATE APP
      </motion.p>

      {/* Bottom loading */}
      <motion.div
        className="absolute bottom-8 w-32 h-0.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.1)', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : {}}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: '#8b1a1a' }}
          initial={{ width: '0%' }}
          animate={phase >= 2 ? { width: '100%' } : {}}
          transition={{ duration: 0.8 }}
        />
      </motion.div>
    </div>
  );
}
