import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../services/prisma.service';
import { sendPasswordResetEmail } from '../services/email.service';
import { AuthRequest } from '../middleware/auth.middleware';

const signToken = (userId: string) =>
  jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });

// Durée de vie d'un jeton de réinitialisation : 15 minutes
const RESET_TTL_MS = 15 * 60 * 1000;

// On stocke uniquement le hash SHA-256 du jeton (le jeton brut part dans l'email).
const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
    select: { id: true, name: true, email: true, avatar: true, createdAt: true },
  });
  res.status(201).json({ token: signToken(user.id), user });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const { password: _, ...safeUser } = user;
  res.json({ token: signToken(user.id), user: safeUser });
};

/**
 * POST /auth/forgot-password
 * Génère un jeton de réinitialisation et envoie le lien par email.
 * Réponse TOUJOURS générique pour ne pas révéler si l'email existe (anti-énumération).
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  const generic = {
    message: "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.",
  };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Invalide les éventuels jetons précédents non utilisés
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

      const rawToken = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: hashToken(rawToken),
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });

      const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '');
      const resetUrl = `${base}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (err) {
        // On n'expose pas l'échec d'envoi au client (réponse générique)
        console.error('[forgotPassword] envoi email échoué :', err);
      }
    }
  } catch (err) {
    console.error('[forgotPassword]', err);
  }

  res.json(generic);
};

/**
 * POST /auth/reset-password
 * Valide le jeton (hash, expiration, usage unique) puis met à jour le mot de passe.
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    res.status(400).json({ error: 'Lien invalide ou expiré. Refaites une demande.' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, avatar: true, createdAt: true },
  });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
};
