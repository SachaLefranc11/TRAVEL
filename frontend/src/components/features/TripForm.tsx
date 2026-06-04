import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Trip } from '../../types';

const schema = z.object({
  title: z.string().min(1, 'Titre requis'),
  destination: z.string().min(1, 'Destination requise'),
  startDate: z.string().min(1, 'Date de départ requise'),
  endDate: z.string().min(1, 'Date de retour requise'),
  description: z.string().optional(),
  coverImage: z.string().url('URL invalide').optional().or(z.literal('')),
}).refine(d => !d.startDate || !d.endDate || d.startDate <= d.endDate, {
  message: 'La date de retour doit être après le départ',
  path: ['endDate'],
});

type FormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<Trip>;
  onSubmit: (data: Partial<Trip>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export const TripForm = ({ defaultValues, onSubmit, onCancel, isLoading, error }: Props) => {
  const toDateInput = (d?: string) => d ? new Date(d).toISOString().slice(0, 10) : '';

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      destination: defaultValues?.destination ?? '',
      startDate: toDateInput(defaultValues?.startDate),
      endDate: toDateInput(defaultValues?.endDate),
      description: defaultValues?.description ?? '',
      coverImage: defaultValues?.coverImage ?? '',
    },
  });

  const handleValid = (data: FormData) => {
    onSubmit({
      ...data,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      coverImage: data.coverImage || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleValid)} className="space-y-4">
      <Input label="Titre du voyage" placeholder="Vacances à Paris" {...register('title')} error={errors.title?.message} />
      <Input label="Destination" placeholder="Paris, France" {...register('destination')} error={errors.destination?.message} />

      <div className="grid grid-cols-2 gap-4">
        <Input label="Départ" type="date" {...register('startDate')} error={errors.startDate?.message} />
        <Input label="Retour" type="date" {...register('endDate')} error={errors.endDate?.message} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Description</label>
        <textarea
          {...register('description')}
          placeholder="Décrivez votre voyage..."
          rows={3}
          className="input-field resize-none"
        />
      </div>

      <Input label="Image de couverture (URL)" placeholder="https://..." {...register('coverImage')} error={errors.coverImage?.message} />

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">Annuler</Button>
        <Button type="submit" loading={isLoading} className="flex-1 justify-center">
          {defaultValues ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
};
