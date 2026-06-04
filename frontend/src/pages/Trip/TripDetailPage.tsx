import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, MapPin, Users, Pencil, Trash2, Plus } from 'lucide-react';
import { tripsService } from '../../services/trips.service';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TripForm } from '../../components/features/TripForm';
import { MapView } from '../../components/features/MapView';
import { ExpenseChart } from '../../components/features/ExpenseChart';
import { ExpenseForm } from '../../components/features/ExpenseForm';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { Expense, Location, Trip } from '../../types';

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport', ACCOMMODATION: 'Hébergement', FOOD: 'Nourriture', ACTIVITIES: 'Activités', OTHER: 'Autre',
};
const CATEGORY_COLORS: Record<string, 'blue' | 'purple' | 'orange' | 'green' | 'gray'> = {
  TRANSPORT: 'blue', ACCOMMODATION: 'purple', FOOD: 'orange', ACTIVITIES: 'green', OTHER: 'gray',
};

export const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'map'>('overview');

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripsService.getOne(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Trip>) => tripsService.update(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trip', id] }); setShowEdit(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tripsService.delete(id!),
    onSuccess: () => navigate('/'),
  });

  const addExpenseMutation = useMutation({
    mutationFn: (data: Partial<Expense>) => tripsService.createExpense(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trip', id] }); setShowAddExpense(false); },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (eid: string) => tripsService.deleteExpense(id!, eid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip', id] }),
  });

  const addLocationMutation = useMutation({
    mutationFn: (data: Omit<Location, 'id' | 'tripId'>) => tripsService.createLocation(id!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip', id] }),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (lid: string) => tripsService.deleteLocation(id!, lid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip', id] }),
  });

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-64 bg-gray-200 rounded-2xl animate-pulse" />
      <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
    </div>
  );

  if (!trip) return <div className="text-center py-16 text-gray-500">Voyage introuvable</div>;

  const isOwner = trip.ownerId === user?.id;
  const totalExpenses = trip.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">{trip.title}</h1>
          {isOwner && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEdit(true)}>Modifier</Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} loading={deleteMutation.isPending}
                onClick={() => { if (confirm('Supprimer ce voyage ?')) deleteMutation.mutate(); }}>
                Supprimer
              </Button>
            </div>
          )}
        </div>

        <div className="relative h-64 rounded-2xl overflow-hidden">
          <img
            src={trip.coverImage || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=300&fit=crop'}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <div className="flex items-center gap-2 text-white mb-2">
              <MapPin size={16} />
              <span className="font-semibold text-lg">{trip.destination}</span>
            </div>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              <div className="flex items-center gap-1"><Calendar size={14} /><span>{formatDate(trip.startDate)} → {formatDate(trip.endDate)}</span></div>
              <div className="flex items-center gap-1"><Users size={14} /><span>{trip.participants.length} participant{trip.participants.length > 1 ? 's' : ''}</span></div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['overview', 'expenses', 'map'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {tab === 'overview' ? 'Aperçu' : tab === 'expenses' ? 'Dépenses' : 'Carte'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-900">Informations</h3>
              {trip.description && <p className="text-gray-600 text-sm">{trip.description}</p>}
              <div className="space-y-2">
                {trip.participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-medium">
                      {p.user.name[0]}
                    </div>
                    <span className="text-sm text-gray-700">{p.user.name}</span>
                    {p.role === 'OWNER' && <Badge label="Organisateur" color="blue" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Dépenses par catégorie</h3>
              {(trip.expenses?.length ?? 0) > 0 ? (
                <>
                  <ExpenseChart expenses={trip.expenses ?? []} />
                  <p className="text-center text-sm font-semibold text-gray-800 mt-2">Total : {totalExpenses.toFixed(2)} €</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm text-center py-8">Aucune dépense enregistrée</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Dépenses ({trip.expenses?.length ?? 0})</h3>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddExpense(true)}>Ajouter</Button>
            </div>
            {(trip.expenses?.length ?? 0) === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Aucune dépense pour l'instant</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {trip.expenses?.map(e => (
                  <div key={e.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{e.title}</span>
                        <Badge label={CATEGORY_LABELS[e.category] ?? e.category} color={CATEGORY_COLORS[e.category] ?? 'gray'} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(e.date).toLocaleDateString('fr-FR')} · Payé par {e.paidBy.name}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{e.amount.toFixed(2)} {e.currency}</span>
                    {(isOwner || e.paidById === user?.id) && (
                      <button onClick={() => deleteExpenseMutation.mutate(e.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between pt-3 font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{totalExpenses.toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Carte des lieux</h3>
            <MapView
              locations={trip.locations ?? []}
              onAdd={(loc) => addLocationMutation.mutate(loc)}
              onDelete={(lid) => deleteLocationMutation.mutate(lid)}
              canEdit={true}
            />
          </div>
        )}
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier le voyage">
        <TripForm
          defaultValues={trip}
          onSubmit={(data) => updateMutation.mutate(data)}
          onCancel={() => setShowEdit(false)}
          isLoading={updateMutation.isPending}
        />
      </Modal>

      <Modal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} title="Ajouter une dépense">
        <ExpenseForm
          onSubmit={(data) => addExpenseMutation.mutate(data)}
          onCancel={() => setShowAddExpense(false)}
          isLoading={addExpenseMutation.isPending}
        />
      </Modal>
    </>
  );
};
