import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; // NOVO
import { db } from '../services/firebase'; // NOVO
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, GraduationCap, FileText, UserPlus, PlayCircle } from 'lucide-react'; // NOVO: Ícone PlayCircle adicionado

export default function BotaoGlobal() {
  const { escolaSelecionada } = useAuth();
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const [tarefaAtualId, setTarefaAtualId] = useState(null); // NOVO: Guarda o ID da tarefa vigente
  const menuRef = useRef(null);

  // Fecha o menu ao clicar fora dele
  useEffect(() => {
    function handleClickFora(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Fecha o menu automaticamente ao mudar de página
  useEffect(() => {
    setAberto(false);
  }, [location.pathname]);

  // NOVO: Inteligência que descobre se tem tarefa rolando
  useEffect(() => {
    async function fetchTarefaAtual() {
      // Só gasta leitura do banco se tiver escola e se o menu estiver aberto
      if (!escolaSelecionada?.id || !aberto) return;

      try {
        const q = query(
          collection(db, 'tarefas'),
          where('instituicaoId', '==', escolaSelecionada.id)
        );
        const snap = await getDocs(q);
        const tarefas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                                 .filter(t => t.status !== 'lixeira' && t.tipo === 'entrega');

        const hojeTime = new Date().getTime();
        let tarefaVigente = null;

        for (let t of tarefas) {
          if (!t.dataFim) continue;
          const endObj = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
          const startRaw = t.dataInicio || t.data_inicio || t.dataCriacao;
          const startObj = startRaw ? (startRaw.toDate ? startRaw.toDate() : new Date(startRaw)) : new Date();

          // Verifica se hoje está dentro do prazo
          if (startObj.getTime() <= hojeTime && endObj.getTime() >= hojeTime) {
            if (!tarefaVigente || endObj.getTime() < tarefaVigente.timeFim) {
              tarefaVigente = { id: t.id, timeFim: endObj.getTime() };
            }
          }
        }

        setTarefaAtualId(tarefaVigente ? tarefaVigente.id : null);
      } catch (e) {
        console.error("Erro ao buscar tarefa atual para o FAB", e);
      }
    }

    fetchTarefaAtual();
  }, [escolaSelecionada, aberto]);

  // AJUSTE: Oculta o botão se não houver escola ou se estiver em páginas de acesso
  const paginasOcultas = ['/login', '/cadastro', '/assinatura-vencida']; // Aproveitei para esconder na tela de bloqueio
  if (!escolaSelecionada?.id || paginasOcultas.includes(location.pathname)) return null;

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 flex flex-col items-end pointer-events-none">
      
      {/* MENU DE OPÇÕES (Aparece ao clicar no +) */}
      <div 
        className={`flex flex-col gap-3 mb-4 transition-all duration-300 origin-bottom ${
          aberto ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        {/* NOVO (0º LUGAR VIP): CORRIGIR TAREFA ATUAL (Aparece só se houver tarefa rolando) */}
        {tarefaAtualId && (
          <Link to={`/revisar/${tarefaAtualId}`} className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-xl border border-indigo-200 hover:bg-indigo-50 transition-all pointer-events-auto group">
            <span className="font-black text-indigo-700 text-sm group-hover:text-indigo-800">Corrigir tarefa atual</span>
            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <PlayCircle size={20} />
            </div>
          </Link>
        )}

        {/* 1º LUGAR: NOVO REGISTRO / TAREFA (O mais usado na esteira) */}
        <Link to="/tarefas" className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-xl border border-gray-100 hover:bg-orange-50 transition-all pointer-events-auto group">
          <span className="font-black text-gray-600 text-sm group-hover:text-orange-700">Novo Registro</span>
          <div className="bg-orange-100 text-orange-600 p-2 rounded-xl shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-colors">
            <FileText size={20} />
          </div>
        </Link>

        {/* 2º LUGAR: NOVO ALUNO */}
        <Link to="/alunos" className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-xl border border-gray-100 hover:bg-green-50 transition-all pointer-events-auto group">
          <span className="font-black text-gray-600 text-sm group-hover:text-green-700">Novo Aluno</span>
          <div className="bg-green-100 text-green-600 p-2 rounded-xl shadow-sm group-hover:bg-green-600 group-hover:text-white transition-colors">
            <UserPlus size={20} />
          </div>
        </Link>

        {/* 3º LUGAR: NOVA TURMA */}
        <Link to="/turmas" className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-xl border border-gray-100 hover:bg-blue-50 transition-all pointer-events-auto group">
          <span className="font-black text-gray-600 text-sm group-hover:text-blue-700">Nova Turma</span>
          <div className="bg-blue-100 text-blue-600 p-2 rounded-xl shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <GraduationCap size={20} />
          </div>
        </Link>
      </div>

      {/* BOTÃO PRINCIPAL (O Círculo com +) */}
      <button
        onClick={() => setAberto(!aberto)}
        className={`pointer-events-auto w-16 h-16 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ${
          aberto ? 'bg-red-500 hover:bg-red-600 rotate-90 scale-90' : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 shadow-blue-500/30'
        } text-white`}
      >
        {aberto ? <X size={32} strokeWidth={2.5} /> : <Plus size={32} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
