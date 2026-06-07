import { ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { Navbar } from './Navbar';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const online = useOnlineStatus();
  const qc = useQueryClient();

  // Resynchronisation auto au retour de la connexion
  useEffect(() => {
    if (online) qc.invalidateQueries();
  }, [online, qc]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {!online && (
        <div className="bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff size={15} />
          Mode hors-ligne — affichage des données en cache. La synchronisation reprendra au retour du réseau.
        </div>
      )}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
