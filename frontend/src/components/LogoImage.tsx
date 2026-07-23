interface LogoImageProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

const sizeMap = {
  sm: { img: 'h-8', text: 'text-xs' },
  md: { img: 'h-12', text: 'text-sm' },
  lg: { img: 'h-16', text: 'text-base' },
  xl: { img: 'h-24', text: 'text-xl' },
};

export default function LogoImage({ size = 'md', showText = false }: LogoImageProps) {
  const sizeClasses = sizeMap[size];

  return (
    <div className="flex items-center gap-2">
      <img
        src="/granvia-logo.png"
        alt="Granvia Logo"
        className={`${sizeClasses.img} w-auto object-contain`}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`${sizeClasses.text} font-bold`} style={{ color: '#0f1e3c', fontFamily: 'Georgia, serif' }}>
            GRANVIA
          </span>
          <span className="text-xs" style={{ color: '#8b1a1a', letterSpacing: '0.05em' }}>
            Associates
          </span>
        </div>
      )}
    </div>
  );
}
