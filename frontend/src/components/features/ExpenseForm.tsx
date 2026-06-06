import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ExpenseInput, SplitType, TripParticipant } from '../../types';

const schema = z.object({
  title: z.string().min(1, 'Titre requis'),
  amount: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().positive('Montant invalide')),
  currency: z.string().length(3),
  category: z.enum(['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'OTHER']),
  date: z.string().min(1, 'Date requise'),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ACCOMMODATION', label: 'Hébergement' },
  { value: 'FOOD', label: 'Nourriture' },
  { value: 'ACTIVITIES', label: 'Activités' },
  { value: 'OTHER', label: 'Autre' },
];

const SPLIT_TABS: { value: SplitType; label: string }[] = [
  { value: 'EQUAL', label: 'Parts égales' },
  { value: 'CUSTOM', label: 'Personnalisé' },
  { value: 'PERSONAL', label: 'Perso' },
];

interface Props {
  participants: TripParticipant[];
  currentUserId: string;
  onSubmit: (data: ExpenseInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ExpenseForm = ({ participants, currentUserId, onSubmit, onCancel, isLoading }: Props) => {
  const memberIds = useMemo(() => participants.map(p => p.user.id), [participants]);

  const [paidById, setPaidById] = useState(currentUserId);
  const [splitType, setSplitType] = useState<SplitType>('EQUAL');
  const [included, setIncluded] = useState<Set<string>>(new Set(memberIds));
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [splitError, setSplitError] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, watch, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', amount: undefined, currency: 'EUR', category: 'TRANSPORT',
      date: new Date().toISOString().slice(0, 10), notes: '',
    },
  });

  const amount = Number(watch('amount')) || 0;

  const toggleIncluded = (id: string) => {
    setIncluded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const equalPreview = included.size > 0 ? amount / included.size : 0;
  const customTotal = Object.values(custom).reduce((a, v) => a + (Number(v) || 0), 0);

  const handleValid = (data: FormData) => {
    setSplitError('');

    if (splitType === 'EQUAL' && included.size === 0) {
      setSplitError('Sélectionnez au moins un participant.'); return;
    }
    if (splitType === 'CUSTOM' && Math.abs(customTotal - data.amount) > 0.01) {
      setSplitError(`La somme des parts (${customTotal.toFixed(2)}) doit égaler le montant (${data.amount.toFixed(2)}).`);
      return;
    }

    const base: ExpenseInput = {
      title: data.title,
      amount: data.amount,
      currency: data.currency,
      category: data.category,
      date: new Date(data.date).toISOString(),
      notes: data.notes,
      paidById,
      splitType,
    };

    if (splitType === 'EQUAL') base.participantIds = [...included];
    if (splitType === 'CUSTOM') {
      base.shares = memberIds
        .map(userId => ({ userId, amount: Number(custom[userId]) || 0 }))
        .filter(s => s.amount > 0);
    }

    onSubmit(base);
  };

  const initial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <form onSubmit={handleSubmit(handleValid)} className="space-y-4">
      <Input label="Titre" placeholder="Vol Paris → Tokyo" {...register('title')} error={errors.title?.message as string | undefined} />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Montant" type="number" step="0.01" placeholder="150.00" {...register('amount')} error={errors.amount?.message as string | undefined} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Devise</label>
          <select {...register('currency')} className="input-field">
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
            <option value="GBP">GBP £</option>
            <option value="JPY">JPY ¥</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Catégorie</label>
          <select {...register('category')} className="input-field">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <Input label="Date" type="date" {...register('date')} error={errors.date?.message as string | undefined} />
      </div>

      {/* Payé par */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payé par</label>
        <select value={paidById} onChange={e => setPaidById(e.target.value)} className="input-field">
          {participants.map(p => (
            <option key={p.user.id} value={p.user.id}>
              {p.user.id === currentUserId ? `${p.user.name} (moi)` : p.user.name}
            </option>
          ))}
        </select>
      </div>

      {/* Répartition */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Répartition</label>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {SPLIT_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setSplitType(tab.value); setSplitError(''); }}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                splitType === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {splitType === 'PERSONAL' && (
          <p className="text-xs text-gray-500 px-1">
            Dépense personnelle du payeur — elle n'entre pas dans les comptes partagés.
          </p>
        )}

        {splitType === 'EQUAL' && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {participants.map(p => (
              <label key={p.user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={included.has(p.user.id)} onChange={() => toggleIncluded(p.user.id)} className="rounded text-primary-600" />
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold">
                  {initial(p.user.name)}
                </div>
                <span className="text-sm text-gray-700 flex-1">{p.user.name}</span>
                {included.has(p.user.id) && (
                  <span className="text-xs text-gray-500">{equalPreview.toFixed(2)}</span>
                )}
              </label>
            ))}
          </div>
        )}

        {splitType === 'CUSTOM' && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {participants.map(p => (
              <div key={p.user.id} className="flex items-center gap-3 p-1">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-semibold flex-shrink-0">
                  {initial(p.user.name)}
                </div>
                <span className="text-sm text-gray-700 flex-1 truncate">{p.user.name}</span>
                <input
                  type="number" step="0.01" placeholder="0.00"
                  value={custom[p.user.id] ?? ''}
                  onChange={e => setCustom(c => ({ ...c, [p.user.id]: e.target.value }))}
                  className="input-field w-24 text-right py-1"
                />
              </div>
            ))}
            <p className={`text-xs px-1 ${Math.abs(customTotal - amount) > 0.01 ? 'text-red-500' : 'text-gray-500'}`}>
              Total réparti : {customTotal.toFixed(2)} / {amount.toFixed(2)}
            </p>
          </div>
        )}

        {splitError && <p className="text-xs text-red-600">{splitError}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">Annuler</Button>
        <Button type="submit" loading={isLoading} className="flex-1 justify-center">Ajouter</Button>
      </div>
    </form>
  );
};
