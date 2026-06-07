import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Plus, Clock, MapPin, Trash2, CalendarDays, History } from 'lucide-react';
import { tripsService } from '../../services/trips.service';
import { PlannerActivity, PlannerActivityInput } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { PlannerHistory } from './PlannerHistory';

interface Props {
  tripId: string;
  startDate: string;
  endDate: string;
  currentUserId: string;
  isOwner: boolean;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

const enumerateDays = (start: string, end: string): Date[] => {
  const days: Date[] = [];
  const d = new Date(start); d.setUTCHours(0, 0, 0, 0);
  const last = new Date(end); last.setUTCHours(0, 0, 0, 0);
  // Garde-fou : limite raisonnable pour éviter une boucle géante sur données aberrantes
  for (let i = 0; d <= last && i < 366; i++) {
    days.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
};

const dayLabel = (d: Date) =>
  d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const byTime = (a: PlannerActivity, b: PlannerActivity) =>
  (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99');

export const TripPlanner = ({ tripId, startDate, endDate, currentUserId, isOwner }: Props) => {
  const qc = useQueryClient();
  const queryKey = ['planner', tripId];

  const { data: activities = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => tripsService.getPlanner(tripId),
  });

  const [addDay, setAddDay] = useState<string | null>(null);
  const [form, setForm] = useState<PlannerActivityInput>({ date: '', title: '' });
  const [showHistory, setShowHistory] = useState(false);

  const days = useMemo(() => enumerateDays(startDate, endDate), [startDate, endDate]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlannerActivity[]>();
    for (const a of activities) {
      const key = a.date.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    for (const arr of map.values()) arr.sort(byTime);
    return map;
  }, [activities]);

  const createMutation = useMutation({
    mutationFn: (data: PlannerActivityInput) => tripsService.createPlannerActivity(tripId, data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<PlannerActivity[]>(queryKey) ?? [];
      const optimistic: PlannerActivity = {
        id: `temp-${Date.now()}`,
        tripId, date: data.date, title: data.title,
        description: data.description, startTime: data.startTime,
        endTime: data.endTime, location: data.location,
        createdById: currentUserId, createdAt: new Date().toISOString(),
        createdBy: { id: currentUserId, name: 'Moi' },
      };
      qc.setQueryData<PlannerActivity[]>(queryKey, [...previous, optimistic]);
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['planner-logs', tripId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (aid: string) => tripsService.deletePlannerActivity(tripId, aid),
    onMutate: async (aid) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<PlannerActivity[]>(queryKey) ?? [];
      qc.setQueryData<PlannerActivity[]>(queryKey, previous.filter(a => a.id !== aid));
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['planner-logs', tripId] });
    },
  });

  const openAdd = (key: string) => {
    setForm({ date: `${key}T00:00:00.000Z`, title: '', description: '', startTime: '', endTime: '', location: '' });
    setAddDay(key);
  };

  const submitAdd = () => {
    if (!form.title.trim()) return;
    // Nettoie les champs vides (pour respecter la validation HH:MM côté backend)
    const payload: PlannerActivityInput = {
      date: form.date,
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location?.trim() || undefined,
    };
    createMutation.mutate(payload);
    setAddDay(null);
  };

  const canDelete = (a: PlannerActivity) => a.createdById === currentUserId || isOwner;

  if (isLoading) return <div className="text-gray-400 text-sm py-8 text-center">Chargement du planning…</div>;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <History size={15} /> Historique
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
        {days.map((d) => {
          const key = dayKey(d);
          const dayActivities = byDay.get(key) ?? [];
          return (
            <div key={key} className="flex-shrink-0 w-64 bg-gray-50 rounded-xl border border-gray-100 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
                <CalendarDays size={14} className="text-primary-500" />
                <span className="text-sm font-semibold text-gray-800 capitalize">{dayLabel(d)}</span>
                <span className="ml-auto text-xs text-gray-400">{dayActivities.length}</span>
              </div>

              <div className="flex-1 p-2 space-y-2 min-h-[80px]">
                {dayActivities.map((a) => (
                  <div key={a.id} className="group bg-white rounded-lg border border-gray-100 p-2.5 shadow-sm">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-medium text-gray-900 flex-1 leading-snug">{a.title}</p>
                      {canDelete(a) && !a.id.startsWith('temp-') && (
                        <button
                          onClick={() => deleteMutation.mutate(a.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {(a.startTime || a.endTime) && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock size={11} />{a.startTime}{a.endTime ? ` – ${a.endTime}` : ''}
                      </p>
                    )}
                    {a.location && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin size={11} />{a.location}
                      </p>
                    )}
                    {a.description && <p className="text-xs text-gray-400 mt-1 leading-snug">{a.description}</p>}
                    <p className="text-[10px] text-gray-300 mt-1.5">par {a.createdBy.name}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openAdd(key)}
                className="m-2 mt-0 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-primary-600 hover:bg-white rounded-lg py-2 border border-dashed border-gray-200 transition-colors"
              >
                <Plus size={13} /> Ajouter
              </button>
            </div>
          );
        })}
      </div>

      <Modal isOpen={addDay !== null} onClose={() => setAddDay(null)} title="Nouvelle activité" size="sm">
        <div className="space-y-4">
          <Input
            label="Titre"
            placeholder="Visite du Reichstag"
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Début</label>
              <input type="time" value={form.startTime ?? ''} onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))} className="input-field" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Fin</label>
              <input type="time" value={form.endTime ?? ''} onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))} className="input-field" />
            </div>
          </div>
          <Input
            label="Lieu (optionnel)"
            placeholder="Platz der Republik 1"
            value={form.location ?? ''}
            onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description (optionnel)</label>
            <textarea
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="input-field resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setAddDay(null)} className="flex-1 justify-center">Annuler</Button>
            <Button onClick={submitAdd} disabled={!form.title.trim()} className="flex-1 justify-center">Ajouter</Button>
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {showHistory && <PlannerHistory tripId={tripId} onClose={() => setShowHistory(false)} />}
      </AnimatePresence>
    </div>
  );
};
