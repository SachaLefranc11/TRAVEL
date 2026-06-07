import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, MapPin, Users, Pencil, Trash2, Plus, UserPlus, ArrowRight, Wallet, X, Check } from 'lucide-react';
import { tripsService } from '../../services/trips.service';
import { aiService } from '../../services/ai.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { TripForm } from '../../components/features/TripForm';
import { MapView } from '../../components/features/MapView';
import { ExpenseChart } from '../../components/features/ExpenseChart';
import { ExpenseForm } from '../../components/features/ExpenseForm';
import { TripPlanner } from '../../components/features/TripPlanner';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { resolveCoverImage } from '../../utils/imageUrl';
import { Expense, ExpenseInput, Location, Trip } from '../../types';

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Une dépense est "perso" si c'est une part dérivée, ou si sa seule part est le
// payeur (ou aucune part legacy). Les dérivées sont privées (vue perso).
const isPersonalExpense = (e: Expense) =>
  !!e.parentExpenseId ||
  !e.shares || e.shares.length === 0 ||
  (e.shares.length === 1 && e.shares[0].userId === e.paidById);

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: 'Transport', ACCOMMODATION: 'Hébergement', FOOD: 'Nourriture',
  ACTIVITIES: 'Activités', OTHER: 'Autre',
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
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'planner' | 'map'>('overview');

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripsService.getOne(id!),
    enabled: !!id,
  });

  const { data: balances } = useQuery({
    queryKey: ['balances', id],
    queryFn: () => tripsService.getBalances(id!),
    enabled: !!id,
  });

  const { data: recordedSettlements } = useQuery({
    queryKey: ['settlements', id],
    queryFn: () => tripsService.getSettlements(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (formData: Partial<Trip> & { _imageFile?: File }) => {
      const { _imageFile, ...data } = formData;
      const updated = await tripsService.update(id!, data);
      if (_imageFile) {
        try {
          await aiService.uploadTripImage(id!, _imageFile);
        } catch (err) {
          console.warn('Upload image échoué', err);
        }
      }
      return updated;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trip', id] }); setShowEdit(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tripsService.delete(id!),
    onSuccess: () => navigate('/'),
  });

  const invalidateTrip = () => {
    qc.invalidateQueries({ queryKey: ['trip', id] });
    qc.invalidateQueries({ queryKey: ['balances', id] });
    qc.invalidateQueries({ queryKey: ['settlements', id] });
  };

  const addExpenseMutation = useMutation({
    mutationFn: (data: ExpenseInput) => tripsService.createExpense(id!, data),
    onSuccess: () => { invalidateTrip(); setShowAddExpense(false); },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ eid, data }: { eid: string; data: ExpenseInput }) => tripsService.updateExpense(id!, eid, data),
    onSuccess: () => { invalidateTrip(); setEditingExpense(null); },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (eid: string) => tripsService.deleteExpense(id!, eid),
    onSuccess: () => invalidateTrip(),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => tripsService.inviteParticipant(id!, email),
    onSuccess: () => { invalidateTrip(); setShowInvite(false); setInviteEmail(''); setInviteError(''); },
    onError: (err: any) => setInviteError(err.response?.data?.error || 'Invitation impossible'),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (userId: string) => tripsService.removeParticipant(id!, userId),
    onSuccess: () => invalidateTrip(),
  });

  const createSettlementMutation = useMutation({
    mutationFn: (data: { fromUserId: string; toUserId: string; amount: number; currency: string }) =>
      tripsService.createSettlement(id!, data),
    onSuccess: () => invalidateTrip(),
  });

  const deleteSettlementMutation = useMutation({
    mutationFn: (sid: string) => tripsService.deleteSettlement(id!, sid),
    onSuccess: () => invalidateTrip(),
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
    <div className="space-y-4 animate-pulse">
      <div className="h-64 bg-gray-200 rounded-2xl" />
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  );

  if (!trip) return <div className="text-center py-16 text-gray-500">Voyage introuvable</div>;

  const isOwner = trip.ownerId === user?.id;
  // Pour les totaux/graphes, on exclut les parts dérivées (sous-parts d'une dépense partagée)
  const realExpenses = (trip.expenses ?? []).filter(e => !e.parentExpenseId);
  const totalExpenses = realExpenses.reduce((s, e) => s + e.amount, 0);

  const nameOf = (userId: string) =>
    trip.participants.find(p => p.user.id === userId)?.user.name ?? 'Inconnu';

  const groupExpenses = (trip.expenses ?? []).filter(e => !isPersonalExpense(e));
  const personalExpenses = (trip.expenses ?? []).filter(e => isPersonalExpense(e));
  const hasSettlements = (balances ?? []).some(b => b.settlements.length > 0);

  const renderExpenseRow = (e: Expense) => (
    <div key={e.id} className="flex items-center gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{e.title}</span>
          <Badge label={CATEGORY_LABELS[e.category] ?? e.category} color={CATEGORY_COLORS[e.category] ?? 'gray'} />
          {!isPersonalExpense(e) && (
            <span className="text-xs text-gray-400">Partagé · {e.shares?.length ?? 0}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(e.date).toLocaleDateString('fr-FR')} · Payé par {e.paidBy.name}
        </p>
        {e.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{e.notes}</p>}
      </div>
      <span className="text-sm font-bold text-gray-900 flex-shrink-0">
        {e.amount.toFixed(2)} {e.currency}
      </span>
      {/* Modifier/supprimer : payeur (= créateur) uniquement ; pas sur les parts dérivées */}
      {!e.parentExpenseId && e.paidById === user?.id && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditingExpense(e)} className="text-gray-300 hover:text-primary-500 transition-colors" title="Modifier">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => { if (confirm('Supprimer cette dépense ?')) deleteExpenseMutation.mutate(e.id); }}
            className="text-gray-300 hover:text-red-400 transition-colors" title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );

  const coverSrc = resolveCoverImage(trip.coverImage)
    || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=300&fit=crop';

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">{trip.title}</h1>
          {isOwner && (
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEdit(true)}>
                Modifier
              </Button>
              <Button
                variant="danger" size="sm" icon={<Trash2 size={14} />}
                loading={deleteMutation.isPending}
                onClick={() => { if (confirm('Supprimer ce voyage définitivement ?')) deleteMutation.mutate(); }}
              >
                Supprimer
              </Button>
            </div>
          )}
        </div>

        {/* Cover */}
        <div className="relative h-64 rounded-2xl overflow-hidden shadow-md">
          <img src={coverSrc} alt={trip.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="flex items-center gap-2 text-white mb-2">
              <MapPin size={18} />
              <span className="font-bold text-xl">{trip.destination}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
              <div className="flex items-center gap-1.5">
                <Calendar size={14} />
                <span>{formatDate(trip.startDate)} → {formatDate(trip.endDate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={14} />
                <span>{trip.participants.length} participant{trip.participants.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['overview', 'expenses', 'planner', 'map'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab === 'overview' ? '📋 Aperçu' : tab === 'expenses' ? '💸 Dépenses' : tab === 'planner' ? '🗓️ Planning' : '🗺️ Carte'}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-900">Informations</h3>
              {trip.description && <p className="text-gray-600 text-sm leading-relaxed">{trip.description}</p>}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Participants</p>
                  {isOwner && (
                    <Button size="sm" variant="ghost" icon={<UserPlus size={14} />} onClick={() => { setInviteError(''); setShowInvite(true); }}>
                      Inviter
                    </Button>
                  )}
                </div>
                {trip.participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                      {p.user.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{p.user.name}</span>
                    {p.role === 'OWNER' && <Badge label="Organisateur" color="blue" />}
                    {isOwner && p.role !== 'OWNER' && (
                      <button
                        onClick={() => { if (confirm(`Retirer ${p.user.name} du voyage ?`)) removeParticipantMutation.mutate(p.user.id); }}
                        className="ml-auto text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Retirer"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Dépenses par catégorie</h3>
              {realExpenses.length > 0 ? (
                <>
                  <ExpenseChart expenses={realExpenses} />
                  <p className="text-center text-sm font-bold text-gray-800 mt-2">
                    Total : {totalExpenses.toFixed(2)} €
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <p className="text-sm">Aucune dépense enregistrée</p>
                  <Button size="sm" className="mt-3" icon={<Plus size={14} />} onClick={() => setActiveTab('expenses')}>
                    Ajouter une dépense
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Expenses */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Dépenses <span className="text-gray-400 font-normal">({trip.expenses?.length ?? 0})</span>
              </h3>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddExpense(true)}>Ajouter</Button>
            </div>

            {/* Récapitulatif des remboursements */}
            {hasSettlements && (
              <div className="card space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Wallet size={16} className="text-primary-600" /> Qui doit quoi
                </h3>
                {balances?.filter(c => c.settlements.length > 0).map(cur => (
                  <div key={cur.currency} className="space-y-2">
                    {(balances?.length ?? 0) > 1 && (
                      <p className="text-xs font-semibold text-gray-400 uppercase">{cur.currency}</p>
                    )}
                    {cur.settlements.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-800">{nameOf(s.fromUserId)}</span>
                        <ArrowRight size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-800">{nameOf(s.toUserId)}</span>
                        <span className="ml-auto font-bold text-primary-700">{s.amount.toFixed(2)} {cur.currency}</span>
                        {/* Seul le créancier (qui reçoit) peut marquer comme remboursé */}
                        {s.toUserId === user?.id && (
                          <button
                            onClick={() => createSettlementMutation.mutate({ fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount, currency: cur.currency })}
                            disabled={createSettlementMutation.isPending}
                            className="ml-1 flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50"
                            title="Marquer comme remboursé"
                          >
                            <Check size={14} /> Remboursé
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Historique des remboursements */}
            {(recordedSettlements?.length ?? 0) > 0 && (
              <div className="card space-y-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Check size={16} className="text-green-600" /> Remboursements
                </h3>
                {recordedSettlements!.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                    <span className="text-gray-600 line-through decoration-gray-300">
                      {s.fromUser.name} → {s.toUser.name}
                    </span>
                    <span className="ml-auto font-medium text-gray-700">{s.amount.toFixed(2)} {s.currency}</span>
                    <span className="text-xs text-gray-400 w-20 text-right">{new Date(s.createdAt).toLocaleDateString('fr-FR')}</span>
                    {s.toUserId === user?.id && (
                      <button
                        onClick={() => { if (confirm('Annuler ce remboursement ?')) deleteSettlementMutation.mutate(s.id); }}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                        title="Annuler le remboursement"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Dépenses de groupe */}
            <div className="card space-y-2">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-primary-600" /> Dépenses partagées
                <span className="text-gray-400 font-normal text-sm">({groupExpenses.length})</span>
              </h3>
              {groupExpenses.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Aucune dépense partagée pour l'instant</p>
              ) : (
                <div className="divide-y divide-gray-50">{groupExpenses.map(renderExpenseRow)}</div>
              )}
            </div>

            {/* Dépenses personnelles */}
            {personalExpenses.length > 0 && (
              <div className="card space-y-2">
                <h3 className="font-semibold text-gray-900">
                  Dépenses personnelles <span className="text-gray-400 font-normal text-sm">({personalExpenses.length})</span>
                </h3>
                <div className="divide-y divide-gray-50">{personalExpenses.map(renderExpenseRow)}</div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Planner */}
        {activeTab === 'planner' && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Planning jour par jour</h3>
            <TripPlanner
              tripId={trip.id}
              startDate={trip.startDate}
              endDate={trip.endDate}
              currentUserId={user?.id ?? ''}
              isOwner={isOwner}
            />
          </div>
        )}

        {/* Tab: Map */}
        {activeTab === 'map' && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              Carte des lieux
              {trip.locations && trip.locations.length > 0 && (
                <span className="text-gray-400 font-normal ml-2">({trip.locations.length} lieux)</span>
              )}
            </h3>
            <MapView
              locations={trip.locations ?? []}
              destination={trip.destination}
              onAdd={(loc) => addLocationMutation.mutate(loc)}
              onDelete={(lid) => deleteLocationMutation.mutate(lid)}
              canEdit={true}
              tripId={trip.id}
              currentUserId={user?.id ?? ''}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier le voyage" size="lg">
        <TripForm
          defaultValues={trip}
          onSubmit={(data) => updateMutation.mutate(data as any)}
          onCancel={() => setShowEdit(false)}
          isLoading={updateMutation.isPending}
          tripId={id}
        />
      </Modal>

      <Modal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} title="Ajouter une dépense">
        <ExpenseForm
          participants={trip.participants}
          currentUserId={user?.id ?? ''}
          onSubmit={(data) => addExpenseMutation.mutate(data)}
          onCancel={() => setShowAddExpense(false)}
          isLoading={addExpenseMutation.isPending}
        />
      </Modal>

      <Modal isOpen={!!editingExpense} onClose={() => setEditingExpense(null)} title="Modifier la dépense">
        {editingExpense && (
          <ExpenseForm
            participants={trip.participants}
            currentUserId={user?.id ?? ''}
            defaultExpense={editingExpense}
            onSubmit={(data) => updateExpenseMutation.mutate({ eid: editingExpense.id, data })}
            onCancel={() => setEditingExpense(null)}
            isLoading={updateExpenseMutation.isPending}
          />
        )}
      </Modal>

      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Inviter un participant" size="sm">
        <form
          onSubmit={(e) => { e.preventDefault(); if (inviteEmail) inviteMutation.mutate(inviteEmail); }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-500">
            La personne doit déjà avoir un compte Travel. Saisissez son email.
          </p>
          <Input
            label="Email"
            type="email"
            placeholder="ami@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          {inviteError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{inviteError}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowInvite(false)} className="flex-1 justify-center">Annuler</Button>
            <Button type="submit" loading={inviteMutation.isPending} disabled={!inviteEmail} className="flex-1 justify-center">Inviter</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
