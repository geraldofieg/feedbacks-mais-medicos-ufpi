import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, CalendarRange, Megaphone, AlertTriangle, ClipboardList, LogOut } from 'lucide-react';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Só exibe o menu se o usuário estiver logado
  if (!currentUser) return null;

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  }

  // Lista dos botões principais (Padronizado 'Comunicação')
  const navLinks = [
    { path: '/', icon: <Home size={18} />, label: 'Início' },
    { path: '/cronograma', icon: <CalendarRange size={18} />, label: 'Datas' },
    { path: '/comunicacao', icon: <Megaphone size={18} />, label: 'Comunicação' },
    { path: '/pendencias', icon: <AlertTriangle size={18} />, label: 'Pendências' },
    { path: '/mapa', icon: <ClipboardList size={18} />, label: 'Mapa' },
  ];

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* === MODO COMPUTADOR === */}
        <div className="hidden md:flex items-center justify-between h-16">
          <Link to="/" className="font-black text-blue-900 flex items-center gap-2">
            <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">UFPI</span>
            <span>Mais Médicos</span>
          </Link>

          <div className="flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-1.5 text-sm font-bold transition-all ${
                  location.pathname === link.path 
                    ? 'text-blue-600 border-b-2 border-blue-600 py-5' 
                    : 'text-gray-500 hover:text-blue-500 py-5'
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm font-bold text-red-500 hover:text-red-700 ml-4 py-5 border-l border-gray-200 pl-6">
              <LogOut size={18} /> Sair
            </button>
          </div>
        </div>

        {/* === MODO CELULAR (Menu Horizontal com Scroll) === */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto py-3 w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
          
          <Link to="/" className="shrink-0 flex items-center justify-center bg-blue-900 text-white w-8 h-8 rounded-lg mr-1">
            <Home size={16} />
          </Link>

          {navLinks.filter(link => link.path !== '/').map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-2 rounded-full transition-colors ${
                location.pathname === link.path 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}

          <button 
            onClick={handleLogout} 
            className="shrink-0 flex items-center gap-1 text-xs font-bold whitespace-nowrap px-3 py-2 rounded-full bg-red-50 text-red-600 border border-red-100 ml-1"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>

      </div>
    </div>
  );
}
