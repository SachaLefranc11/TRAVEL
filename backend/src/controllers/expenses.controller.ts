import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { canSeeExpense } from '../utils/expenseVisibility';
import { notifyTripMembers } from '../services/notifications.service';

const isMember = async (tripId: string, userId: string) =>
  prisma.tripParticipant.findFirst({ where: { tripId, userId } });

const expenseInclude = {
  paidBy: { select: { id: true, name: true, avatar: true } },
  shares: true,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

type ShareRow = { userId: string; amount: number };

/** Une répartition est "perso" (non partagée) si elle se limite au payeur. */
const isPersonalSplit = (shareRows: ShareRow[], payerId: string): boolean =>
  shareRows.length === 0 || (shareRows.length === 1 && shareRows[0].userId === payerId);

/**
 * Construit les dépenses personnelles dérivées (la part de chaque participant)
 * à partir d'une dépense partagée. Chacune appartient au participant concerné.
 */
const buildChildren = (
  parentId: string,
  scalars: { title: string; currency: string; category: string; date: Date; tripId: string },
  shareRows: ShareRow[],
) =>
  shareRows.map((s) => ({
    title: `${scalars.title} (partagé) — ta part : ${s.amount.toFixed(2)} ${scalars.currency}`,
    amount: s.amount,
    currency: scalars.currency,
    category: scalars.category,
    date: scalars.date,
    tripId: scalars.tripId,
    paidById: s.userId,
    parentExpenseId: parentId,
  }));

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
  // Confidentialité : on ne renvoie que les dépenses partagées + les dépenses
  // personnelles de l'utilisateur courant.
  res.json(expenses.filter((e) => canSeeExpense(e, req.userId!)));
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

  const expenseDate = new Date(date);
  const shared = !isPersonalSplit(shareRows, payerId);

  const expense = await prisma.$transaction(async (tx) => {
    const main = await tx.expense.create({
      data: {
        title, amount, currency, category, notes,
        date: expenseDate,
        tripId,
        paidById: payerId,
        shares: { create: shareRows },
      },
      include: expenseInclude,
    });
    // Dépense partagée → on crée la part personnelle de chaque participant
    if (shared) {
      await tx.expense.createMany({
        data: buildChildren(main.id, { title, currency, category, date: expenseDate, tripId }, shareRows),
      });
    }
    return main;
  });

  if (shared) {
    const actor = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true } });
    await notifyTripMembers(tripId, req.userId!, {
      type: 'EXPENSE',
      message: `${actor?.name ?? 'Un participant'} a ajouté la dépense partagée « ${title} » (${amount} ${currency})`,
      tripId,
    });
  }

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

  // Les parts personnelles générées automatiquement ne sont pas modifiables directement
  if (existing.parentExpenseId) {
    res.status(400).json({ error: 'Cette dépense est générée automatiquement et gérée via la dépense partagée.' });
    return;
  }

  // Seul le payeur (= créateur) peut modifier sa dépense
  if (existing.paidById !== req.userId) {
    res.status(403).json({ error: 'Seul le créateur de la dépense peut la modifier.' }); return;
  }

  const b = req.body;
  const splitChanged = ['amount', 'splitType', 'participantIds', 'shares', 'paidById']
    .some((k) => b[k] !== undefined);

  const data: any = {};
  for (const k of ['title', 'currency', 'category', 'notes'] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  if (b.date) data.date = new Date(b.date);
  if (b.paidById) data.paidById = b.paidById;
  if (b.amount !== undefined) data.amount = b.amount;

  // Valeurs effectives (nouvelles ou existantes) pour reconstruire les parts dérivées
  const eff = {
    title: b.title ?? existing.title,
    currency: b.currency ?? existing.currency,
    category: b.category ?? existing.category,
    date: b.date ? new Date(b.date) : existing.date,
    amount: b.amount ?? existing.amount,
    payerId: b.paidById ?? existing.paidById,
  };

  let shareRows: ShareRow[] = existing.shares.map((s) => ({ userId: s.userId, amount: s.amount }));

  if (splitChanged) {
    const members = await prisma.tripParticipant.findMany({ where: { tripId }, select: { userId: true } });
    const memberIds = new Set(members.map((m) => m.userId));
    if (!memberIds.has(eff.payerId)) {
      res.status(400).json({ error: 'Le payeur doit être un participant du voyage.' }); return;
    }
    const splitType = (b.splitType ?? 'EQUAL') as 'PERSONAL' | 'EQUAL' | 'CUSTOM';
    const fallbackParticipants = existing.shares.map((s) => s.userId);
    const participantIds = b.participantIds ?? (splitType === 'EQUAL' ? fallbackParticipants : undefined);
    try {
      shareRows = buildShares(eff.amount, splitType, eff.payerId, memberIds, participantIds, b.shares);
    } catch (e) {
      res.status(400).json({ error: shareErrorMessage(e) }); return;
    }
    data.shares = { deleteMany: {}, create: shareRows };
  }

  const shared = !isPersonalSplit(shareRows, eff.payerId);

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({ where: { id: eid }, data });
    // On régénère systématiquement les parts dérivées (titre/montant peuvent avoir changé)
    await tx.expense.deleteMany({ where: { parentExpenseId: eid } });
    if (shared) {
      await tx.expense.createMany({
        data: buildChildren(eid, { title: eff.title, currency: eff.currency, category: eff.category, date: eff.date, tripId }, shareRows),
      });
    }
  });

  const updated = await prisma.expense.findUnique({ where: { id: eid }, include: expenseInclude });

  if (shared) {
    const actor = await prisma.user.findUnique({ where: { id: req.userId! }, select: { name: true } });
    await notifyTripMembers(tripId, req.userId!, {
      type: 'EXPENSE',
      message: `${actor?.name ?? 'Un participant'} a modifié la dépense partagée « ${eff.title} »`,
      tripId,
    });
  }

  res.json(updated);
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  const tripId = req.params.tripId as string;
  const eid = req.params.eid as string;
  const expense = await prisma.expense.findFirst({ where: { id: eid, tripId } });
  if (!expense) { res.status(404).json({ error: 'Expense not found' }); return; }

  // Une part personnelle dérivée se supprime via sa dépense partagée parente, pas directement
  if (expense.parentExpenseId) {
    res.status(400).json({ error: 'Cette dépense est générée automatiquement (supprimez la dépense partagée).' });
    return;
  }

  // Seul le payeur (= créateur) peut supprimer sa dépense
  if (expense.paidById !== req.userId) {
    res.status(403).json({ error: 'Seul le créateur de la dépense peut la supprimer.' }); return;
  }

  // Les parts dérivées (children) sont supprimées en cascade par la FK
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
    select: { amount: true, currency: true, paidById: true, parentExpenseId: true, shares: { select: { userId: true, amount: true } } },
  });

  // net[currency][userId] = total payé - total dû
  const byCurrency = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    // On ignore les parts dérivées (sinon double comptage) et les dépenses perso/legacy
    if (e.parentExpenseId) continue;
    if (e.shares.length === 0) continue;
    if (e.shares.length === 1 && e.shares[0].userId === e.paidById) continue;

    const net = byCurrency.get(e.currency) ?? new Map<string, number>();
    net.set(e.paidById, (net.get(e.paidById) ?? 0) + e.amount);
    for (const s of e.shares) net.set(s.userId, (net.get(s.userId) ?? 0) - s.amount);
    byCurrency.set(e.currency, net);
  }

  // Applique les remboursements déjà enregistrés : le débiteur a payé, le créancier a reçu
  const settlements = await prisma.settlement.findMany({
    where: { tripId },
    select: { fromUserId: true, toUserId: true, amount: true, currency: true },
  });
  for (const s of settlements) {
    const net = byCurrency.get(s.currency) ?? new Map<string, number>();
    net.set(s.fromUserId, (net.get(s.fromUserId) ?? 0) + s.amount);
    net.set(s.toUserId, (net.get(s.toUserId) ?? 0) - s.amount);
    byCurrency.set(s.currency, net);
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
