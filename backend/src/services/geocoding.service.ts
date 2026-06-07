import axios from 'axios';
import { GeocodeResponse, ActivitySuggestion } from '../dtos/ai-suggestion.dto';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const HEADERS   = { 'User-Agent': 'TravelApp/1.0 (contact@travel-app.dev)' };

/**
 * Géocode un texte libre via Nominatim. Retourne null si introuvable.
 * `viewbox` (optionnel) biaise/limite la recherche autour de la destination
 * pour éviter qu'un nom commun renvoie un lieu à l'autre bout du monde.
 */
const nominatimSearch = async (
  q: string,
  viewbox?: string,
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const { data } = await axios.get(`${NOMINATIM}/search`, {
      headers: HEADERS,
      params: {
        q,
        format: 'json',
        limit: 1,
        ...(viewbox ? { viewbox, bounded: 1 } : {}),
      },
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
    const type: string = (r.type ?? '').toLowerCase();
    const addrtype: string = (r.addresstype ?? '').toLowerCase();

    // Type de destination → adapte prompts IA + recherche d'image
    const kind: GeocodeResponse['kind'] =
      (type === 'country' || addrtype === 'country') ? 'country'
      : (type === 'island' || addrtype === 'island') ? 'island'
      : (['state', 'region', 'province', 'county'].includes(type) || addrtype === 'state') ? 'region'
      : (['city', 'town', 'village', 'municipality', 'hamlet'].includes(type) || ['city', 'town', 'village'].includes(addrtype)) ? 'city'
      : 'place';

    const zoom = kind === 'city' ? 12 : (kind === 'country' || kind === 'region') ? 6 : kind === 'island' ? 10 : 13;
    return { lat, lng, displayName: r.display_name, zoom, kind };
  } catch (err: any) {
    console.error('[Geocoding] Nominatim:', err?.message);
    return null;
  }
};

/** Coordonnées valides ET proches du centre de la destination (~150 km). */
const isNearDestination = (
  lat: number | undefined,
  lng: number | undefined,
  destLat: number,
  destLng: number,
): lat is number => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat - destLat) < 1.5 && Math.abs(lng - destLng) < 1.5;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Garantit des coordonnées GPS pour chaque activité.
 *
 * 1. Les coordonnées fournies par l'IA, si elles sont plausibles (proches de la
 *    destination), sont conservées telles quelles → aucun appel réseau.
 * 2. Sinon, géocodage Nominatim (adresse puis nom), biaisé sur la destination
 *    via `viewbox`, en SÉRIE (~1 req/s) pour respecter la politique de Nominatim
 *    et ne pas se faire bloquer (429).
 * 3. En dernier recours : le centre de la destination (jamais une position
 *    aléatoire, qui donnait des marqueurs éparpillés n'importe où).
 */
export const enrichWithCoordinates = async (
  activities: ActivitySuggestion[],
  destLat: number,
  destLng: number,
): Promise<ActivitySuggestion[]> => {
  // Boîte ~±0.35° (~35 km) autour de la destination : minLon,maxLat,maxLon,minLat
  const viewbox = `${destLng - 0.35},${destLat + 0.35},${destLng + 0.35},${destLat - 0.35}`;
  const results: ActivitySuggestion[] = [];

  for (const activity of activities) {
    // 1. Coordonnées IA plausibles → on garde, pas d'appel réseau
    if (isNearDestination(activity.lat, activity.lng, destLat, destLng)) {
      results.push(activity);
      continue;
    }

    // 2. Géocodage Nominatim biaisé sur la destination
    let coords: { lat: number; lng: number } | null = null;
    if (activity.address) coords = await nominatimSearch(activity.address, viewbox);
    if (!coords) coords = await nominatimSearch(`${activity.name}`, viewbox);
    await sleep(1100); // respect du rate limit Nominatim (1 req/s)

    // 3. Fallback : centre de la destination (jamais aléatoire)
    results.push({
      ...activity,
      lat: coords?.lat ?? destLat,
      lng: coords?.lng ?? destLng,
    });
  }

  return results;
};
