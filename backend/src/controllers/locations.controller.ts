import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { AIService } from '../services/ai.service';
import { broadcastToTripMembers } from '../services/notifications.service';

const isMember = async (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

/**
 * POST /trips/:tripId/ai-locations
 * Génère (UNE SEULE FOIS par voyage) les suggestions IA et les ajoute en lieux.
 * Le flag aiSuggestionsGenerated est posé de façon atomique pour empêcher les
 * doublons (double-clic, ou deux participants en même temps).
 */
export const generateAiLocations = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, participants: { some: { userId: req.userId } } },
    select: { id: true, destination: true, aiSuggestionsGenerated: true },
  });
  if (!trip) { res.status(403).json({ error: 'Access denied' }); return; }
  if (trip.aiSuggestionsGenerated) {
    res.status(409).json({ error: 'Les suggestions IA ont déjà été générées pour ce voyage.' }); return;
  }

  // Verrou atomique : seul le premier appel passe
  const claim = await prisma.trip.updateMany({
    where: { id: tripId, aiSuggestionsGenerated: false },
    data: { aiSuggestionsGenerated: true },
  });
  if (claim.count === 0) {
    res.status(409).json({ error: 'Les suggestions IA ont déjà été générées pour ce voyage.' }); return;
  }

  try {
    const activities = await AIService.getActivities(trip.destination);
    const rows = activities
      .filter((a) => typeof a.lat === 'number' && typeof a.lng === 'number')
      .map((a) => ({
        tripId, name: a.name, type: a.category,
        lat: a.lat as number, lng: a.lng as number,
        description: a.description, address: a.address,
      }));
    if (rows.length > 0) await prisma.location.createMany({ data: rows });
    const locations = await prisma.location.findMany({ where: { tripId } });
    // Temps réel : les autres voient les nouveaux lieux + le bouton IA disparaît
    await broadcastToTripMembers(tripId, req.userId!, { kind: 'trip', tripId });
    res.status(201).json({ locations });
  } catch (err: any) {
    // Échec → on relâche le verrou pour permettre une nouvelle tentative
    await prisma.trip.updateMany({ where: { id: tripId }, data: { aiSuggestionsGenerated: false } });
    const msg: string = err?.message ?? 'Erreur IA';
    if (msg.includes('INVALID_KEY')) res.status(401).json({ error: 'Clé IA manquante ou invalide.' });
    else if (msg.includes('429')) res.status(429).json({ error: 'Limite de requêtes IA atteinte, réessaie plus tard.' });
    else res.status(500).json({ error: `Suggestions IA indisponibles : ${msg}` });
  }
};

export const getLocations = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const locations = await prisma.location.findMany({ where: { tripId } });
  res.json(locations);
};

export const createLocation = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { name, type, lat, lng, description, address } = req.body;
  const location = await prisma.location.create({
    data: { name, type, lat, lng, description, address, tripId },
  });
  res.status(201).json(location);
};

export const deleteLocation = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const lid = req.params.lid as string;
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, ownerId: req.userId },
  });
  if (!trip) { res.status(403).json({ error: 'Only trip owner can delete locations' }); return; }
  await prisma.location.deleteMany({ where: { id: lid, tripId } });
  res.status(204).send();
};
