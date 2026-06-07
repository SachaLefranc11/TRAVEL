import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls, Variants } from 'framer-motion';
import { ArrowLeft, Plus, Minus, Crosshair, Navigation, MapPin } from 'lucide-react';
import { Location, LocationType, LivePosition } from '../../types';

const TYPE_COLORS: Record<LocationType, string> = {
  ATTRACTION: '#3b82f6', RESTAURANT: '#f97316', HOTEL: '#8b5cf6', ACTIVITY: '#10b981', OTHER: '#6b7280',
};
const TYPE_LABELS: Record<LocationType, string> = {
  ATTRACTION: 'Attraction', RESTAURANT: 'Restaurant', HOTEL: 'Hôtel', ACTIVITY: 'Activité', OTHER: 'Autre',
};

/** Lien Google Maps directions (origin optionnel "lat,lng"). */
const mapsDirUrl = (lat: number, lng: number, originStr?: string) =>
  `https://www.google.com/maps/dir/?api=1${originStr ? `&origin=${originStr}` : ''}&destination=${lat},${lng}`;

interface Props {
  locations: Location[];
  positions: LivePosition[];
  destination?: string;
  currentUserId?: string;
  canEdit?: boolean;
  sharing: boolean;
  onToggleSharing: () => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

const fabContainer: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.35, staggerChildren: 0.07 } },
};
const fabItem: Variants = {
  hidden: { opacity: 0, scale: 0.4, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 22 } },
};

