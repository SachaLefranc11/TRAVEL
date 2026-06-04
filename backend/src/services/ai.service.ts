import { searchDestinationImage } from './unsplash.service';
import { getActivitiesForDestination } from './gemini.service';
import { geocodeDestination, enrichWithCoordinates } from './geocoding.service';
import { ActivitySuggestion, GeocodeResponse } from '../dtos/ai-suggestion.dto';

/**
 * Service IA central — orchestre tous les appels aux APIs externes.
 * Gère les timeouts et fallbacks : jamais de crash vers le client.
 */
export const AIService = {

  /**
   * Recherche une image Unsplash pour une destination.
   * Retourne null si Unsplash est indisponible.
   */
  getDestinationImage: async (destination: string): Promise<string | null> => {
    try {
      return await Promise.race([
        searchDestinationImage(destination),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
    } catch {
      return null;
    }
  },

  /**
   * Géolocalise une destination (nom → lat/lng + zoom recommandé).
   * Retourne null si le service est indisponible.
   */
  geocode: async (destination: string): Promise<GeocodeResponse | null> => {
    try {
      return await Promise.race([
        geocodeDestination(destination),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
    } catch {
      return null;
    }
  },

  /**
   * Génère des suggestions d'activités IA pour une destination,
   * puis enrichit chaque lieu avec des coordonnées GPS via Overpass.
   */
  getActivities: async (
    destination: string,
  ): Promise<ActivitySuggestion[]> => {
    try {
      // 1. Géolocaliser la destination pour enrichir les coords des activités
      const coords = await geocodeDestination(destination);
      const destLat = coords?.lat ?? 48.8566;
      const destLng = coords?.lng ?? 2.3522;

      // 2. Demander les activités à Gemini (timeout 20s)
      const activities = await Promise.race([
        getActivitiesForDestination(destination),
        new Promise<ActivitySuggestion[]>((resolve) => setTimeout(() => resolve([]), 20000)),
      ]);

      if (activities.length === 0) return [];

      // 3. Enrichir les coordonnées via Overpass (timeout 15s)
      const enriched = await Promise.race([
        enrichWithCoordinates(activities, destLat, destLng),
        new Promise<ActivitySuggestion[]>((resolve) =>
          setTimeout(() => resolve(activities.map((a) => ({
            ...a,
            lat: destLat + (Math.random() - 0.5) * 0.04,
            lng: destLng + (Math.random() - 0.5) * 0.04,
          }))), 15000)
        ),
      ]);

      return enriched;
    } catch (err: any) {
      console.error('[AIService] getActivities error:', err?.message);
      return [];
    }
  },
};
