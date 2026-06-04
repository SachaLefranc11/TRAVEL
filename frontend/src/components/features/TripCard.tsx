import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, DollarSign } from 'lucide-react';
import { Trip } from '../../types';

const COVER_FALLBACKS = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=200&fit=crop',
  'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=400&h=200&fit=crop',
];

const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const getDuration = (start: string, end: string) => {
  const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return `${days} jour${days > 1 ? 's' : ''}`;
};

interface Props { trip: Trip; index?: number; }

export const TripCard = ({ trip, index = 0 }: Props) => {
  const cover = trip.coverImage || COVER_FALLBACKS[index % COVER_FALLBACKS.length];
  const totalExpenses = trip.expenses?.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <Link to={`/trips/${trip.id}`} className="block group">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        <div className="relative h-44 overflow-hidden">
          <img src={cover} alt={trip.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="text-white font-semibold text-lg leading-tight">{trip.title}</h3>
            <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
              <MapPin size={12} />
              <span>{trip.destination}</span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-primary-500" />
              <span>{formatDate(trip.startDate)}</span>
            </div>
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
              {getDuration(trip.startDate, trip.endDate)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Users size={14} className="text-primary-500" />
              <span>{trip.participants.length} participant{trip.participants.length > 1 ? 's' : ''}</span>
            </div>
            {(trip._count?.expenses ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-sm font-medium text-gray-800">
                <DollarSign size={14} className="text-accent-500" />
                <span>{totalExpenses.toFixed(0)} {trip.expenses?.[0]?.currency ?? 'EUR'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
