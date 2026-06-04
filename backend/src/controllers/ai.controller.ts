import { Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import { upload, uploadToCloudinary, deleteFromCloudinary } from '../services/upload.service';
import { imageFileSchema } from '../dtos/image.dto';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

/** GET /api/ai/destination-image?q=Paris */
export const getDestinationImage = async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q?.trim()) { res.status(400).json({ error: 'Paramètre q requis' }); return; }
  const imageUrl = await AIService.getDestinationImage(q.trim());
  res.json({ imageUrl: imageUrl ?? null });
};

/** GET /api/ai/geocode?q=Paris,France */
export const geocode = async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q?.trim()) { res.status(400).json({ error: 'Paramètre q requis' }); return; }
  const result = await AIService.geocode(q.trim());
  if (!result) { res.status(404).json({ error: 'Destination introuvable' }); return; }
  res.json(result);
};

/** GET /api/ai/activities?dest=Tokyo,Japon */
export const getActivities = async (req: Request, res: Response) => {
  const dest = req.query.dest as string;
  if (!dest?.trim()) { res.status(400).json({ error: 'Paramètre dest requis' }); return; }
  try {
    const activities = await AIService.getActivities(dest.trim());
    res.json({ destination: dest.trim(), activities });
  } catch (err: any) {
    const msg: string = err?.message ?? 'Erreur inconnue';
    console.error('[getActivities]', msg);
    if (msg.includes('INVALID_KEY')) {
      res.status(401).json({ error: 'Clé GROQ_API_KEY manquante ou invalide.' });
    } else if (msg.includes('TIMEOUT')) {
      res.status(504).json({ error: 'Groq a mis trop de temps à répondre. Réessaie.' });
    } else if (msg.includes('429')) {
      res.status(429).json({ error: 'Limite de requêtes Groq atteinte. Réessaie dans quelques secondes.' });
    } else {
      res.status(500).json({ error: `Erreur IA : ${msg}` });
    }
  }
};

/** POST /api/ai/trips/:id/image — upload image vers Cloudinary */
export const uploadTripImage = [
  upload.single('image'),
  async (req: AuthRequest, res: Response) => {
    const tripId = req.params.id as string;

    if (!req.file) { res.status(400).json({ error: 'Aucun fichier reçu' }); return; }

    // Validation DTO
    const validation = imageFileSchema.safeParse({ mimetype: req.file.mimetype, size: req.file.size });
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message }); return;
    }

    // Vérifier que le trip appartient à l'utilisateur
    const trip = await prisma.trip.findFirst({ where: { id: tripId, ownerId: req.userId } });
    if (!trip) { res.status(403).json({ error: 'Accès refusé ou voyage introuvable' }); return; }

    // Supprimer l'ancienne image Cloudinary si elle existe
    if (trip.coverImage?.includes('cloudinary.com')) {
      await deleteFromCloudinary(trip.coverImage);
    }

    // Upload vers Cloudinary
    const cloudUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype);

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: { coverImage: cloudUrl },
      select: { id: true, coverImage: true },
    });

    res.json(updated);
  },
] as any;
