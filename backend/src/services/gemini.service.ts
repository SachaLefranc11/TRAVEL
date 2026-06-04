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

const inferCategory = (raw: string): ActivitySuggestion['category'] => {
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'ATTRACTION';
};

/**
 * Utilise Groq (Llama 3.3 70B) pour générer une liste d'activités/lieux
 * incontournables pour une destination donnée.
 */
export const getActivitiesForDestination = async (
  destination: string,
): Promise<ActivitySuggestion[]> => {
  if (!KEY || KEY.startsWith('PLACEHOLDER')) {
    throw new Error('INVALID_KEY: Clé GROQ_API_KEY manquante dans le fichier .env');
  }

  const groq = new Groq({ apiKey: KEY });

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en voyages. Réponds UNIQUEMENT avec du JSON valide, sans markdown ni explication.',
      },
      {
        role: 'user',
        content: `Pour la destination "${destination}", génère une liste de 8 lieux incontournables à visiter (attractions, restaurants, activités, monuments, parcs).

Réponds UNIQUEMENT avec ce tableau JSON, rien d'autre :
[
  {
    "name": "Nom officiel du lieu",
    "description": "Description courte en 1-2 phrases en français",
    "category": "ATTRACTION"
  }
]

Valeurs possibles pour category : ATTRACTION, RESTAURANT, HOTEL, ACTIVITY, OTHER
Mélange les catégories. Utilise les vrais noms officiels des lieux.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? '';

  if (!text) throw new Error('GROQ_ERROR: Réponse vide de Groq');

  // Extraction robuste du JSON (même si Groq ajoute du texte)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('[Groq] Réponse non-JSON:', text.slice(0, 300));
    throw new Error('GROQ_ERROR: Réponse non-JSON reçue de Groq');
  }

  const parsed: Array<{ name: string; description: string; category: string }> =
    JSON.parse(jsonMatch[0]);

  return parsed.map((item) => ({
    name: item.name,
    description: item.description,
    category: inferCategory(item.category) as ActivitySuggestion['category'],
  }));
};
