interface GranviaLogoProps {
  size?: number;
  showText?: boolean;
  textColor?: string;
  iconColor?: string;
  accentColor?: string;
}

const LOGO_SRC = '/granvia-logo.png';
export default function GranviaLogo({
  size = 48,
  showText: _showText = true,
}: GranviaLogoProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flex: '0 0 auto' }}>
      <img
        src={LOGO_SRC}
        alt="Granvia Logo"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          boxSizing: 'border-box',
          padding: Math.max(2, Math.round(size * 0.06)),
          borderRadius: '50%',
          background: 'white',
        }}
      />
    </div>
  );
}
