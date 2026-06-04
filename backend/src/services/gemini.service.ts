import { GoogleGenerativeAI } from '@google/generative-ai';
import { ActivitySuggestion } from '../dtos/ai-suggestion.dto';

const KEY = process.env.GOOGLE_AI_API_KEY;

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
  restaurant: 'RESTAURANT',
  café: 'RESTAURANT',
  cafe: 'RESTAURANT',
  hôtel: 'HOTEL',
  hotel: 'HOTEL',
  nature: 'ACTIVITY',
  plage: 'ACTIVITY',
  beach: 'ACTIVITY',
};

const inferCategory = (raw: string): ActivitySuggestion['category'] => {
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'ATTRACTION';
};

/**
 * Utilise Google Gemini Flash pour générer une liste d'activités/lieux
 * incontournables pour une destination donnée.
 */
export const getActivitiesForDestination = async (
  destination: string,
): Promise<ActivitySuggestion[]> => {
  if (!KEY) {
    console.warn('[Gemini] GOOGLE_AI_API_KEY manquant');
    return [];
  }

  try {
    const genAI = new GoogleGenerativeAI(KEY);
    // gemini-2.0-flash en priorité, fallback sur gemini-1.5-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Tu es un expert en voyages. Pour la destination "${destination}", génère une liste de 8 lieux incontournables à visiter (attractions, restaurants, activités, monuments, parcs).

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication. Format exact :
[
  {
    "name": "Nom du lieu",
    "description": "Description courte en 1-2 phrases",
    "category": "ATTRACTION | RESTAURANT | HOTEL | ACTIVITY | OTHER"
  }
]

Règles :
- Les noms doivent être les vrais noms officiels des lieux
- Mélange les catégories (pas que des attractions)
- Descriptions en français, courtes et précises
- Uniquement du JSON valide, rien d'autre`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Nettoyage robuste : extraire le JSON même si Gemini ajoute du texte
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Gemini] Réponse non-JSON:', text.slice(0, 200));
      return [];
    }

    const parsed: Array<{ name: string; description: string; category: string }> =
      JSON.parse(jsonMatch[0]);

    return parsed.map((item) => ({
      name: item.name,
      description: item.description,
      category: inferCategory(item.category) as ActivitySuggestion['category'],
    }));
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    console.error('[Gemini] Erreur:', msg);

    // Remonter des erreurs lisibles selon le code HTTP
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Quota')) {
      throw new Error('QUOTA_EXCEEDED: Quota Gemini dépassé. Vérifie ta clé API sur aistudio.google.com');
    }
    if (msg.includes('400') || msg.includes('API_KEY') || msg.includes('invalid')) {
      throw new Error('INVALID_KEY: Clé API Gemini invalide');
    }
    throw new Error(`GEMINI_ERROR: ${msg}`);
  }
};
