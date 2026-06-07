import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import tripsRoutes from './routes/trips.routes';
import aiRoutes from './routes/ai.routes';
import notificationsRoutes from './routes/notifications.routes';

const app = express();

// CORS : autorise le frontend local ET la future URL Vercel
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Autorise les appels sans origin (Postman, mobile) et les origines connues
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour : ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json());

// Health check pour Render (évite le cold start error)
app.get('/health', (_req, res) => res.json({ status: 'ok', env: process.env.NODE_ENV }));

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationsRoutes);

// Gestionnaire d'erreurs global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT} [${process.env.NODE_ENV ?? 'development'}]`));

export default app;
