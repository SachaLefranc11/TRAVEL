import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const isMember = (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

const userSel = { id: true, name: true, avatar: true };
const include = { fromUser: { select: userSel }, toUser: { select: userSel } };

export const getSettlements = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const settlements = await prisma.settlement.findMany({
    where: { tripId },
    include,
    orderBy: { createdAt: 'desc' },
  });
  res.json(settlements);
};

export const createSettlement = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { fromUserId, toUserId, amount, currency } = req.body;

  // Seul le créancier (celui qui reçoit l'argent) peut marquer une dette comme remboursée
  if (toUserId !== req.userId) {
    res.status(403).json({ error: 'Seul le créancier (qui reçoit) peut marquer une dette comme remboursée.' });
    return;
  }
  if (fromUserId === toUserId) {
    res.status(400).json({ error: 'Le payeur et le receveur doivent être différents.' }); return;
  }
  const [debtor, creditor] = await Promise.all([isMember(tripId, fromUserId), isMember(tripId, toUserId)]);
  if (!debtor || !creditor) {
    res.status(400).json({ error: 'Les deux personnes doivent participer au voyage.' }); return;
  }

  const settlement = await prisma.settlement.create({
    data: { tripId, fromUserId, toUserId, amount, currency },
    include,
  });
  res.status(201).json(settlement);
};

export const deleteSettlement = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const sid = req.params.sid as string;
  const settlement = await prisma.settlement.findFirst({ where: { id: sid, tripId } });
  if (!settlement) { res.status(404).json({ error: 'Remboursement introuvable' }); return; }
  // Seul le créancier qui l'a enregistré peut l'annuler
  if (settlement.toUserId !== req.userId) {
    res.status(403).json({ error: 'Seul le créancier peut annuler ce remboursement.' }); return;
  }
  await prisma.settlement.delete({ where: { id: sid } });
  res.status(204).send();
};
