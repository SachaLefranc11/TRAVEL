import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';

const isMember = async (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

const expenseInclude = {
  paidBy: { select: { id: true, name: true, avatar: true } },
  shares: true,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type ShareRow = { userId: string; amount: number };

/** Répartit `amount` également entre userIds en gérant l'arrondi au centime. */
const splitEqually = (amount: number, userIds: string[]): ShareRow[] => {
  const n = userIds.length;
  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / n);
  let remainder = totalCents - base * n;
  return userIds.map((userId) => {
    const cents = base + (remainder-- > 0 ? 1 : 0);
    return { userId, amount: cents / 100 };
  });
};

/**
 * Construit les parts d'une dépense selon le type de répartition.
 * Lève une Error (code dans message) en cas de données invalides.
 */
const buildShares = (
  amount: number,
  splitType: 'PERSONAL' | 'EQUAL' | 'CUSTOM',
  payerId: string,
  memberIds: Set<string>,
  participantIds?: string[],
  shares?: ShareRow[],
): ShareRow[] => {
  if (splitType === 'PERSONAL') {
    return [{ userId: payerId, amount: round2(amount) }];
  }

  if (splitType === 'CUSTOM') {
    if (!shares || shares.length === 0) throw new Error('SHARES_REQUIRED');
    const ids = shares.map((s) => s.userId);
    if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_MEMBER');
    for (const s of shares) if (!memberIds.has(s.userId)) throw new Error('INVALID_MEMBER');
    const sum = shares.reduce((a, s) => a + s.amount, 0);
    if (Math.abs(sum - amount) > 0.01) throw new Error('SHARES_SUM_MISMATCH');
    return shares.filter((s) => s.amount > 0).map((s) => ({ userId: s.userId, amount: round2(s.amount) }));
  }

  // EQUAL — sous-ensemble fourni, sinon tous les participants
  const ids = participantIds && participantIds.length ? [...new Set(participantIds)] : [...memberIds];
  if (ids.length === 0) throw new Error('NO_PARTICIPANTS');
  for (const id of ids) if (!memberIds.has(id)) throw new Error('INVALID_MEMBER');
  return splitEqually(amount, ids);
};

const SHARE_ERRORS: Record<string, string> = {
  SHARES_REQUIRED: 'Une répartition personnalisée nécessite au moins une part.',
  DUPLICATE_MEMBER: 'Un participant apparaît plusieurs fois dans la répartition.',
  INVALID_MEMBER: 'Un des participants ne fait pas partie du voyage.',
  SHARES_SUM_MISMATCH: 'La somme des parts doit être égale au montant total.',
  NO_PARTICIPANTS: 'Sélectionnez au moins un participant pour la répartition.',
};
const shareErrorMessage = (e: unknown) =>
  SHARE_ERRORS[(e as Error)?.message] ?? 'Répartition invalide.';

export const getExpenses = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: expenseInclude,
    orderBy: { date: 'desc' },
  });
  res.json(expenses);
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }

  const { title, amount, currency, category, date, notes, paidById, splitType, participantIds, shares } = req.body;

  const members = await prisma.tripParticipant.findMany({ where: { tripId }, select: { userId: true } });
  const memberIds = new Set(members.map((m) => m.userId));
  const payerId: string = paidById ?? req.userId!;
  if (!memberIds.has(payerId)) {
    res.status(400).json({ error: 'Le payeur doit être un participant du voyage.' }); return;
  }

  let shareRows: ShareRow[];
  try {
    shareRows = buildShares(amount, splitType ?? 'EQUAL', payerId, memberIds, participantIds, shares);
  } catch (e) {
    res.status(400).json({ error: shareErrorMessage(e) }); return;
  }

  const expense = await prisma.expense.create({
    data: {
      title, amount, currency, category, notes,
      date: new Date(date),
      tripId,
      paidById: payerId,
      shares: { create: shareRows },
    },
    include: expenseInclude,
  });
  res.status(201).json(expense);
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const eid = req.params.eid as string;

  const existing = await prisma.expense.findFirst({
    where: { id: eid, tripId },
    include: { shares: true },
  });
  if (!existing) { res.status(404).json({ error: 'Expense not found' }); return; }

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  const canEdit = existing.paidById === req.userId || trip?.ownerId === req.userId;
  if (!canEdit) { res.status(403).json({ error: 'Insufficient permissions' }); return; }

  const b = req.body;
  const splitChanged = ['amount', 'splitType', 'participantIds', 'shares', 'paidById']
    .some((k) => b[k] !== undefined);

  const data: any = {};
  for (const k of ['title', 'currency', 'category', 'notes'] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.date) data.date = new Date(b.date);
  if (b.paidById) data.paidById = b.paidById;

  if (splitChanged) {
    const newAmount: number = b.amount ?? existing.amount;
    const payerId: string = b.paidById ?? existing.paidById;
    const members = await prisma.tripParticipant.findMany({ where: { tripId }, select: { userId: true } });
    const memberIds = new Set(members.map((m) => m.userId));
    if (!memberIds.has(payerId)) {
      res.status(400).json({ error: 'Le payeur doit être un participant du voyage.' }); return;
    }
    const splitType = (b.splitType ?? 'EQUAL') as 'PERSONAL' | 'EQUAL' | 'CUSTOM';
    // Pour un EQUAL sans liste explicite, on préserve les participants existants
    const fallbackParticipants = existing.shares.map((s) => s.userId);
    const participantIds = b.participantIds ?? (splitType === 'EQUAL' ? fallbackParticipants : undefined);

    let shareRows: ShareRow[];
    try {
      shareRows = buildShares(newAmount, splitType, payerId, memberIds, participantIds, b.shares);
    } catch (e) {
      res.status(400).json({ error: shareErrorMessage(e) }); return;
    }
    if (b.amount !== undefined) data.amount = newAmount;
    data.shares = { deleteMany: {}, create: shareRows };
  }

  const updated = await prisma.expense.update({
    where: { id: eid },
    data,
    include: expenseInclude,
  });
  res.json(updated);
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const eid = req.params.eid as string;
  const expense = await prisma.expense.findFirst({ where: { id: eid, tripId } });
  if (!expense) { res.status(404).json({ error: 'Expense not found' }); return; }

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { ownerId: true } });
  const canDelete = expense.paidById === req.userId || trip?.ownerId === req.userId;
  if (!canDelete) { res.status(403).json({ error: 'Insufficient permissions' }); return; }

  await prisma.expense.delete({ where: { id: eid } });
  res.status(204).send();
};

