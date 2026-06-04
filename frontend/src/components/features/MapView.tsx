import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Sparkles, Loader2 } from 'lucide-react';
import { Location, LocationType } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { aiService, ActivitySuggestion } from '../../services/ai.service';

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
  destination?: string;
  onAdd?: (loc: Omit<Location, 'id' | 'tripId'>) => void;
  onDelete?: (lid: string) => void;
  canEdit?: boolean;
}

export const MapView = ({ locations, destination, onAdd, onDelete, canEdit }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newLoc, setNewLoc] = useState({ name: '', type: 'ATTRACTION' as LocationType, description: '' });
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Géolocalisation automatique de la destination
  const geocodeAndCenter = useCallback(async (map: any, dest: string) => {
    if (!dest || !map) return;
    setGeocoding(true);
    try {
      const result = await aiService.geocode(dest);
      if (result && map) {
        map.setView([result.lat, result.lng], result.zoom, { animate: true });
      }
    } catch {
      // silencieux
    } finally {
      setGeocoding(false);
    }
  }, []);

  const addMarkersToMap = useCallback((L: any, map: any, locs: Location[]) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    locs.forEach(loc => {
      const color = TYPE_COLORS[loc.type as LocationType] ?? '#6b7280';
      const icon = L.divIcon({
        html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;"></div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:150px">
            <b style="font-size:14px">${loc.name}</b><br>
            <span style="color:#888;font-size:12px">${TYPE_LABELS[loc.type as LocationType] ?? loc.type}</span>
            ${loc.description ? `<p style="margin:4px 0 0;font-size:12px;color:#444">${loc.description}</p>` : ''}
          </div>
        `);
      markersRef.current.push(marker);
    });
  }, []);

  // Initialisation de la carte
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const center: [number, number] = locations.length > 0
        ? [locations[0].lat, locations[0].lng]
        : [20, 0];

      const map = L.map(mapRef.current!, { zoomControl: true })
        .setView(center, locations.length > 0 ? 12 : 2);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      addMarkersToMap(L, map, locations);

      if (canEdit) {
        map.on('click', (e: any) => {
          setClickCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          setShowAdd(true);
        });
      }

      // Géolocaliser la destination automatiquement
      if (destination) {
        if (locations.length === 0) {
          geocodeAndCenter(map, destination);
        }
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mise à jour des marqueurs quand locations change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then(L => addMarkersToMap(L, mapInstanceRef.current, locations));
  }, [locations, addMarkersToMap]);

  // Suggestions IA — charge les activités et les ajoute comme lieux
  const handleAISuggestions = async () => {
    if (!destination) { setAiError('Destination non définie'); return; }
    setLoadingAI(true);
    setAiError('');
    try {
      const { activities } = await aiService.getActivities(destination);
      if (activities.length === 0) {
        setAiError('Aucune suggestion trouvée pour cette destination');
        return;
      }
      // Centrer la carte sur la destination
      if (mapInstanceRef.current) {
        const result = await aiService.geocode(destination);
        if (result) mapInstanceRef.current.setView([result.lat, result.lng], result.zoom, { animate: true });
      }
      // Ajouter chaque activité comme location
      activities.forEach((act: ActivitySuggestion) => {
        if (act.lat && act.lng && onAdd) {
          onAdd({
            name: act.name,
            type: act.category as LocationType,
            lat: act.lat,
            lng: act.lng,
            description: act.description,
          });
        }
      });
    } catch {
      setAiError('Erreur lors du chargement des suggestions IA');
    } finally {
      setLoadingAI(false);
    }
  };

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

      {/* Toolbar */}
      {canEdit && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            icon={loadingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            onClick={handleAISuggestions}
            loading={loadingAI}
            disabled={!destination}
          >
            Suggestions IA
          </Button>
          {geocoding && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Localisation en cours…
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            <MapPin size={12} className="inline mr-1" />Cliquez sur la carte pour ajouter un lieu
          </span>
          {aiError && <p className="text-xs text-red-500 w-full">{aiError}</p>}
        </div>
      )}

      {/* Carte */}
      <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <div ref={mapRef} className="h-96 w-full" />
      </div>

      {/* Liste des lieux */}
      {locations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                style={{ background: TYPE_COLORS[loc.type as LocationType] ?? '#6b7280' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loc.name}</p>
                <p className="text-xs text-gray-500">{TYPE_LABELS[loc.type as LocationType] ?? loc.type}</p>
                {loc.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{loc.description}</p>}
              </div>
              {canEdit && onDelete && (
                <button
                  onClick={() => onDelete(loc.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal ajout manuel */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Ajouter un lieu" size="sm">
        <div className="space-y-4">
          <Input
            label="Nom du lieu"
            value={newLoc.name}
            onChange={e => setNewLoc(p => ({ ...p, name: e.target.value }))}
            placeholder="Tour Eiffel"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Type</label>
            <select
              value={newLoc.type}
              onChange={e => setNewLoc(p => ({ ...p, type: e.target.value as LocationType }))}
              className="input-field"
            >
              {(Object.entries(TYPE_LABELS) as [LocationType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <Input
            label="Description (optionnel)"
            value={newLoc.description}
            onChange={e => setNewLoc(p => ({ ...p, description: e.target.value }))}
          />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowAdd(false)} className="flex-1 justify-center">Annuler</Button>
            <Button onClick={handleAddSubmit} className="flex-1 justify-center" disabled={!newLoc.name}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
