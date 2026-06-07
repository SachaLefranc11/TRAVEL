import { Response } from 'express';
import prisma from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { addClient, removeClient } from '../services/notifications.service';

/** GET /notifications/stream — flux SSE des nouvelles notifications. */
export const streamNotifications = (req: AuthRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const userId = req.userId!;
  addClient(userId, res);

  // Ping régulier pour garder la connexion vivante (proxies/Render)
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(userId, res);
  });
};

export const getNotifications = async (req: AuthRequest, res: Response) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(items);
};

export const markAllRead = async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.status(204).send();
};

export const markRead = async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id as string, userId: req.userId },
    data: { read: true },
  });
  res.status(204).send();
};
