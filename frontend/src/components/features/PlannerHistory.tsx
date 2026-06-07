import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { tripsService } from '../../services/trips.service';
import { PlannerLog } from '../../types';

interface Props {
  tripId: string;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Titre', description: 'Description', startTime: 'Début',
  endTime: 'Fin', location: 'Lieu', date: 'Jour',
};

const fmtVal = (key: string, v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (key === 'date') return new Date(v as string).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  return String(v);
};

/** Calcule les champs modifiés entre deux snapshots JSON. */
const diffFields = (before?: string | null, after?: string | null) => {
  if (!before || !after) return [];
  try {
    const b = JSON.parse(before);
    const a = JSON.parse(after);
    const keys = ['title', 'startTime', 'endTime', 'location', 'description', 'date'];
    return keys
      .filter((k) => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null))
      .map((k) => ({ key: k, from: fmtVal(k, b[k]), to: fmtVal(k, a[k]) }));
  } catch {
    return [];
  }
};

const ACTION_META = {
  CREATE: { icon: Plus, color: 'text-green-600 bg-green-50', verb: 'a ajouté' },
  UPDATE: { icon: Pencil, color: 'text-blue-600 bg-blue-50', verb: 'a modifié' },
  DELETE: { icon: Trash2, color: 'text-red-500 bg-red-50', verb: 'a supprimé' },
} as const;

export const PlannerHistory = ({ tripId, onClose }: Props) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['planner-logs', tripId],
    queryFn: () => tripsService.getPlannerLogs(tripId),
  });

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 bg-black/40 z-[9998]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[9999] flex flex-col"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Historique du planning</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Chargement…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune modification pour l'instant.</p>
          ) : (
            logs.map((log: PlannerLog) => {
              const meta = ACTION_META[log.action];
              const Icon = meta.icon;
              const changes = log.action === 'UPDATE' ? diffFields(log.before, log.after) : [];
              return (
                <div key={log.id} className="flex gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">
                      <span className="font-medium">{log.user.name}</span> {meta.verb}{' '}
                      <span className="font-medium">« {log.activityTitle} »</span>
                    </p>
                    {changes.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {changes.map((c) => (
                          <li key={c.key} className="text-xs text-gray-500">
                            {FIELD_LABELS[c.key] ?? c.key} : <span className="line-through">{c.from}</span> → <span className="text-gray-700">{c.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(log.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.aside>
    </>,
    document.body
  );
};
