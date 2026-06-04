import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { upload, getPublicUrl, deleteFile } from '../services/upload.service';
import { imageFileSchema } from '../dtos/image.dto';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import path from 'path';

/** GET /api/ai/destination-image?q=Paris */
export const getDestinationImage = async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q?.trim()) {
    res.status(400).json({ error: 'Paramètre q requis' });
    return;
  }
  const imageUrl = await AIService.getDestinationImage(q.trim());
  res.json({ imageUrl: imageUrl ?? null });
};

/** GET /api/ai/geocode?q=Paris,France */
export const geocode = async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q?.trim()) {
    res.status(400).json({ error: 'Paramètre q requis' });
    return;
  }
  const result = await AIService.geocode(q.trim());
  if (!result) {
    res.status(404).json({ error: 'Destination introuvable' });
    return;
  }
  res.json(result);
};

/** GET /api/ai/activities?dest=Tokyo,Japon */
export const getActivities = async (req: Request, res: Response) => {
  const dest = req.query.dest as string;
  if (!dest?.trim()) {
    res.status(400).json({ error: 'Paramètre dest requis' });
    return;
  }
  try {
    const activities = await AIService.getActivities(dest.trim());
    res.json({ destination: dest.trim(), activities });
  } catch (err: any) {
    const msg: string = err?.message ?? 'Erreur inconnue';
    console.error('[getActivities]', msg);

    if (msg.includes('QUOTA_EXCEEDED')) {
      res.status(429).json({ error: 'Quota Gemini dépassé. Vérifie ta clé API sur aistudio.google.com' });
    } else if (msg.includes('INVALID_KEY')) {
      res.status(401).json({ error: 'Clé API Gemini invalide. Vérifie ton fichier .env' });
    } else if (msg.includes('TIMEOUT')) {
      res.status(504).json({ error: 'Gemini a mis trop de temps à répondre. Réessaie.' });
    } else {
      res.status(500).json({ error: `Erreur Gemini : ${msg}` });
    }
  }
};

/** POST /api/trips/:id/image — upload image locale */
export const uploadTripImage = [
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    const tripId = req.params.id as string;

    if (!req.file) {
      res.status(400).json({ error: 'Aucun fichier reçu' });
      return;
    }

    // Validation DTO
    const validation = imageFileSchema.safeParse({
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
    if (!validation.success) {
      deleteFile(req.file.filename);
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    // Vérifier que le trip appartient à l'utilisateur
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, ownerId: req.userId },
    });
    if (!trip) {
      deleteFile(req.file.filename);
      res.status(403).json({ error: 'Accès refusé ou voyage introuvable' });
      return;
    }

    // Supprimer l'ancienne image locale si elle existe
    if (trip.coverImage?.startsWith('/uploads/')) {
      const oldFilename = path.basename(trip.coverImage);
      deleteFile(oldFilename);
    }

    const publicUrl = getPublicUrl(req.file.filename);
    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: { coverImage: publicUrl },
      select: { id: true, coverImage: true },
    });

    res.json(updated);
  },
] as any;
