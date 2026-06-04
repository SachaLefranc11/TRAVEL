import axios from 'axios';
import { GeocodeResponse, ActivitySuggestion } from '../dtos/ai-suggestion.dto';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const headers = { 'User-Agent': 'TravelApp/1.0 (contact@travel-app.dev)' };

/** Pause pour respecter le rate-limit Nominatim (1 req/s) */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Convertit un nom de destination en coordonnées GPS via OpenStreetMap Nominatim.
 */
export const geocodeDestination = async (destination: string): Promise<GeocodeResponse | null> => {
  try {
    const { data } = await axios.get(`${NOMINATIM}/search`, {
      headers,
      params: { q: destination, format: 'json', limit: 1, addressdetails: 1 },
      timeout: 8000,
    });

    if (!data || data.length === 0) return null;

    const result = data[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    const type: string = result.type ?? '';
    const zoom = ['city', 'town', 'village'].includes(type) ? 12
      : ['country', 'state'].includes(type) ? 6
      : 13;

    return { lat, lng, displayName: result.display_name, zoom };
  } catch (err: any) {
    console.error('[Geocoding] Erreur Nominatim:', err?.message);
    return null;
  }
};

/**
 * Géocode une adresse précise via Nominatim.
 * Retourne lat/lng ou null si introuvable.
 */
const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const { data } = await axios.get(`${NOMINATIM}/search`, {
      headers,
      params: { q: address, format: 'json', limit: 1 },
      timeout: 6000,
    });
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
};

/**
 * Enrichit les activités IA avec des coordonnées GPS précises.
 * Stratégie par priorité :
 *   1. Adresse complète via Nominatim (le plus précis)
 *   2. Nom du lieu via Overpass (dans un rayon de 20km)
 *   3. Fallback : position approchée autour du centre de destination
 */
export const enrichWithCoordinates = async (
  activities: ActivitySuggestion[],
  destLat: number,
  destLng: number,
): Promise<ActivitySuggestion[]> => {
  const results: ActivitySuggestion[] = [];

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];

    // Activité déjà géocodée
    if (activity.lat && activity.lng) {
      results.push(activity);
      continue;
    }

    // Pause entre requêtes Nominatim (respecte le rate-limit 1 req/s)
    if (i > 0) await sleep(1100);

    // Stratégie 1 : géocoder l'adresse précise fournie par l'IA
    if (activity.address) {
      const coords = await geocodeAddress(activity.address);
      if (coords) {
        results.push({ ...activity, ...coords });
        continue;
      }
    }

    // Stratégie 2 : recherche par nom + destination via Nominatim
    const nameCoords = await geocodeAddress(`${activity.name}, ${destLat},${destLng}`);
    if (nameCoords) {
      results.push({ ...activity, ...nameCoords });
      continue;
    }

    // Stratégie 3 : Overpass (nom dans rayon 20km)
    try {
      const query = `
        [out:json][timeout:5];
        (
          node["name"~"${activity.name.replace(/["\\/]/g, '')}",i](around:20000,${destLat},${destLng});
          way["name"~"${activity.name.replace(/["\\/]/g, '')}",i](around:20000,${destLat},${destLng});
        );
        out center 1;
      `;
      const { data } = await axios.post(OVERPASS, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      });
      const elements = data.elements ?? [];
      if (elements.length > 0) {
        const el = elements[0];
        results.push({ ...activity, lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon });
        continue;
      }
    } catch { /* ignore */ }

    // Fallback : position légèrement décalée autour du centre
    const offset = (Math.random() - 0.5) * 0.03;
    results.push({ ...activity, lat: destLat + offset, lng: destLng + offset });
  }

  return results;
};
