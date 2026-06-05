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

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: Props) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — fixed, couvre TOUT l'écran, z-index très haut */}
      <div
        className="fixed inset-0 bg-black/60"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Conteneur modal — centré, au-dessus du backdrop */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: 9999 }}
      >
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto pointer-events-auto`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </div>
      </div>
    </>
  );
};
