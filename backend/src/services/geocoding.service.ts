import axios from 'axios';
import { GeocodeResponse, ActivitySuggestion } from '../dtos/ai-suggestion.dto';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const headers = { 'User-Agent': 'TravelApp/1.0 (contact@travel-app.dev)' };

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

    // Calcul du zoom selon le type de lieu
    const type: string = result.type ?? '';
    const zoom = ['city', 'town', 'village'].includes(type) ? 12
      : ['country', 'state'].includes(type) ? 6
      : 13;

    return {
      lat,
      lng,
      displayName: result.display_name,
      zoom,
    };
  } catch (err: any) {
    console.error('[Geocoding] Erreur Nominatim:', err?.message);
    return null;
  }
};

/**
 * Enrichit les activités IA avec des coordonnées GPS réelles via Overpass API.
 * Pour chaque activité sans coords, tente de trouver le lieu dans OSM.
 */
export const enrichWithCoordinates = async (
  activities: ActivitySuggestion[],
  destLat: number,
  destLng: number,
): Promise<ActivitySuggestion[]> => {
  const results: ActivitySuggestion[] = [];

  for (const activity of activities) {
    // Si l'activité a déjà des coordonnées, on la garde telle quelle
    if (activity.lat && activity.lng) {
      results.push(activity);
      continue;
    }

    try {
      // Recherche Overpass dans un rayon de 20km autour de la destination
      const query = `
        [out:json][timeout:5];
        (
          node["name"~"${activity.name.replace(/"/g, '')}",i](around:20000,${destLat},${destLng});
          way["name"~"${activity.name.replace(/"/g, '')}",i](around:20000,${destLat},${destLng});
        );
        out center 1;
      `;

      const { data } = await axios.post(OVERPASS, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 6000,
      });

      const elements = data.elements ?? [];
      if (elements.length > 0) {
        const el = elements[0];
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        results.push({ ...activity, lat, lng });
      } else {
        // Pas trouvé : coordonnées légèrement décalées autour du centre
        const offset = (Math.random() - 0.5) * 0.04;
        results.push({ ...activity, lat: destLat + offset, lng: destLng + offset });
      }
    } catch {
      // Fallback silencieux : position approchée
      const offset = (Math.random() - 0.5) * 0.04;
      results.push({ ...activity, lat: destLat + offset, lng: destLng + offset });
    }
  }

  return results;
};
