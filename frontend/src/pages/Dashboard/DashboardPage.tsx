import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Plane, TrendingUp, MapPin } from 'lucide-react';
import { tripsService } from '../../services/trips.service';
import { aiService } from '../../services/ai.service';
import { TripCard } from '../../components/features/TripCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TripForm } from '../../components/features/TripForm';
import { useAuth } from '../../contexts/AuthContext';
import { Trip } from '../../types';

export const DashboardPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: tripsService.getAll,
  });

  const createMutation = useMutation({
    mutationFn: async (formData: Partial<Trip> & { _imageFile?: File }) => {
      const { _imageFile, ...data } = formData;
      // 1. Créer le voyage
      const trip = await tripsService.create(data);
      // 2. Si une image locale a été sélectionnée, l'uploader
      if (_imageFile) {
        try {
          await aiService.uploadTripImage(trip.id, _imageFile);
        } catch (err) {
          console.warn('Upload image échoué, on continue', err);
        }
      }
      return trip;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      setShowCreate(false);
    },
  });

  const upcoming = trips.filter(t => new Date(t.endDate) >= new Date());
  const totalExpenses = trips.reduce((sum, t) =>
    sum + (t.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0), 0);

  return (
    <>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bonjour, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-gray-500 mt-1">Gérez vos aventures</p>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            Nouveau voyage
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={<Plane />} label="Voyages" value={trips.length} color="blue" />
          <StatCard icon={<MapPin />} label="À venir" value={upcoming.length} color="green" />
          <StatCard icon={<TrendingUp />} label="Dépenses totales" value={`${totalExpenses.toFixed(0)} €`} color="orange" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes voyages</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
              <Plane size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-gray-500 font-medium">Aucun voyage pour l'instant</h3>
              <p className="text-gray-400 text-sm mt-1">Créez votre premier voyage pour commencer</p>
              <Button className="mt-4" icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                Créer un voyage
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {trips.map((trip, i) => <TripCard key={trip.id} trip={trip} index={i} />)}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Nouveau voyage" size="lg">
        <TripForm
          onSubmit={(data) => createMutation.mutate(data as any)}
          onCancel={() => setShowCreate(false)}
          isLoading={createMutation.isPending}
          error={createMutation.error ? 'Erreur lors de la création' : undefined}
        />
      </Modal>
    </>
  );
};

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
};

const StatCard = ({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: 'blue' | 'green' | 'orange'
}) => (
  <div className="card flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);
