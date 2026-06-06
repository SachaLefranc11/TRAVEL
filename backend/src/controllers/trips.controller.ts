import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const tripWithDetails = {
  participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
  expenses: { include: { paidBy: { select: { id: true, name: true, avatar: true } }, shares: true } },
  locations: true,
};

export const getTrips = async (req: AuthRequest, res: Response) => {
  const trips = await prisma.trip.findMany({
    where: { participants: { some: { userId: req.userId } } },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      expenses: true,
      _count: { select: { expenses: true, locations: true } },
    },
    orderBy: { startDate: 'desc' },
  });
  res.json(trips);
};

export const getTrip = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const trip = await prisma.trip.findFirst({
    where: { id, participants: { some: { userId: req.userId } } },
    include: tripWithDetails,
  });
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(trip);
};

export const createTrip = async (req: AuthRequest, res: Response) => {
  const { title, destination, startDate, endDate, description, coverImage } = req.body;
  const trip = await prisma.trip.create({
    data: {
      title, destination, description, coverImage,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ownerId: req.userId!,
      participants: { create: { userId: req.userId!, role: 'OWNER' } },
    },
    include: tripWithDetails,
  });
  res.status(201).json(trip);
};

export const updateTrip = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.trip.findFirst({
    where: { id, ownerId: req.userId },
  });
  if (!existing) { res.status(404).json({ error: 'Trip not found or insufficient permissions' }); return; }

  const { startDate, endDate, ...rest } = req.body;
  const trip = await prisma.trip.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    },
    include: tripWithDetails,
  });
  res.json(trip);
};

export const deleteTrip = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.trip.findFirst({
    where: { id, ownerId: req.userId },
  });
  if (!existing) { res.status(404).json({ error: 'Trip not found or insufficient permissions' }); return; }
  await prisma.trip.delete({ where: { id } });
  res.status(204).send();
};
