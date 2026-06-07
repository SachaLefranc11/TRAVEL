import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { notify } from '../services/notifications.service';

const userSelect = { id: true, name: true, email: true, avatar: true };

/**
 * POST /trips/:tripId/participants
 * Invite un utilisateur EXISTANT (par email) à un voyage. Réservé à l'organisateur.
 */
export const inviteParticipant = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const { email } = req.body;

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true, title: true } });
  if (!trip) { res.status(404).json({ error: 'Voyage introuvable' }); return; }
  if (trip.ownerId !== req.userId) {
    res.status(403).json({ error: "Seul l'organisateur peut inviter des participants." }); return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(404).json({ error: "Aucun compte n'existe pour cet email. La personne doit d'abord s'inscrire." });
    return;
  }

  const existing = await prisma.tripParticipant.findUnique({
    where: { userId_tripId: { userId: user.id, tripId } },
  });
  if (existing) {
    res.status(409).json({ error: 'Cette personne participe déjà au voyage.' }); return;
  }

  const participant = await prisma.tripParticipant.create({
    data: { userId: user.id, tripId, role: 'MEMBER' },
    include: { user: { select: userSelect } },
  });

  await notify([user.id], {
    type: 'INVITE',
    message: `Vous avez été invité au voyage « ${trip.title} »`,
    tripId,
  });

  res.status(201).json(participant);
};

/**
 * DELETE /trips/:tripId/participants/:userId
 * Retire un participant (hors organisateur). Réservé à l'organisateur.
 */
export const removeParticipant = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.params.userId as string;

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  if (!trip) { res.status(404).json({ error: 'Voyage introuvable' }); return; }
  if (trip.ownerId !== req.userId) {
    res.status(403).json({ error: "Seul l'organisateur peut retirer des participants." }); return;
  }
  if (userId === trip.ownerId) {
    res.status(400).json({ error: "Impossible de retirer l'organisateur du voyage." }); return;
  }

  await prisma.tripParticipant.deleteMany({ where: { tripId, userId } });
  res.status(204).send();
};
