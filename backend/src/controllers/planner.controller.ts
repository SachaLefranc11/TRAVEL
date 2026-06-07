import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const isMember = (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

const include = { createdBy: { select: { id: true, name: true, avatar: true } } };

type ActivitySnapshot = {
  title: string; description: string | null;
  startTime: string | null; endTime: string | null;
  location: string | null; date: Date;
};

/** Snapshot des champs utiles d'une activité (pour le journal avant/après). */
const snapshot = (a: ActivitySnapshot) => JSON.stringify({
  title: a.title, description: a.description,
  startTime: a.startTime, endTime: a.endTime,
  location: a.location, date: a.date,
});

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

  await prisma.plannerActivityLog.create({
    data: {
      tripId, activityId: activity.id, action: 'CREATE', userId: req.userId!,
      activityTitle: activity.title, after: snapshot(activity),
    },
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

  const before = snapshot(check.existing!);
  const { date, ...rest } = req.body;
  const updated = await prisma.plannerActivity.update({
    where: { id: aid },
    data: { ...rest, ...(date && { date: new Date(date) }) },
    include,
  });

  await prisma.plannerActivityLog.create({
    data: {
      tripId, activityId: aid, action: 'UPDATE', userId: req.userId!,
      activityTitle: updated.title, before, after: snapshot(updated),
    },
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

  await prisma.plannerActivityLog.create({
    data: {
      tripId, activityId: aid, action: 'DELETE', userId: req.userId!,
      activityTitle: check.existing!.title, before: snapshot(check.existing!),
    },
  });

  res.status(204).send();
};

export const getPlannerLogs = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const logs = await prisma.plannerActivityLog.findMany({
    where: { tripId },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(logs);
};
