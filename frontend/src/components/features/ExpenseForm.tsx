import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Expense } from '../../types';

const schema = z.object({
  title: z.string().min(1, 'Titre requis'),
  amount: z.preprocess((v) => (v === '' ? undefined : Number(v)), z.number().positive('Montant invalide')),
  currency: z.string().length(3),
  category: z.enum(['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ACTIVITIES', 'OTHER']),
  date: z.string().min(1, 'Date requise'),
  notes: z.string().optional(),
});
const CATEGORIES = [
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ACCOMMODATION', label: 'Hébergement' },
  { value: 'FOOD', label: 'Nourriture' },
  { value: 'ACTIVITIES', label: 'Activités' },
  { value: 'OTHER', label: 'Autre' },
];

interface Props {
  defaultValues?: Partial<Expense>;
  onSubmit: (data: Partial<Expense>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ExpenseForm = ({ defaultValues, onSubmit, onCancel, isLoading }: Props) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      amount: defaultValues?.amount ?? undefined,
      currency: defaultValues?.currency ?? 'EUR',
      category: (defaultValues?.category as any) ?? 'TRANSPORT',
      date: defaultValues?.date ? new Date(defaultValues.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: defaultValues?.notes ?? '',
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleValid = (data: any) => {
    onSubmit({ ...data, date: new Date(data.date).toISOString() });
  };

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

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes (optionnel)</label>
        <textarea {...register('notes')} rows={2} className="input-field resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">Annuler</Button>
        <Button type="submit" loading={isLoading} className="flex-1 justify-center">
          {defaultValues ? 'Modifier' : 'Ajouter'}
        </Button>
      </div>
    </form>
  );
};