export const FullscreenMap = ({
  locations, positions, destination, currentUserId, canEdit,
  sharing, onToggleSharing, onMapClick, onClose,
}: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const locMarkersRef = useRef<any[]>([]);
  const posMarkersRef = useRef<any[]>([]);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const dragControls = useDragControls();
  const [ready, setReady] = useState(false);

  // Initialisation de la carte (une seule fois)
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    let cancelled = false;
    let drawTimer: ReturnType<typeof setInterval> | undefined;

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const center: [number, number] = locations.length > 0 ? [locations[0].lat, locations[0].lng] : [20, 0];
      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, locations.length > 0 ? 12 : 2);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      if (locations.length > 1) {
        map.fitBounds(L.latLngBounds(locations.map(l => [l.lat, l.lng] as [number, number])), { padding: [60, 60] });
        // Tracé progressif de l'itinéraire
        const pts = locations.map(l => [l.lat, l.lng] as [number, number]);
        const line = L.polyline([], { color: '#4f46e5', weight: 3, opacity: 0.8, dashArray: '6 8' }).addTo(map);
        let i = 1;
        drawTimer = setInterval(() => {
          if (i > pts.length) { if (drawTimer) clearInterval(drawTimer); return; }
          line.setLatLngs(pts.slice(0, i)); i++;
        }, 140);
      }

      // Clic sur la carte pour ajouter un lieu (parité avec la vue normale)
      map.on('click', (e: any) => {
        if (onMapClickRef.current) onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      setReady(true);
      setTimeout(() => map.invalidateSize(), 320);
    });

    return () => {
      cancelled = true;
      if (drawTimer) clearInterval(drawTimer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Point de départ des itinéraires = position live de l'utilisateur si dispo
  const selfPos = positions.find((p) => p.userId === currentUserId);
  const originStr = selfPos ? `${selfPos.lat},${selfPos.lng}` : '';

  // Marqueurs des lieux (synchronisés avec la prop locations)
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    import('leaflet').then((L) => {
      locMarkersRef.current.forEach(m => m.remove());
      locMarkersRef.current = [];
      locations.forEach((loc) => {
        const color = TYPE_COLORS[loc.type as LocationType] ?? '#6b7280';
        const icon = L.divIcon({
          html: `<div class="pulse-marker" style="--c:${color}"></div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
        });
        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(mapInstance.current).bindPopup(`
          <div style="min-width:160px">
            <b style="font-size:14px">${loc.name}</b><br/>
            <span style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.5px">${TYPE_LABELS[loc.type as LocationType] ?? loc.type}</span>
            ${loc.description ? `<p style="margin:6px 0 0;font-size:12px;color:#444">${loc.description}</p>` : ''}
            <a href="${mapsDirUrl(loc.lat, loc.lng, originStr)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;color:#4f46e5;font-weight:600;font-size:12px;text-decoration:none">➤ Itinéraire</a>
          </div>`);
        locMarkersRef.current.push(marker);
      });
    });
  }, [ready, locations, originStr]);

  // Marqueurs des positions live des participants (synchronisés avec la prop positions)
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    import('leaflet').then((L) => {
      posMarkersRef.current.forEach(m => m.remove());
      posMarkersRef.current = [];
      positions.forEach((p) => {
        const isSelf = p.userId === currentUserId;
        const bg = isSelf ? '#4f46e5' : '#0ea5e9';
        const icon = L.divIcon({
          html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${p.user.name.charAt(0).toUpperCase()}</div>`,
          className: '', iconSize: [30, 30], iconAnchor: [15, 15],
        });
        const marker = L.marker([p.lat, p.lng], { icon, zIndexOffset: 1000 })
          .addTo(mapInstance.current)
          .bindPopup(`<b>${p.user.name}${isSelf ? ' (moi)' : ''}</b><br/><span style="font-size:11px;color:#666">Position partagée</span>`);
        posMarkersRef.current.push(marker);
      });
    });
  }, [ready, positions, currentUserId]);

  const zoom = (delta: number) => mapInstance.current?.setZoom(mapInstance.current.getZoom() + delta);
  const recenter = () => {
    if (!mapInstance.current || locations.length === 0) return;
    import('leaflet').then((L) => {
      if (locations.length === 1) mapInstance.current.setView([locations[0].lat, locations[0].lng], 13, { animate: true });
      else mapInstance.current.fitBounds(L.latLngBounds(locations.map(l => [l.lat, l.lng] as [number, number])), { padding: [60, 60] });
    });
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 bg-gray-900"
      style={{ zIndex: 10000 }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_e, info) => { if (info.offset.y > 120) onClose(); }}
    >
      {/* Poignée de glissement (swipe-down pour fermer, mobile) */}
      <div
        className="absolute top-0 left-0 right-0 z-[20] flex justify-center pt-2 pb-4 cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="w-12 h-1.5 rounded-full bg-white/70 shadow" />
      </div>

      {/* Carte (révélation en fondu). zIndex:0 => contexte d'empilement isolé :
          les panes Leaflet ne peuvent plus passer au-dessus des boutons (z-[20]). */}
      <motion.div
        ref={mapRef}
        className="absolute inset-0"
        style={{ zIndex: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      />

      {/* Bouton Retour (haut gauche) */}
      <motion.button
        onClick={onClose}
        className="absolute top-4 left-4 z-[20] flex items-center gap-1.5 bg-white text-gray-800 px-3.5 py-2 rounded-full shadow-xl hover:bg-gray-50 font-medium text-sm"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ delay: 0.25 }}
      >
        <ArrowLeft size={18} /> Retour
      </motion.button>

      {/* Infos destination (sous le bouton retour) */}
      {destination && (
        <motion.div
          className="absolute top-16 left-4 z-[20] bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-sm font-semibold text-gray-900">{destination}</p>
          <p className="text-xs text-gray-500">{locations.length} lieu{locations.length > 1 ? 'x' : ''}</p>
        </motion.div>
      )}

      {/* Hint ajout de lieu */}
      {canEdit && (
        <div className="absolute bottom-6 left-4 z-[20] bg-white/85 backdrop-blur text-gray-600 text-xs px-3 py-2 rounded-lg shadow">
          <MapPin size={12} className="inline mr-1" />Cliquez sur la carte pour ajouter un lieu
        </div>
      )}

      {/* Boutons flottants (cascade) — parité avec la vue normale */}
      <motion.div
        className="absolute bottom-6 right-6 z-[20] flex flex-col gap-3"
        variants={fabContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.button
          variants={fabItem}
          onClick={onToggleSharing}
          title={sharing ? 'Arrêter le partage de position' : 'Partager ma position'}
          className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center ${
            sharing ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Navigation size={18} />
        </motion.button>
        <motion.button variants={fabItem} onClick={recenter}
          className="w-11 h-11 rounded-full bg-white text-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50">
          <Crosshair size={18} />
        </motion.button>
        <motion.button variants={fabItem} onClick={() => zoom(1)}
          className="w-11 h-11 rounded-full bg-white text-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50">
          <Plus size={18} />
        </motion.button>
        <motion.button variants={fabItem} onClick={() => zoom(-1)}
          className="w-11 h-11 rounded-full bg-white text-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50">
          <Minus size={18} />
        </motion.button>
      </motion.div>
    </motion.div>,
    document.body
  );
};
