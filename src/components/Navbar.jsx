import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Home, CalendarRange, Megaphone, AlertTriangle, ClipboardList, LogOut, GraduationCap, Building2, Users } from 'lucide-react';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Estados do nosso Seletor Global de SaaS
  const [instituicoes, setInstituicoes] = useState([]);
  const [turmas, setTurmas] = useState([]);
  
  // Puxa do navegador o que o professor tinha selecionado por último
  const [instSelecionada, setInstSelecionada] = useState(localStorage.getItem('saas_inst') || '');
  const [turmaSelecionada, setTurmaSelecionada] = useState(localStorage.getItem('saas_turma') || '');

  // Busca os Workspaces no banco de dados (Apenas se estiver logado)
  useEffect(() => {
    if (!currentUser) return;
    
    const unsubInst = onSnapshot(query(collection(db, 'saas_instituicoes'), orderBy('nome', 'asc')), (snap) => {
      setInstituicoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubTurmas = onSnapshot(query(collection(db, 'saas_turmas'), orderBy('nome', 'asc')), (snap) => {
      setTurmas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubInst(); unsubTurmas(); };
  }, [currentUser]);

  // Funções para atualizar a interface e salvar a escolha no navegador
  const handleInstChange = (e) => {
    const val = e.target.value;
    setInstSelecionada(val);
    localStorage.setItem('saas_inst', val);
    
    // Se mudou a instituição, limpa a turma para não cruzar dados errados
    setTurmaSelecionada('');
    localStorage.removeItem('saas_turma');
  };

  const handleTurmaChange = (e) => {
    const val = e.target.value;
    setTurmaSelecionada(val);
    localStorage.setItem('saas_turma', val);
  };

  // Filtra as turmas para mostrar apenas as que pertencem à Instituição selecionada
  const turmasFiltradas = turmas.filter(t => t.idInstituicao === instSelecionada);

  if (!currentUser) return null;

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
          
          <div className="flex items-center gap-6">
            {/* Nova Logo SaaS */}
            <Link to="/" className="font-black text-indigo-900 flex items-center gap-2 mr-4">
              <div className="bg-indigo-600 text-white w-8 h-8 rounded-lg flex items-center justify-center">
                <GraduationCap size={20} />
              </div>
              <span className="tracking-tight">Plataforma do Professor</span>
            </Link>

            {/* SELETOR GLOBAL DE WORKSPACE (SaaS) */}
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
              <div className="flex items-center gap-1.5 px-2">
                <Building2 size={16} className="text-gray-400" />
                <select 
                  className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer max-w-[150px] truncate"
                  value={instSelecionada} 
                  onChange={handleInstChange}
                >
                  <option value="">1. Instituição...</option>
                  {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
                </select>
              </div>
              
              <div className="w-px h-6 bg-gray-300"></div>

              <div className="flex items-center gap-1.5 px-2">
                <Users size={16} className="text-gray-400" />
                <select 
                  className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer max-w-[150px] truncate disabled:opacity-50"
                  value={turmaSelecionada} 
                  onChange={handleTurmaChange}
                  disabled={!instSelecionada}
                >
                  <option value="">2. Turma...</option>
                  {turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Links de Navegação */}
          <div className="flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-1.5 text-sm font-bold transition-all ${
                  location.pathname === link.path 
                    ? 'text-indigo-600 border-b-2 border-indigo-600 py-5' 
                    : 'text-gray-500 hover:text-indigo-500 py-5'
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

        {/* === MODO CELULAR === */}
        <div className="md:hidden">
          {/* Nova Logo Mobile & Logout */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
             <Link to="/" className="font-black text-indigo-900 flex items-center gap-2">
              <div className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center">
                <GraduationCap size={16} />
              </div>
              <span className="text-sm tracking-tight">Plataforma do Professor</span>
            </Link>
            <button onClick={handleLogout} className="text-xs font-bold text-red-500 flex items-center gap-1"><LogOut size={14}/> Sair</button>
          </div>

          {/* Seletor Global Mobile */}
          <div className="flex flex-col gap-2 py-3 border-b border-gray-100 bg-gray-50 px-2 rounded-lg mt-2">
            <select className="w-full bg-white border border-gray-200 p-2 rounded text-xs font-bold text-gray-700 outline-none" value={instSelecionada} onChange={handleInstChange}>
              <option value="">Selecione a Instituição...</option>
              {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
            </select>
            <select className="w-full bg-white border border-gray-200 p-2 rounded text-xs font-bold text-gray-700 outline-none disabled:opacity-50" value={turmaSelecionada} onChange={handleTurmaChange} disabled={!instSelecionada}>
              <option value="">Selecione a Turma...</option>
              {turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          {/* Menu Horizontal com Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto py-3 w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
            
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`shrink-0 flex items-center gap-1.5 text-xs font-bold whitespace-nowrap px-3 py-2 rounded-full transition-colors ${
                  location.pathname === link.path 
                    ? 'bg-indigo-100 text-indigo-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {link.icon} {link.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
