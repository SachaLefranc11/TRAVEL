import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRef, useState } from 'react';
import { Upload, Wand2, X, Image as ImageIcon } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Trip } from '../../types';
import { aiService } from '../../services/ai.service';

const schema = z.object({
  title: z.string().min(1, 'Titre requis'),
  destination: z.string().min(1, 'Destination requise'),
  startDate: z.string().min(1, 'Date de départ requise'),
  endDate: z.string().min(1, 'Date de retour requise'),
  description: z.string().optional(),
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
  /** tripId existant (pour upload en mode édition) */
  tripId?: string;
  onImageUploaded?: (url: string) => void;
}

export const TripForm = ({ defaultValues, onSubmit, onCancel, isLoading, error }: Props) => {
  const toDateInput = (d?: string) => d ? new Date(d).toISOString().slice(0, 10) : '';

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? '',
      destination: defaultValues?.destination ?? '',
      startDate: toDateInput(defaultValues?.startDate),
      endDate: toDateInput(defaultValues?.endDate),
      description: defaultValues?.description ?? '',
    },
  });

  const [imagePreview, setImagePreview] = useState<string | null>(defaultValues?.coverImage ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const destination = watch('destination');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setImageError('Format non supporté. Acceptés : JPEG, PNG, WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Fichier trop lourd (max 5 MB)');
      return;
    }
    setImageError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const fetchUnsplashImage = async () => {
    const dest = destination?.trim();
    if (!dest) { setImageError('Saisis une destination d\'abord'); return; }
    setFetchingImage(true);
    setImageError('');
    try {
      const { imageUrl } = await aiService.getDestinationImage(dest);
      if (imageUrl) {
        setImagePreview(imageUrl);
        setImageFile(null); // c'est une URL externe
      } else {
        setImageError('Aucune image trouvée pour cette destination');
      }
    } catch {
      setImageError('Impossible de récupérer une image');
    } finally {
      setFetchingImage(false);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setImageError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleValid = (data: FormData) => {
    const coverImage = imageFile ? undefined : (imagePreview ?? undefined);
    onSubmit({
      ...data,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      coverImage,
      // imageFile est passé séparément via onImageUploaded après création
      _imageFile: imageFile,
    } as any);
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
        <textarea {...register('description')} placeholder="Décrivez votre voyage..." rows={3} className="input-field resize-none" />
      </div>

      {/* Section image */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Image de couverture</label>

        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden h-36 group">
            <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
            >
              <X size={14} className="text-gray-700" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all"
          >
            <ImageIcon size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Clique pour uploader une image</p>
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP — max 5 MB</p>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" icon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()} className="flex-1 justify-center">
            Uploader
          </Button>
          <Button type="button" variant="secondary" size="sm" icon={<Wand2 size={14} />}
            onClick={fetchUnsplashImage} loading={fetchingImage} className="flex-1 justify-center">
            Image IA
          </Button>
        </div>

        {imageError && <p className="text-xs text-red-600">{imageError}</p>}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 justify-center">Annuler</Button>
        <Button type="submit" loading={isLoading} className="flex-1 justify-center">
          {defaultValues?.id ? 'Modifier' : 'Créer'}
        </Button>
      </div>
    </form>
  );
};
