import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const isMember = (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

const include = { createdBy: { select: { id: true, name: true, avatar: true } } };

export const getPlanner = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const activities = await prisma.plannerActivity.findMany({
    where: { tripId },
    include,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });
  res.json(activities);
};

export const createPlannerActivity = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { date, title, description, startTime, endTime, location } = req.body;
  const activity = await prisma.plannerActivity.create({
    data: {
      tripId,
      date: new Date(date),
      title, description, startTime, endTime, location,
      createdById: req.userId!,
    },
    include,
  });
  res.status(201).json(activity);
};

const loadEditable = async (tripId: string, aid: string, userId: string) => {
  const existing = await prisma.plannerActivity.findFirst({ where: { id: aid, tripId } });
  if (!existing) return { error: 404 as const };
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  const canEdit = existing.createdById === userId || trip?.ownerId === userId;
  if (!canEdit) return { error: 403 as const };
  return { existing };
};

export const updatePlannerActivity = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const aid = req.params.aid as string;
  const check = await loadEditable(tripId, aid, req.userId!);
  if (check.error === 404) { res.status(404).json({ error: 'Activité introuvable' }); return; }
  if (check.error === 403) { res.status(403).json({ error: 'Permissions insuffisantes' }); return; }

  const { date, ...rest } = req.body;
  const updated = await prisma.plannerActivity.update({
    where: { id: aid },
    data: { ...rest, ...(date && { date: new Date(date) }) },
    include,
  });
  res.json(updated);
};

export const deletePlannerActivity = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const aid = req.params.aid as string;
  const check = await loadEditable(tripId, aid, req.userId!);
  if (check.error === 404) { res.status(404).json({ error: 'Activité introuvable' }); return; }
  if (check.error === 403) { res.status(403).json({ error: 'Permissions insuffisantes' }); return; }

  await prisma.plannerActivity.delete({ where: { id: aid } });
  res.status(204).send();
};
