import axios from 'axios';
import { GeocodeResponse, ActivitySuggestion } from '../dtos/ai-suggestion.dto';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS  = 'https://overpass-api.de/api/interpreter';
const HEADERS   = { 'User-Agent': 'TravelApp/1.0 (contact@travel-app.dev)' };

/** Géocode un texte libre via Nominatim. Retourne null si introuvable. */
const nominatimSearch = async (q: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const { data } = await axios.get(`${NOMINATIM}/search`, {
      headers: HEADERS,
      params: { q, format: 'json', limit: 1 },
      timeout: 5000,
    });
    if (!data?.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
};

/** Géolocalise une destination et retourne lat/lng + zoom recommandé. */
export const geocodeDestination = async (destination: string): Promise<GeocodeResponse | null> => {
  try {
    const { data } = await axios.get(`${NOMINATIM}/search`, {
      headers: HEADERS,
      params: { q: destination, format: 'json', limit: 1, addressdetails: 1 },
      timeout: 8000,
    });
    if (!data?.length) return null;
    const r    = data[0];
    const lat  = parseFloat(r.lat);
    const lng  = parseFloat(r.lon);
    const type: string = r.type ?? '';
    const zoom = ['city', 'town', 'village'].includes(type) ? 12
      : ['country', 'state'].includes(type) ? 6 : 13;
    return { lat, lng, displayName: r.display_name, zoom };
  } catch (err: any) {
    console.error('[Geocoding] Nominatim:', err?.message);
    return null;
  }
};

/**
 * Enrichit les activités avec des coordonnées GPS.
 * Toutes les requêtes se font EN PARALLÈLE (max 5 à la fois) pour éviter 17s d'attente.
 */
export const enrichWithCoordinates = async (
  activities: ActivitySuggestion[],
  destLat: number,
  destLng: number,
): Promise<ActivitySuggestion[]> => {

  // Découpe en batches de 5 pour ne pas surcharger Nominatim
  const BATCH = 5;
  const results: ActivitySuggestion[] = [];

  for (let i = 0; i < activities.length; i += BATCH) {
    const batch = activities.slice(i, i + BATCH);

    const resolved = await Promise.all(
      batch.map(async (activity): Promise<ActivitySuggestion> => {
        // Déjà géocodé
        if (activity.lat && activity.lng) return activity;

        // Stratégie 1 : adresse précise fournie par l'IA
        if (activity.address) {
          const c = await nominatimSearch(activity.address);
          if (c) return { ...activity, ...c };
        }

        // Stratégie 2 : nom + destination
        const c2 = await nominatimSearch(`${activity.name}, ${destLat},${destLng}`);
        if (c2) return { ...activity, ...c2 };

        // Stratégie 3 : Overpass (rayon 20 km)
        try {
          const safe  = activity.name.replace(/["\\/]/g, '');
          const query = `[out:json][timeout:4];(node["name"~"${safe}",i](around:20000,${destLat},${destLng});way["name"~"${safe}",i](around:20000,${destLat},${destLng}););out center 1;`;
          const { data } = await axios.post(OVERPASS, `data=${encodeURIComponent(query)}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 4000,
          });
          const el = data.elements?.[0];
          if (el) return { ...activity, lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon };
        } catch { /* ignore */ }

        // Fallback : position aléatoire proche du centre
        const offset = (Math.random() - 0.5) * 0.03;
        return { ...activity, lat: destLat + offset, lng: destLng + offset };
      })
    );

    results.push(...resolved);

    // Petite pause entre batches pour respecter Nominatim
    if (i + BATCH < activities.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
};
