import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Home, CalendarRange, Megaphone, AlertTriangle, ClipboardList, LogOut, GraduationCap, Users, Crown, UserCircle, Settings, BookOpen, LifeBuoy, ChevronDown, Trash2 } from 'lucide-react';

export default function Navbar() {
  const { currentUser, userProfile, logout, escolaSelecionada } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // ESTADOS DO DROPDOWN DO PROFESSOR
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  // FECHA O MENU SE CLICAR FORA DELE
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
    }
  }

  const navLinks = [
    { path: '/', icon: <Home size={18} />, label: 'Início' },
    { path: '/turmas', icon: <Users size={18} />, label: 'Turmas' }, 
    { path: '/cronograma', icon: <CalendarRange size={18} />, label: 'Cronograma' },
    { path: '/comunicacao', icon: <Megaphone size={18} />, label: 'Comunicação' },
    { path: '/pendencias', icon: <AlertTriangle size={18} />, label: 'Pendências' },
    { path: '/mapa', icon: <ClipboardList size={18} />, label: 'Mapa' },
  ];

  const siglaEscola = escolaSelecionada?.nome ? escolaSelecionada.nome.split(' ')[0] : 'SaaS';
  const mostrarLinks = !!escolaSelecionada?.id;

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        
        {/* === MODO COMPUTADOR === */}
        <div className="hidden md:flex items-center justify-between h-16">
          
          <Link to="/" className="font-black text-blue-900 flex items-center gap-2 transition-transform hover:scale-105 shrink-0">
            <span className="bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm shadow-sm">
              <GraduationCap size={16} /> {siglaEscola}
            </span>
            {/* AJUSTE: Nome da plataforma corrigido */}
            <span className="text-gray-700 hidden lg:block">Plataforma do Professor</span>
          </Link>

          <div className="flex items-center gap-5 lg:gap-6">
            {mostrarLinks && navLinks.map(link => (
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
            
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 text-sm font-black transition-all ${
                  location.pathname === '/admin' 
                    ? 'text-purple-700 border-b-2 border-purple-600 py-5' 
                    : 'text-purple-500 hover:text-purple-700 py-5'
                }`}
              >
                <Crown size={18} /> Painel SaaS
              </Link>
            )}

            {/* O MENU DO PROFESSOR (DROPDOWN VIP) */}
            <div className="relative border-l border-gray-200 pl-5 ml-2" ref={menuRef}>
              <button 
                onClick={() => setMenuAberto(!menuAberto)} 
                className={`flex items-center gap-2 text-sm font-bold transition-all py-4 hover:text-blue-600 ${menuAberto ? 'text-blue-600' : 'text-gray-600'}`}
              >
                <div className={`p-1.5 rounded-full transition-colors ${menuAberto ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                  <UserCircle size={20} />
                </div>
                <span className="hidden lg:block">Minha Conta</span>
                <ChevronDown size={14} className={`transition-transform duration-200 text-gray-400 ${menuAberto ? 'rotate-180' : ''}`} />
              </button>

              {menuAberto && (
                <div className="absolute right-0 top-[60px] w-64 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="px-4 py-4 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">Sessão Ativa</p>
                    <p className="text-sm font-bold text-gray-800 truncate" title={currentUser.email}>{currentUser.email}</p>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    <Link to="/configuracoes" onClick={() => setMenuAberto(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                      <Settings size={18} /> Configurações / IA
                    </Link>
                    
                    {/* NOVO LINK DA LIXEIRA */}
                    <Link to="/lixeira" onClick={() => setMenuAberto(false)} className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                      <Trash2 size={18} /> Lixeira (Recuperar)
                    </Link>

                    <button onClick={() => { setMenuAberto(false); alert('O Guia de Uso será liberado em breve!'); }} className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                      <BookOpen size={18} /> Como Funciona o SaaS
                    </button>
                    
                    <button onClick={() => { setMenuAberto(false); window.open('https://wa.me/', '_blank'); }} className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors">
                      <LifeBuoy size={18} /> Ajuda e Suporte
                    </button>
                  </div>
                  
                  <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                    <button onClick={handleLogout} className="w-full text-left flex items-center gap-3 px-3 py-2.5 text-sm font-black text-red-600 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors">
                      <LogOut size={18} /> Sair da Plataforma
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* === MODO CELULAR === */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto py-3 w-full [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          <Link to="/" className="shrink-0 flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-lg mr-1 font-bold text-xs gap-1 shadow-sm">
            <GraduationCap size={16} /> {siglaEscola}
          </Link>

          {mostrarLinks && navLinks.filter(link => link.path !== '/').map(link => (
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

          {isAdmin && (
            <Link to="/admin" className={`shrink-0 flex items-center gap-1.5 text-xs font-black whitespace-nowrap px-3 py-2 rounded-full transition-colors ${location.pathname === '/admin' ? 'bg-purple-200 text-purple-800' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
              <Crown size={14} /> SaaS
            </Link>
          )}

          <div className="w-px h-6 bg-gray-300 shrink-0 mx-1"></div>

          <Link to="/configuracoes" className="shrink-0 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            <Settings size={14} /> Ajustes
          </Link>

          {/* LIXEIRA MOBILE */}
          <Link to="/lixeira" className="shrink-0 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            <Trash2 size={14} /> Lixeira
          </Link>

          <button onClick={() => window.open('https://wa.me/', '_blank')} className="shrink-0 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-2 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
            <LifeBuoy size={14} /> Ajuda
          </button>

          <button onClick={handleLogout} className="shrink-0 flex items-center gap-1 text-xs font-black whitespace-nowrap px-4 py-2 rounded-full bg-red-50 text-red-600 border border-red-100 hover:bg-red-100">
            <LogOut size={14} /> Sair
          </button>
        </div>

      </div>
    </div>
  );
}
