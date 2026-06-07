import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications.service';

/**
 * Abonnement SSE global : à chaque évènement temps réel, invalide les bons
 * caches react-query pour que l'UI se mette à jour sans recharger la page.
 */
export const useRealtimeSync = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const unsubscribe = notificationsService.subscribe((data) => {
      const tripId: string | undefined = data?.tripId;

      // Notifications persistées (badge + liste)
      if (data?.message) qc.invalidateQueries({ queryKey: ['notifications'] });

      if (tripId) {
        switch (data?.type) {
          case 'EXPENSE':
            qc.invalidateQueries({ queryKey: ['trip', tripId] });
            qc.invalidateQueries({ queryKey: ['balances', tripId] });
            qc.invalidateQueries({ queryKey: ['settlements', tripId] });
            break;
          case 'PLANNER':
            qc.invalidateQueries({ queryKey: ['planner', tripId] });
            qc.invalidateQueries({ queryKey: ['planner-logs', tripId] });
            break;
        }
        // Positions live (évènement éphémère, sans notification persistée)
        if (data?.kind === 'positions') {
          qc.invalidateQueries({ queryKey: ['positions', tripId] });
        }
        // Voyage modifié (ex : lieux IA générés) → rafraîchit le voyage
        if (data?.kind === 'trip') {
          qc.invalidateQueries({ queryKey: ['trip', tripId] });
        }
      }

      // Invitation à un voyage → rafraîchit la liste du tableau de bord
      if (data?.type === 'INVITE') qc.invalidateQueries({ queryKey: ['trips'] });
    });

    return unsubscribe;
  }, [qc]);
};
