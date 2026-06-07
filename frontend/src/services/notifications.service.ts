import api from './api';
import { Notification } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const notificationsService = {
  list: () => api.get<Notification[]>('/notifications').then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all'),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),

  /**
   * Abonnement SSE via fetch (token dans l'en-tête Authorization, pas dans l'URL).
   * Se reconnecte automatiquement tant qu'on n'a pas appelé la fonction de nettoyage.
   */
  subscribe: (onMessage: () => void): (() => void) => {
    const controller = new AbortController();
    let stopped = false;

    const loop = async () => {
      while (!stopped) {
        const token = localStorage.getItem('token');
        if (!token) { await wait(3000); continue; }
        try {
          const res = await fetch(`${BASE_URL}/notifications/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (res.ok && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            while (!stopped) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const chunks = buf.split('\n\n');
              buf = chunks.pop() ?? '';
              for (const c of chunks) {
                if (c.split('\n').some((line) => line.startsWith('data:'))) onMessage();
              }
            }
          }
        } catch {
          if (stopped) break; // abort volontaire
        }
        if (!stopped) await wait(3000); // délai avant reconnexion
      }
    };

    loop();
    return () => { stopped = true; controller.abort(); };
  },
};
