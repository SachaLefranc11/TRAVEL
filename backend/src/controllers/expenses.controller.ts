import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const isMember = async (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

export const getExpenses = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: { paidBy: { select: { id: true, name: true, avatar: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(expenses);
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const { title, amount, currency, category, date, notes } = req.body;
  const expense = await prisma.expense.create({
    data: {
      title, amount, currency, category, notes,
      date: new Date(date),
      tripId,
      paidById: req.userId!,
    },
    include: { paidBy: { select: { id: true, name: true, avatar: true } } },
  });
  res.status(201).json(expense);
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const eid = req.params.eid as string;
  const expense = await prisma.expense.findFirst({
    where: { id: eid, tripId, paidById: req.userId },
  });
  if (!expense) { res.status(404).json({ error: 'Expense not found or insufficient permissions' }); return; }

  const { date, ...rest } = req.body;
  const updated = await prisma.expense.update({
    where: { id: eid },
    data: { ...rest, ...(date && { date: new Date(date) }) },
    include: { paidBy: { select: { id: true, name: true, avatar: true } } },
  });
  res.json(updated);
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const eid = req.params.eid as string;
  const expense = await prisma.expense.findFirst({
    where: { id: eid, tripId, paidById: req.userId },
  });
  if (!expense) { res.status(404).json({ error: 'Expense not found or insufficient permissions' }); return; }
  await prisma.expense.delete({ where: { id: eid } });
  res.status(204).send();
};
