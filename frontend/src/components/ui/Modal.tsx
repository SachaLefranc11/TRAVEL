import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

/** Force tous les conteneurs Leaflet à passer derrière le modal */
const setLeafletBehind = (behind: boolean) => {
  const containers = document.querySelectorAll<HTMLElement>('.leaflet-container');
  containers.forEach(el => {
    el.style.zIndex       = behind ? '-1'   : '';
    el.style.pointerEvents = behind ? 'none' : '';
  });
  // Aussi les panes internes de Leaflet
  const panes = document.querySelectorAll<HTMLElement>('.leaflet-pane, .leaflet-control-container');
  panes.forEach(el => {
    el.style.zIndex = behind ? '-1' : '';
  });
};

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: Props) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setLeafletBehind(true);
    }
    return () => {
      document.body.style.overflow = '';
      setLeafletBehind(false);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2000 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
