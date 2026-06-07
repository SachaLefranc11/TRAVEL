import { Response } from 'express';
import prisma from './prisma.service';

/**
 * Hub SSE en mémoire : userId -> connexions ouvertes.
 * NB : adapté à une seule instance (cas Render free). Pour scaler horizontalement,
 * il faudrait un pub/sub partagé (Redis).
 */
const clients = new Map<string, Set<Response>>();

export const addClient = (userId: string, res: Response) => {
  const set = clients.get(userId) ?? new Set<Response>();
  set.add(res);
  clients.set(userId, set);
};

export const removeClient = (userId: string, res: Response) => {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
};

const sendEvent = (userId: string, data: unknown) => {
  const set = clients.get(userId);
  if (!set) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* connexion morte, nettoyée au close */ }
  }
};

export interface NotificationPayload {
  type: 'EXPENSE' | 'PLANNER' | 'INVITE';
  message: string;
  tripId?: string;
}

/** Persiste une notification pour chaque destinataire et l'émet en SSE. */
export const notify = async (userIds: string[], n: NotificationPayload) => {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, type: n.type, message: n.message, tripId: n.tripId })),
    });
    for (const userId of unique) {
      sendEvent(userId, { type: n.type, message: n.message, tripId: n.tripId, at: new Date().toISOString() });
    }
  } catch (err) {
    console.error('[notify]', err);
  }
};

/** Notifie tous les participants d'un voyage sauf l'auteur de l'action. */
export const notifyTripMembers = async (tripId: string, exceptUserId: string, n: NotificationPayload) => {
  const members = await prisma.tripParticipant.findMany({ where: { tripId }, select: { userId: true } });
  await notify(members.map((m) => m.userId).filter((uid) => uid !== exceptUserId), n);
};

/**
 * Émet un évènement SSE éphémère (sans persistance) aux membres d'un voyage —
 * sert à déclencher un rafraîchissement temps réel (ex : positions live).
 */
export const broadcastToTripMembers = async (
  tripId: string,
  exceptUserId: string,
  data: Record<string, unknown>,
) => {
  const members = await prisma.tripParticipant.findMany({ where: { tripId }, select: { userId: true } });
  for (const m of members) {
    if (m.userId !== exceptUserId) sendEvent(m.userId, data);
  }
};
