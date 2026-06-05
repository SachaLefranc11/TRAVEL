import Groq from 'groq-sdk';
import { ActivitySuggestion } from '../dtos/ai-suggestion.dto';

const KEY = process.env.GROQ_API_KEY;

const CATEGORY_MAP: Record<string, ActivitySuggestion['category']> = {
  monument: 'ATTRACTION',
  attraction: 'ATTRACTION',
  musée: 'ATTRACTION',
  museum: 'ATTRACTION',
  parc: 'ACTIVITY',
  park: 'ACTIVITY',
  activité: 'ACTIVITY',
  activity: 'ACTIVITY',
  sport: 'ACTIVITY',
  nature: 'ACTIVITY',
  plage: 'ACTIVITY',
  beach: 'ACTIVITY',
  restaurant: 'RESTAURANT',
  café: 'RESTAURANT',
  cafe: 'RESTAURANT',
  bar: 'RESTAURANT',
  hôtel: 'HOTEL',
  hotel: 'HOTEL',
};

const VALID_CATEGORIES = new Set(['ATTRACTION', 'RESTAURANT', 'HOTEL', 'ACTIVITY', 'OTHER']);

/**
 * Normalise la catégorie : on fait confiance à l'enum renvoyé par l'IA s'il est
 * valide, sinon on retombe sur une inférence par mots-clés.
 */
const normalizeCategory = (raw?: string): ActivitySuggestion['category'] => {
  const upper = (raw ?? '').trim().toUpperCase();
  if (VALID_CATEGORIES.has(upper)) return upper as ActivitySuggestion['category'];
  const lower = (raw ?? '').toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'ATTRACTION';
};

/** Coordonnée GPS valide (et non 0,0 qui est souvent un placeholder). */
const isValidCoord = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
  !(lat === 0 && lng === 0);

/**
 * Appelle Groq avec retry sur les erreurs transitoires (429 rate limit, 5xx).
 */
interface GroqCompletion {
  choices: Array<{ message?: { content?: string | null } }>;
}

const createWithRetry = async (
  groq: Groq,
  params: Parameters<Groq['chat']['completions']['create']>[0],
  attempts = 3,
): Promise<GroqCompletion> => {
  for (let i = 1; i <= attempts; i++) {
    try {
      return (await groq.chat.completions.create(params)) as unknown as GroqCompletion;
    } catch (err: any) {
      const status: number | undefined = err?.status ?? err?.response?.status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (i < attempts && retryable) {
        const wait = 800 * i;
        console.warn(`[Groq] Erreur ${status}, retry ${i}/${attempts - 1} dans ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (status === 429) throw new Error('429: Limite de requêtes Groq atteinte');
      throw err;
    }
  }
  throw new Error('GROQ_ERROR: échec après plusieurs tentatives');
};

/**
 * Utilise Groq (Llama 3.3 70B) pour générer une liste d'activités/lieux
 * incontournables pour une destination donnée, AVEC leurs coordonnées GPS.
 */
export const getActivitiesForDestination = async (
  destination: string,
): Promise<ActivitySuggestion[]> => {
  if (!KEY || KEY.startsWith('PLACEHOLDER')) {
    throw new Error('INVALID_KEY: Clé GROQ_API_KEY manquante dans le fichier .env');
  }

  const groq = new Groq({ apiKey: KEY });

  const completion = await createWithRetry(groq, {
    model: 'llama-3.3-70b-versatile',
    // Mode JSON garanti : Groq renvoie forcément un objet JSON valide.
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en voyages avec une connaissance précise de la géographie. Réponds UNIQUEMENT avec du JSON valide.',
      },
      {
        role: 'user',
        content: `Pour la destination "${destination}", génère 15 lieux incontournables à visiter (attractions, restaurants, activités, monuments, parcs, musées).

Réponds avec un objet JSON de cette forme exacte :
{
  "places": [
    {
      "name": "Nom officiel du lieu",
      "description": "Description courte en 1-2 phrases en français",
      "address": "Adresse complète et précise (numéro, rue, code postal, ville, pays)",
      "category": "ATTRACTION",
      "lat": 48.8584,
      "lng": 2.2945
    }
  ]
}

Règles strictes :
- Exactement 15 lieux dans "places"
- category UNIQUEMENT parmi : ATTRACTION, RESTAURANT, HOTEL, ACTIVITY, OTHER
- Mélange bien les catégories (pas que des attractions)
- Noms officiels réels des lieux
- "lat" et "lng" = coordonnées GPS RÉELLES et PRÉCISES du lieu en degrés décimaux (très important pour la carte)
- Adresses complètes et précises
- Descriptions en français, informatives`,
      },
    ],
    temperature: 0.6,
    max_tokens: 4000,
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? '';
  if (!text) throw new Error('GROQ_ERROR: Réponse vide de Groq');

  let parsedObj: { places?: unknown };
  try {
    parsedObj = JSON.parse(text);
  } catch {
    console.error('[Groq] JSON invalide:', text.slice(0, 300));
    throw new Error('GROQ_ERROR: Réponse non-JSON reçue de Groq');
  }

  const places = Array.isArray(parsedObj.places) ? parsedObj.places : [];
  if (places.length === 0) throw new Error('GROQ_ERROR: Aucun lieu dans la réponse');

  return (places as Array<Record<string, unknown>>)
    .filter((item) => typeof item?.name === 'string')
    .map((item) => ({
      name: item.name as string,
      description: (item.description as string) ?? '',
      address: typeof item.address === 'string' ? item.address : undefined,
      category: normalizeCategory(item.category as string | undefined),
      // On ne garde les coords de l'IA que si elles sont plausibles.
      lat: isValidCoord(item.lat, item.lng) ? (item.lat as number) : undefined,
      lng: isValidCoord(item.lat, item.lng) ? (item.lng as number) : undefined,
    }));
};