/**
 * GET /trips/:tripId/balances
 * Calcule le solde net par utilisateur puis un plan de remboursement minimal
 * (qui doit combien à qui), groupé par devise.
 */
export const getBalances = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  if (!(await isMember(tripId, req.userId!))) {
    res.status(403).json({ error: 'Access denied' }); return;
  }

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    select: { amount: true, currency: true, paidById: true, shares: { select: { userId: true, amount: true } } },
  });

  // net[currency][userId] = total payé - total dû
  const byCurrency = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    // Dépenses sans parts (legacy) ou perso (seule part = le payeur) → solde neutre, on ignore
    if (e.shares.length === 0) continue;
    if (e.shares.length === 1 && e.shares[0].userId === e.paidById) continue;

    const net = byCurrency.get(e.currency) ?? new Map<string, number>();
    net.set(e.paidById, (net.get(e.paidById) ?? 0) + e.amount);
    for (const s of e.shares) net.set(s.userId, (net.get(s.userId) ?? 0) - s.amount);
    byCurrency.set(e.currency, net);
  }

  const result = [...byCurrency.entries()].map(([currency, net]) => {
    const balances = [...net.entries()]
      .map(([userId, amount]) => ({ userId, amount: round2(amount) }))
      .filter((b) => Math.abs(b.amount) > 0.005);
    return { currency, balances, settlements: computeSettlements(balances) };
  });

  res.json(result);
};

/** Plan de remboursement glouton (greedy) : minimise le nombre de transferts. */
const computeSettlements = (balances: { userId: string; amount: number }[]) => {
  const debtors = balances.filter((b) => b.amount < 0).map((b) => ({ ...b })).sort((a, b) => a.amount - b.amount);
  const creditors = balances.filter((b) => b.amount > 0).map((b) => ({ ...b })).sort((a, b) => b.amount - a.amount);

  const settlements: { fromUserId: string; toUserId: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i].amount, creditors[j].amount);
    if (pay > 0.005) {
      settlements.push({ fromUserId: debtors[i].userId, toUserId: creditors[j].userId, amount: round2(pay) });
    }
    debtors[i].amount += pay;
    creditors[j].amount -= pay;
    if (Math.abs(debtors[i].amount) < 0.005) i++;
    if (Math.abs(creditors[j].amount) < 0.005) j++;
  }
  return settlements;
};
