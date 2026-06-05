import { searchDestinationImage } from './unsplash.service';
import { getActivitiesForDestination } from './gemini.service';
import { geocodeDestination, enrichWithCoordinates } from './geocoding.service';
import { ActivitySuggestion, GeocodeResponse } from '../dtos/ai-suggestion.dto';
import prisma from './prisma.service';

// Durée de vie du cache : 30 jours
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Service IA central — orchestre tous les appels aux APIs externes.
 * Les activités sont mises en cache en base pour éviter de dépasser les quotas Groq.
 */
export const AIService = {

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

  getActivities: async (destination: string): Promise<ActivitySuggestion[]> => {
    const key = destination.trim().toLowerCase();

    // ── 1. Vérifier le cache ──────────────────────────────────────────
    try {
      const cached = await prisma.activityCache.findUnique({ where: { destination: key } });
      if (cached) {
        const age = Date.now() - cached.updatedAt.getTime();
        if (age < CACHE_TTL_MS) {
          console.log(`[AIService] Cache HIT pour "${key}" (${Math.round(age / 86400000)}j)`);
          return JSON.parse(cached.activities) as ActivitySuggestion[];
        }
        console.log(`[AIService] Cache expiré pour "${key}" — rafraîchissement`);
      }
    } catch (err) {
      console.warn('[AIService] Erreur lecture cache:', err);
    }

    // ── 2. Appel Groq ─────────────────────────────────────────────────
    console.log(`[AIService] Cache MISS pour "${key}" — appel Groq`);

    // Géolocalisation en parallèle pendant que Groq répond
    const [coords, activities] = await Promise.all([
      geocodeDestination(destination).catch(() => null),
      Promise.race([
        getActivitiesForDestination(destination),
        new Promise<ActivitySuggestion[]>((_resolve, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT: Groq a mis trop de temps (>25s)')), 25000)
        ),
      ]),
    ]);

    if (activities.length === 0) return [];

    const destLat = coords?.lat ?? 48.8566;
    const destLng = coords?.lng ?? 2.3522;

    // ── 3. Enrichissement coordonnées (parallèle) ─────────────────────
    const enriched = await Promise.race([
      enrichWithCoordinates(activities, destLat, destLng),
      new Promise<ActivitySuggestion[]>((resolve) =>
        setTimeout(() => resolve(
          activities.map((a) => ({
            ...a,
            lat: destLat + (Math.random() - 0.5) * 0.04,
            lng: destLng + (Math.random() - 0.5) * 0.04,
          }))
        ), 20000)
      ),
    ]);

    // ── 4. Stocker en cache ───────────────────────────────────────────
    try {
      await prisma.activityCache.upsert({
        where: { destination: key },
        create: { destination: key, activities: JSON.stringify(enriched) },
        update: { activities: JSON.stringify(enriched), updatedAt: new Date() },
      });
      console.log(`[AIService] Résultats mis en cache pour "${key}"`);
    } catch (err) {
      console.warn('[AIService] Erreur écriture cache:', err);
    }

    return enriched;
  },
};
