import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const isMember = async (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

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
  const { name, type, lat, lng, description } = req.body;
  const location = await prisma.location.create({
    data: { name, type, lat, lng, description, tripId },
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
