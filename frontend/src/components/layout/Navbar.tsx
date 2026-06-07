import { Link, useNavigate } from 'react-router-dom';
import { Plane, LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../features/NotificationBell';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-primary-600 font-bold text-xl">
            <Plane size={24} />
            <span>Travel</span>
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <User size={16} className="text-primary-600" />
              </div>
              <span className="hidden sm:block font-medium">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:block">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
