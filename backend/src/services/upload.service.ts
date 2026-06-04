import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../dtos/image.dto';

const uploadsDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `trip-${unique}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Format non supporté. Acceptés : jpeg, png, webp`));
    }
  },
});

export const getPublicUrl = (filename: string): string =>
  `/uploads/${filename}`;

export const deleteFile = (filename: string): void => {
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }
};
