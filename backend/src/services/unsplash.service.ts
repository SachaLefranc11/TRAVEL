import axios from 'axios';

const BASE_URL = 'https://api.unsplash.com';
const KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashPhoto {
  urls: { regular: string; small: string };
  alt_description: string | null;
}

/**
 * Recherche une photo haute qualité sur Unsplash pour une destination.
 * Retourne l'URL de l'image ou null en cas d'échec.
 */
export const searchDestinationImage = async (destination: string): Promise<string | null> => {
  if (!KEY) {
    console.warn('[Unsplash] UNSPLASH_ACCESS_KEY manquant');
    return null;
  }

  try {
    const response = await axios.get<{ results: UnsplashPhoto[] }>(`${BASE_URL}/search/photos`, {
      headers: { Authorization: `Client-ID ${KEY}` },
      params: {
        query: `${destination} travel landmark`,
        per_page: 3,
        orientation: 'landscape',
        content_filter: 'high',
      },
      timeout: 8000,
    });

    const results = response.data.results;
    if (results.length === 0) return null;

    // Préférer le premier résultat (le plus pertinent)
    return results[0].urls.regular;
  } catch (err: any) {
    console.error('[Unsplash] Erreur:', err?.message ?? err);
    return null;
  }
};
