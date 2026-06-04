import { z } from 'zod';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE_MB = 5;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const imageFileSchema = z.object({
  mimetype: z.string().refine(
    (t) => ALLOWED_MIME_TYPES.includes(t),
    { message: `Format non supporté. Acceptés : ${ALLOWED_MIME_TYPES.join(', ')}` }
  ),
  size: z.number().max(MAX_FILE_SIZE_BYTES, `Fichier trop lourd (max ${MAX_FILE_SIZE_MB}MB)`),
});
