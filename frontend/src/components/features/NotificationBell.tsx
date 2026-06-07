import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Plane, Receipt, CalendarClock } from 'lucide-react';
import { notificationsService } from '../../services/notifications.service';
import { Notification } from '../../types';

const ICONS = {
  EXPENSE: Receipt,
  PLANNER: CalendarClock,
  INVITE: Plane,
} as const;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const NotificationBell = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.list(),
    refetchOnWindowFocus: true,
  });

  // Le flux SSE est géré globalement par useRealtimeSync (AppLayout) qui
  // invalide la query ['notifications'] — pas besoin d'un 2e abonnement ici.
  const unread = notifications.filter((n) => !n.read).length;

  const handleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await notificationsService.markAllRead();
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune notification</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((n: Notification) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  return (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 ${!n.read ? 'bg-primary-50/50' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Icon size={14} className="text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
