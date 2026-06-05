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
/** Exécute une recherche Unsplash et retourne l'URL du 1er résultat, ou null. */
const runSearch = async (key: string, query: string): Promise<string | null> => {
  const response = await axios.get<{ results: UnsplashPhoto[] }>(`${BASE_URL}/search/photos`, {
    headers: { Authorization: `Client-ID ${key}` },
    params: {
      query,
      per_page: 5,
      orientation: 'landscape',
      content_filter: 'high',
      order_by: 'relevant',
    },
    timeout: 8000,
  });
  return response.data.results[0]?.urls.regular ?? null;
};

/**
 * Recherche une photo haute qualité pour une destination.
 * Essaie une requête ciblée « ville/paysage », puis retombe sur le nom seul
 * (plus de chances de trouver une image qu'avec une requête trop spécifique).
 */
export const searchDestinationImage = async (destination: string): Promise<string | null> => {
  if (!KEY) {
    console.warn('[Unsplash] UNSPLASH_ACCESS_KEY manquant');
    return null;
  }

  try {
    return (
      (await runSearch(KEY, `${destination} cityscape landmark`)) ??
      (await runSearch(KEY, destination))
    );
  } catch (err: any) {
    console.error('[Unsplash] Erreur:', err?.message ?? err);
    return null;
  }
};
