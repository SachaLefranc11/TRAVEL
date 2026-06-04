import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../dtos/image.dto';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Multer en mémoire (buffer) — Cloudinary reçoit le buffer directement
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Acceptés : jpeg, png, webp'));
    }
  },
});

/**
 * Upload un buffer vers Cloudinary et retourne l'URL sécurisée.
 */
export const uploadToCloudinary = (
  buffer: Buffer,
  mimetype: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ext = mimetype.split('/')[1] ?? 'jpg';
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'travel-app',
        resource_type: 'image',
        format: ext,
        transformation: [{ width: 1200, height: 600, crop: 'fill', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload Cloudinary échoué'));
        resolve(result.secure_url);
      },
    );
    uploadStream.end(buffer);
  });
};

/**
 * Supprime une image Cloudinary depuis son URL publique.
 */
export const deleteFromCloudinary = async (url: string): Promise<void> => {
  try {
    // Extrait le public_id depuis l'URL Cloudinary
    const parts = url.split('/');
    const filename = parts[parts.length - 1].split('.')[0];
    const folder = parts[parts.length - 2];
    const publicId = folder === 'travel-app' ? `travel-app/${filename}` : filename;
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[Cloudinary] Suppression échouée:', err);
  }
};
