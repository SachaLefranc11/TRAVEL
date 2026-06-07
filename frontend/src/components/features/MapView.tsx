import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import { AnimatePresence } from 'framer-motion';
import { MapPin, Sparkles, Loader2, Maximize2, Navigation } from 'lucide-react';
import { Location, LocationType } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { FullscreenMap } from './FullscreenMap';
import { aiService } from '../../services/ai.service';
import { tripsService } from '../../services/trips.service';

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
  /** Active le partage de position live (nécessite l'identité de l'utilisateur). */
  tripId?: string;
  currentUserId?: string;
  /** Masque le bouton « Suggestions IA » si elles ont déjà été générées. */
  aiAlreadyGenerated?: boolean;
}

/** Lien Google Maps directions (origin optionnel "lat,lng"). */
const mapsDirUrl = (lat: number, lng: number, originStr?: string) =>
  `https://www.google.com/maps/dir/?api=1${originStr ? `&origin=${originStr}` : ''}&destination=${lat},${lng}`;

export const MapView = ({ locations, destination, onAdd, onDelete, canEdit, tripId, currentUserId, aiAlreadyGenerated }: Props) => {
  const qc = useQueryClient();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const positionMarkersRef = useRef<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [geoError, setGeoError] = useState('');

  // Positions live des participants (rafraîchies toutes les 30 s)
  const { data: positions = [] } = useQuery({
    queryKey: ['positions', tripId],
    queryFn: () => tripsService.getPositions(tripId!),
    enabled: !!tripId,
    refetchInterval: 30000,
  });
  // Position de l'utilisateur (utilisée comme point de départ des itinéraires)
  const myPos = positions.find((p) => p.userId === currentUserId);
  const myPosStr = myPos ? `${myPos.lat},${myPos.lng}` : '';
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

  const addMarkersToMap = useCallback((L: any, map: any, locs: Location[], originStr?: string) => {
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
          <div style="min-width:180px;max-width:260px">
            <b style="font-size:14px;display:block;margin-bottom:2px">${loc.name}</b>
            <span style="color:#666;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.5px">${TYPE_LABELS[loc.type as LocationType] ?? loc.type}</span>
            ${loc.description ? `<p style="margin:6px 0 0;font-size:12px;color:#444;line-height:1.4">${loc.description}</p>` : ''}
            ${(loc as any).address ? `<p style="margin:5px 0 0;font-size:11px;color:#888;display:flex;align-items:flex-start;gap:3px"><span>📍</span><span>${(loc as any).address}</span></p>` : ''}
            <a href="${mapsDirUrl(loc.lat, loc.lng, originStr)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;color:#4f46e5;font-weight:600;font-size:12px;text-decoration:none">➤ Itinéraire</a>
          </div>
        `);
      markersRef.current.push(marker);
    });
  }, []);

  // Marqueurs des positions live des participants (avatar/initiales)
  const addPositionMarkers = useCallback((L: any, map: any, list: typeof positions) => {
    positionMarkersRef.current.forEach(m => m.remove());
    positionMarkersRef.current = [];
    list.forEach(p => {
      const isSelf = p.userId === currentUserId;
      const initials = p.user.name.charAt(0).toUpperCase();
      const bg = isSelf ? '#4f46e5' : '#0ea5e9';
      const icon = L.divIcon({
        html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${initials}</div>`,
        className: '', iconSize: [30, 30], iconAnchor: [15, 15],
      });
      const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`<b>${p.user.name}${isSelf ? ' (moi)' : ''}</b><br/><span style="font-size:11px;color:#666">Position partagée</span>`);
      positionMarkersRef.current.push(marker);
    });
  }, [currentUserId]);

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
      addMarkersToMap(L, map, locations, myPosStr);

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

  // Mise à jour des marqueurs quand locations (ou la position de départ) change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then(L => addMarkersToMap(L, mapInstanceRef.current, locations, myPosStr));
  }, [locations, myPosStr, addMarkersToMap]);

  // Mise à jour des marqueurs de position live
  useEffect(() => {
    if (!mapInstanceRef.current || !tripId) return;
    import('leaflet').then(L => addPositionMarkers(L, mapInstanceRef.current, positions));
  }, [positions, tripId, addPositionMarkers]);

  // Partage de SA position toutes les 30 s (uniquement quand l'onglet est actif)
  useEffect(() => {
    if (!tripId || !sharing) return;
    let cancelled = false;
    const push = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          tripsService.sendPosition(tripId, pos.coords.latitude, pos.coords.longitude)
            .then(() => qc.invalidateQueries({ queryKey: ['positions', tripId] }))
            .catch(() => { /* ignore erreurs réseau ponctuelles */ });
        },
        () => { if (!cancelled) { setSharing(false); setGeoError('Géolocalisation refusée ou indisponible.'); } },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 },
      );
    };
    push();
    const interval = setInterval(push, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tripId, sharing, qc]);

  const toggleSharing = () => {
    setGeoError('');
    if (sharing) {
      setSharing(false);
      if (tripId) tripsService.stopSharingPosition(tripId)
        .then(() => qc.invalidateQueries({ queryKey: ['positions', tripId] }))
        .catch(() => {});
    } else {
      setSharing(true);
    }
  };

  // Suggestions IA — génération côté serveur (une seule fois par voyage)
  const handleAISuggestions = async () => {
    if (!tripId) { setAiError('Voyage non identifié'); return; }
    setLoadingAI(true);
    setAiError('');
    try {
      await tripsService.generateAiLocations(tripId);
      // Rafraîchit le voyage (nouveaux lieux + flag aiSuggestionsGenerated)
      qc.invalidateQueries({ queryKey: ['trip', tripId] });
      if (destination && mapInstanceRef.current) {
        const result = await aiService.geocode(destination).catch(() => null);
        if (result) mapInstanceRef.current.setView([result.lat, result.lng], result.zoom, { animate: true });
      }
    } catch (err: any) {
      setAiError(err?.response?.data?.error ?? err?.message ?? 'Erreur lors des suggestions IA');
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
      {/* Toolbar */}
      {canEdit && (
        <div className="flex items-center gap-3 flex-wrap">
          {!aiAlreadyGenerated && (
            <Button
              size="sm"
              variant="secondary"
              icon={loadingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              onClick={handleAISuggestions}
              loading={loadingAI}
              disabled={!tripId}
            >
              Suggestions IA
            </Button>
          )}
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

      {/* Partage de position */}
      {tripId && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleSharing}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              sharing
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Navigation size={14} />
            {sharing ? 'Partage de position activé' : 'Partager ma position'}
          </button>
          {sharing && <span className="text-xs text-gray-400">mise à jour toutes les 30 s</span>}
          {positions.length > 0 && (
            <span className="text-xs text-gray-400 ml-auto">{positions.length} participant{positions.length > 1 ? 's' : ''} en ligne</span>
          )}
          {geoError && <p className="text-xs text-red-500 w-full">{geoError}</p>}
        </div>
      )}

      {/* Carte */}
      <div className="relative rounded-xl overflow-hidden shadow-sm border border-gray-200">
        <div ref={mapRef} className="h-96 w-full" />
        <button
          type="button"
          onClick={() => setShowFullscreen(true)}
          className="absolute top-3 right-3 z-[500] flex items-center gap-1.5 bg-white/90 backdrop-blur text-gray-700 text-xs font-medium px-3 py-2 rounded-lg shadow-md hover:bg-white transition-colors"
          title="Afficher en plein écran"
        >
          <Maximize2 size={14} /> Plein écran
        </button>
      </div>

      <AnimatePresence>
        {showFullscreen && (
          <FullscreenMap
            locations={locations}
            positions={positions}
            destination={destination}
            currentUserId={currentUserId}
            canEdit={canEdit}
            sharing={sharing}
            onToggleSharing={toggleSharing}
            onMapClick={canEdit ? (coords) => { setClickCoords(coords); setShowAdd(true); } : undefined}
            onClose={() => setShowFullscreen(false)}
          />
        )}
      </AnimatePresence>

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
                {(loc as any).address && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                    <MapPin size={10} className="flex-shrink-0" />{(loc as any).address}
                  </p>
                )}
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
