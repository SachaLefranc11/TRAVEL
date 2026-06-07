import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { broadcastToTripMembers } from '../services/notifications.service';

const isMember = (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

const userSel = { id: true, name: true, avatar: true };

// Une position est considérée périmée après 2 minutes (n'est plus renvoyée).
const STALE_MS = 2 * 60 * 1000;

/** GET /trips/:tripId/positions — positions live fraîches des participants (membres only). */
export const getPositions = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const positions = await prisma.participantLocation.findMany({
    where: { tripId, updatedAt: { gte: new Date(Date.now() - STALE_MS) } },
    include: { user: { select: userSel } },
  });
  res.json(positions);
};

/** POST /trips/:tripId/positions — met à jour SA propre position (partage opt-in). */
export const upsertPosition = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { lat, lng } = req.body;
  const pos = await prisma.participantLocation.upsert({
    where: { tripId_userId: { tripId, userId: req.userId! } },
    create: { tripId, userId: req.userId!, lat, lng },
    update: { lat, lng },
    include: { user: { select: userSel } },
  });
  // Signale aux autres membres de rafraîchir les marqueurs (temps réel)
  await broadcastToTripMembers(tripId, req.userId!, { kind: 'positions', tripId });
  res.json(pos);
};

/** DELETE /trips/:tripId/positions — arrête le partage et supprime SA position. */
export const stopSharing = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  await prisma.participantLocation.deleteMany({ where: { tripId, userId: req.userId! } });
  await broadcastToTripMembers(tripId, req.userId!, { kind: 'positions', tripId });
  res.status(204).send();
};
