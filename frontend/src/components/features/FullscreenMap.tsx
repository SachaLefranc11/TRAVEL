import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls, Variants } from 'framer-motion';
import { X, Plus, Minus, Crosshair } from 'lucide-react';
import { Location, LocationType } from '../../types';

const TYPE_COLORS: Record<LocationType, string> = {
  ATTRACTION: '#3b82f6', RESTAURANT: '#f97316', HOTEL: '#8b5cf6', ACTIVITY: '#10b981', OTHER: '#6b7280',
};

interface Props {
  locations: Location[];
  destination?: string;
  onClose: () => void;
}

const fabContainer: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.35, staggerChildren: 0.08 } },
};
const fabItem: Variants = {
  hidden: { opacity: 0, scale: 0.4, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 22 } },
};

export const FullscreenMap = ({ locations, destination, onClose }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    let cancelled = false;
    let drawTimer: ReturnType<typeof setInterval> | undefined;

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const center: [number, number] = locations.length > 0
        ? [locations[0].lat, locations[0].lng] : [20, 0];
      const map = L.map(mapRef.current, { zoomControl: false })
        .setView(center, locations.length > 0 ? 12 : 2);
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Marqueurs animés (pulse)
      locations.forEach((loc) => {
        const color = TYPE_COLORS[loc.type as LocationType] ?? '#6b7280';
        const icon = L.divIcon({
          html: `<div class="pulse-marker" style="--c:${color}"></div>`,
          className: '', iconSize: [18, 18], iconAnchor: [9, 9],
        });
        L.marker([loc.lat, loc.lng], { icon }).addTo(map).bindPopup(`<b>${loc.name}</b>`);
      });

      // Ajuste la vue sur l'ensemble des points
      if (locations.length > 1) {
        const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [60, 60] });

        // Tracé progressif de l'itinéraire (effet "se dessine")
        const pts = locations.map(l => [l.lat, l.lng] as [number, number]);
        const line = L.polyline([], { color: '#4f46e5', weight: 3, opacity: 0.8, dashArray: '6 8' }).addTo(map);
        let i = 1;
        drawTimer = setInterval(() => {
          if (i > pts.length) { if (drawTimer) clearInterval(drawTimer); return; }
          line.setLatLngs(pts.slice(0, i));
          i++;
        }, 140);
      }

      // La carte est dans un conteneur animé → recalcule sa taille
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
      {/* Poignée de glissement (swipe-down pour fermer, surtout mobile) */}
      <div
        className="absolute top-0 left-0 right-0 z-[2] flex justify-center pt-2 pb-4 cursor-grab active:cursor-grabbing touch-none"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="w-12 h-1.5 rounded-full bg-white/70 shadow" />
      </div>

      {/* La carte — révélée en fondu (effet cinématique) */}
      <motion.div
        ref={mapRef}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      />

      {/* Titre destination */}
      {destination && (
        <motion.div
          className="absolute top-4 left-4 z-[2] bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm font-semibold text-gray-900">{destination}</p>
          <p className="text-xs text-gray-500">{locations.length} lieu{locations.length > 1 ? 'x' : ''}</p>
        </motion.div>
      )}

      {/* Boutons flottants (apparition en cascade) */}
      <motion.div
        className="absolute bottom-6 right-6 z-[2] flex flex-col gap-3"
        variants={fabContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.button variants={fabItem} onClick={onClose}
          className="w-12 h-12 rounded-full bg-white text-gray-800 shadow-xl flex items-center justify-center hover:bg-gray-50">
          <X size={20} />
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
