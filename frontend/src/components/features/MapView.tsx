import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Location, LocationType } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';

const TYPE_COLORS: Record<LocationType, string> = {
  ATTRACTION: '#3b82f6',
  RESTAURANT: '#f97316',
  HOTEL: '#8b5cf6',
  ACTIVITY: '#10b981',
  OTHER: '#6b7280',
};

const TYPE_LABELS: Record<LocationType, string> = {
  ATTRACTION: 'Attraction',
  RESTAURANT: 'Restaurant',
  HOTEL: 'Hôtel',
  ACTIVITY: 'Activité',
  OTHER: 'Autre',
};

interface Props {
  locations: Location[];
  onAdd?: (loc: Omit<Location, 'id' | 'tripId'>) => void;
  onDelete?: (lid: string) => void;
  canEdit?: boolean;
}

export const MapView = ({ locations, onAdd, onDelete, canEdit }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newLoc, setNewLoc] = useState({ name: '', type: 'ATTRACTION' as LocationType, description: '' });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center = locations.length > 0
        ? [locations[0].lat, locations[0].lng] as [number, number]
        : [48.8566, 2.3522] as [number, number];

      const map = L.map(mapRef.current!).setView(center, locations.length > 0 ? 12 : 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      mapInstanceRef.current = map;

      if (canEdit) {
        map.on('click', (e: any) => {
          setClickCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          setShowAdd(true);
        });
      }

      addMarkers(L, map, locations);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const addMarkers = (L: any, map: any, locs: Location[]) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    locs.forEach(loc => {
      const icon = L.divIcon({
        html: `<div style="background:${TYPE_COLORS[loc.type as LocationType]};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup(`<b>${loc.name}</b><br><span style="color:#666">${TYPE_LABELS[loc.type as LocationType]}</span>${loc.description ? `<br>${loc.description}` : ''}`);
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then(L => addMarkers(L, mapInstanceRef.current, locations));
  }, [locations]);

  const handleAddSubmit = () => {
    if (!clickCoords || !newLoc.name) return;
    onAdd?.({ ...newLoc, lat: clickCoords.lat, lng: clickCoords.lng });
    setShowAdd(false);
    setNewLoc({ name: '', type: 'ATTRACTION', description: '' });
    setClickCoords(null);
  };

  return (
    <div className="space-y-4">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <div ref={mapRef} className="h-80 w-full" />
        {canEdit && (
          <div className="absolute top-3 right-3 bg-white rounded-lg shadow px-3 py-1.5 text-xs text-gray-600 flex items-center gap-1">
            <MapPin size={12} /> Cliquez sur la carte pour ajouter
          </div>
        )}
      </div>

      {locations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[loc.type as LocationType] }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loc.name}</p>
                <p className="text-xs text-gray-500">{TYPE_LABELS[loc.type as LocationType]}</p>
              </div>
              {canEdit && onDelete && (
                <button onClick={() => onDelete(loc.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un lieu" size="sm">
        <div className="space-y-4">
          <Input label="Nom du lieu" value={newLoc.name} onChange={e => setNewLoc(p => ({ ...p, name: e.target.value }))} placeholder="Tour Eiffel" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Type</label>
            <select
              value={newLoc.type}
              onChange={e => setNewLoc(p => ({ ...p, type: e.target.value as LocationType }))}
              className="input-field"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Input label="Description (optionnel)" value={newLoc.description} onChange={e => setNewLoc(p => ({ ...p, description: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowAdd(false)} className="flex-1 justify-center">Annuler</Button>
            <Button onClick={handleAddSubmit} className="flex-1 justify-center" disabled={!newLoc.name}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
