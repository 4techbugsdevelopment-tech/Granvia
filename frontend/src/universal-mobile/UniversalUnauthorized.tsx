import { LogOut, ShieldAlert } from 'lucide-react';

interface UniversalUnauthorizedProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction: () => void;
  onLogout: () => void;
}

export default function UniversalUnauthorized({
  title,
  message,
  actionLabel = 'Go to Login',
  onAction,
  onLogout,
}: UniversalUnauthorizedProps) {
  return (
    <div
      className="granvia-mobile flex flex-col items-center justify-center w-full h-full px-8 text-center gap-4"
      style={{
        background: 'linear-gradient(180deg, #f7f9fc 0%, #eef2f7 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(26,43,86,0.1)', color: '#1a2b56' }}
      >
        <ShieldAlert size={30} />
      </div>
      <div>
        <p className="font-bold text-gray-800">{title}</p>
        <p className="text-sm text-gray-500 mt-1">{message}</p>
      </div>
      <button
        onClick={onAction}
        className="mt-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: 'linear-gradient(135deg, #1a2b56, #7a2621)' }}
      >
        {actionLabel}
      </button>
      <button
        onClick={onLogout}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
