import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { downloadHiringDocument, listMyNotifications, markNotificationRead, type HiringDocument } from '../services/notificationService';

interface NotificationBellProps {
  onCompleteVerification?: () => void;
  dark?: boolean;
}

export default function NotificationBell({ onCompleteVerification, dark = false }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems((await listMyNotifications()) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const unread = items.filter(item => !item.is_read).length;
  const read = async (item: any) => {
    if (item.is_read) return;
    setItems(current => current.map(row => row.id === item.id ? { ...row, is_read: true } : row));
    await markNotificationRead(item.id);
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(value => !value); void refresh(); }}
        className={`relative rounded-xl p-2 transition-colors ${dark ? 'text-white/80 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100'}`}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-[90] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div><p className="text-sm font-bold text-gray-900">Notifications</p><p className="text-xs text-gray-400">{unread} unread</p></div>
            <div className="flex items-center gap-1">
              <button onClick={() => void refresh()} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" title="Refresh notifications" aria-label="Refresh notifications">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              {unread > 0 && <button onClick={() => Promise.all(items.filter(item => !item.is_read).map(item => read(item)))} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" title="Mark all read" aria-label="Mark all read"><CheckCheck size={15} /></button>}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 && <p className="px-3 py-8 text-center text-xs text-gray-400">No notifications</p>}
            {items.map(item => {
              const verification = item.type === 'associate_verification';
              const documentType: HiringDocument | null = item.type?.startsWith('hiring_offer_letter:')
                ? 'offer-letter'
                : item.type?.startsWith('hiring_employment_agreement:') ? 'employment-agreement' : null;
              return <div key={item.id} onClick={() => void read(item)} className={`rounded-xl p-3 ${item.is_read ? '' : 'bg-blue-50'}`}>
                <div className="flex gap-2">
                  {verification && <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-700" />}
                  <div className="min-w-0"><p className="text-xs font-bold text-gray-900">{item.title}</p><p className="mt-1 text-xs leading-snug text-gray-600">{item.message}</p><p className="mt-1 text-[10px] text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : ''}</p>
                    {verification && onCompleteVerification && <button onClick={(event) => { event.stopPropagation(); void read(item); onCompleteVerification(); }} className="mt-2 rounded-lg bg-[#0f1e3c] px-2.5 py-1.5 text-[11px] font-semibold text-white">Review profile</button>}
                    {documentType && <button onClick={(event) => { event.stopPropagation(); void read(item); void downloadHiringDocument(documentType); }} className="mt-2 text-xs font-semibold text-blue-700 underline underline-offset-2">Click here to download {documentType === 'offer-letter' ? 'your offer letter' : 'the employment agreement'}</button>}
                  </div>
                </div>
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
