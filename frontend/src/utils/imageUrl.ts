// Origine du backend (sans le suffixe /api) pour servir les fichiers statiques /uploads.
// En production VITE_API_URL pointe vers l'API distante ; en local on retombe sur localhost.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/api\/?$/, '');

/**
 * Résout l'URL d'une image de couverture :
 * - un chemin /uploads/... renvoyé par le backend devient une URL absolue vers le backend ;
 * - une URL externe (http…) ou une valeur vide est renvoyée telle quelle.
 */
export const resolveCoverImage = (coverImage?: string | null): string | undefined => {
  if (!coverImage) return undefined;
  if (coverImage.startsWith('/uploads/')) return `${API_ORIGIN}${coverImage}`;
  return coverImage;
};
