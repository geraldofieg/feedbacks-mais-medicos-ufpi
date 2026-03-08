import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, GraduationCap, FileText, UserPlus } from 'lucide-react';

export default function BotaoGlobal() {
  const { escolaSelecionada } = useAuth();
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickFora(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  useEffect(() => {
    setAberto(false);
  }, [location.pathname]);

  if (!escolaSelecionada?.id || location.pathname === '/login') return null;

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 flex flex-col items-end pointer-events-none">
      
      <div 
        className={`flex flex-col gap-3 mb-4 transition-all duration-300 origin-bottom ${
          aberto ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        {/* 1º LUGAR (TOPO): NOVO REGISTRO (Mais Usado) */}
        <Link to="/tarefas" className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl shadow-lg border border-gray-100 hover:bg-orange-50 transition-all pointer-events-auto group">
          <span className="font-bold text-gray-600 text-sm group-hover:text-orange-700">Novo Registro</span>
          <div className="bg-orange-100 text-orange-600 p-2 rounded-xl"><FileText size={18} /></div>
        </Link>

        {/* 2º LUGAR: NOVO ALUNO */}
        <Link to="/alunos" className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl shadow-lg border border-gray-100 hover:bg-green-50 transition-all pointer-events-auto group">
          <span className="font-bold text-gray-600 text-sm group-hover:text-green-700">Novo Aluno</span>
          <div className="bg-green-100 text-green-600 p-2 rounded-xl"><UserPlus size={18} /></div>
        </Link>

        {/* 3º LUGAR: NOVA TURMA (Menos Usado) */}
        <Link to="/turmas" className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl shadow-lg border border-gray-100 hover:bg-blue-50 transition-all pointer-events-auto group">
          <span className="font-bold text-gray-600 text-sm group-hover:text-blue-700">Nova Turma</span>
          <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><GraduationCap size={18} /></div>
        </Link>
      </div>

      <button
        onClick={() => setAberto(!aberto)}
        className={`pointer-events-auto p-4 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center ${
          aberto ? 'bg-red-500 hover:bg-red-600 rotate-90 scale-95' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 hover:shadow-2xl'
        } text-white`}
      >
        {aberto ? <X size={28} strokeWidth={2.5} /> : <Plus size={28} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
