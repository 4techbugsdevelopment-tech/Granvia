import { useState } from 'react';
import { motion } from 'framer-motion';

interface FlipCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | React.ReactNode;
  color: string;
  onTap?: () => void;
  small?: boolean;
}

export default function FlipCard({ icon, label, value, color, onTap, small = false }: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlipHover = (flip: boolean) => {
    if (window.matchMedia('(hover: hover)').matches) {
      setIsFlipped(flip);
    }
  };

  const handleFlipTap = () => {
    setIsFlipped(!isFlipped);
    onTap?.();
  };

  const cardHeight = small ? 'h-24' : 'h-28';

  return (
    <div
      className={`relative w-full ${cardHeight} rounded-2xl cursor-pointer ${onTap ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2' : ''}`}
      style={{
        perspective: '1000px',
        pointerEvents: 'auto',
      }}
      onMouseEnter={() => handleFlipHover(true)}
      onMouseLeave={() => handleFlipHover(false)}
      onClick={handleFlipTap}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={onTap ? `Open ${label}` : undefined}
      onKeyDown={event => {
        if (onTap && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onTap();
        }
      }}
    >
      {/* Front side */}
      <motion.div
        className={`absolute inset-0 rounded-2xl p-3 flex flex-col items-center justify-center text-center`}
        style={{
          background: 'white',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          backfaceVisibility: 'hidden',
        }}
        animate={{
          rotateY: isFlipped ? 180 : 0,
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <div style={{ color }} className="flex justify-center mb-1">
          {icon}
        </div>
        <div className={`font-bold ${small ? 'text-base' : 'text-lg'}`} style={{ color: '#0f1e3c' }}>
          {value}
        </div>
        <div className="text-xs text-gray-400 leading-tight mt-0.5">{label}</div>
      </motion.div>

      {/* Back side - Logo */}
      <motion.div
        className={`absolute inset-0 rounded-2xl p-3 flex flex-col items-center justify-center text-center`}
        style={{
          background: 'white',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          backfaceVisibility: 'hidden',
        }}
        animate={{
          rotateY: isFlipped ? 0 : 180,
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <img
          src="/granvia-logo.png"
          alt="Granvia Logo"
          className={`w-auto object-contain ${small ? 'h-16' : 'h-20'}`}
        />
      </motion.div>
    </div>
  );
}
