import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Check, X, BookOpen, Users, FileText, RefreshCw, GraduationCap } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function MapaEntregas() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });
  
  const [alunos, setAlunos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);
  const [erro, setErro] = useState(null);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state]);

  useEffect(() => {
    if (turmaAtiva) localStorage.setItem('ultimaTurmaAtiva', turmaAtiva);
  }, [turmaAtiva]);

  async function fetchTurmas() {
    if (!currentUser || !escolaSelecionada?.id) {
      setLoadingTurmas(false);
      return; 
    }
    setErro(null);
    setLoadingTurmas(true);
    try {
      const turmasRef = collection(db, 'turmas');
      const qT = isAdmin
        ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
        : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        
      const snapT = await getDocs(qT);
      const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
      setTurmas(turmasData);
      
      const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
      const isValid = turmasData.some(t => t.id === targetTurma);
      
      if (isValid) {
        if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
      } else if (turmasData.length > 0) {
        setTurmaAtiva(turmasData[0].id);
      }
    } catch (error) {
      setErro("Falha de conexão com o banco de dados.");
    } finally {
      setLoadingTurmas(false);
    }
  }

  useEffect(() => { fetchTurmas(); }, [currentUser, escolaSelecionada, isAdmin]);

  useEffect(() => {
    async function fetchMatriz() {
      if (!turmaAtiva) {
        setAlunos([]); setTarefas([]); setAtividades([]); return;
      }
      setLoadingMatriz(true);
      try {
        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapAlunos = await getDocs(qAlunos);
        setAlunos(snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome)));

        const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapTarefas = await getDocs(qTarefas);
        const tarefasData = snapTarefas.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.status !== 'lixeira' && (t.tipo === 'entrega' || !t.tipo))
          .sort((a, b) => a.dataCriacao?.toMillis() - b.dataCriacao?.toMillis());
        setTarefas(tarefasData);

        const qAtividades = query(collection(db, 'atividades'), where('turmaId', '==', turmaAtiva));
        const snapAtividades = await getDocs(qAtividades);
        setAtividades(snapAtividades.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao montar o mapa:", error);
      } finally {
        setLoadingMatriz(false);
      }
    }
    fetchMatriz();
  }, [turmaAtiva]);

  // AJUSTE DE OURO: Verifica se existe entrega REAL (texto ou arquivo)
  const verificarEntrega = (alunoId, tarefaId) => {
    const ativ = atividades.find(a => a.alunoId === alunoId && a.tarefaId === tarefaId);
    if (!ativ) return false;
    // Consideramos entregue se tiver resposta escrita ou link de arquivo
    return (ativ.resposta && String(ativ.resposta).trim() !== '') || !!ativ.arquivoUrl;
  };

  const isCarregando = loadingTurmas || loadingMatriz;

  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
        <h2 className="text-2xl font-black text-blue-800">Instituição não selecionada</h2>
        <Link to="/" className="inline-flex mt-6 bg-blue-600 text-white font-black py-4 px-10 rounded-xl">Ir para o Início</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Mapa de Entregas (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 tracking-tight">
            <ClipboardList className="text-blue-600" size={22} /> Mapa de Entregas
          </h1>
          {!isCarregando && turmas.length > 0 && (
            <select className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl py-2 px-3 font-bold shadow-sm outline-none" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
        </div>
      </div>

      {isCarregando ? (
        <div className="p-20 text-center animate-pulse flex flex-col items-center gap-3"><ClipboardList className="text-blue-300" size={48} /><p className="font-bold text-blue-400">Sincronizando entregas...</p></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-2">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-black text-gray-700 text-sm">Status da Matriz</h3>
            <div className="flex gap-4 text-[10px] font-black uppercase text-gray-500">
              <span className="flex items-center gap-1"><Check className="text-green-500" size={14}/> Entregue</span>
              <span className="flex items-center gap-1"><X className="text-red-400" size={14}/> Pendente</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-4 md:pl-6 border-b border-gray-200 text-[10px] uppercase font-black text-gray-400 tracking-wider sticky left-0 bg-gray-50 z-10 shadow-md">Aluno</th>
                  {tarefas.map(tarefa => (
                    <th key={tarefa.id} className="px-3 py-4 text-center border-b border-l border-gray-200 min-w-[120px] max-w-[180px]">
                      <div className="text-[9px] uppercase font-black text-orange-500 tracking-widest mb-1">Tarefa</div>
                      <div className="font-bold text-gray-700 text-xs truncate" title={tarefa.nomeTarefa || tarefa.titulo}>{tarefa.nomeTarefa || tarefa.titulo}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunos.map(aluno => (
                  <tr key={aluno.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 py-4 md:pl-6 font-bold text-gray-800 text-sm sticky left-0 bg-white group-hover:bg-blue-50/30 z-10 shadow-md">{aluno.nome}</td>
                    {tarefas.map(tarefa => {
                      const entregou = verificarEntrega(aluno.id, tarefa.id);
                      return (
                        <td key={tarefa.id} className="px-3 py-3 text-center border-l border-gray-100">
                          {entregou ? (
                            <div className="inline-flex bg-green-100 text-green-600 p-1.5 rounded-full shadow-sm" title="Entrega Identificada"><Check size={14} strokeWidth={4}/></div>
                          ) : (
                            <div className="inline-flex bg-red-50 text-red-300 p-1.5 rounded-full" title="Pendente"><X size={14} strokeWidth={4}/></div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
