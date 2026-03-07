import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Check, X, BookOpen, Users, FileText, RefreshCw, GraduationCap } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function MapaEntregas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  
  // A MÁGICA DA MEMÓRIA: Verifica localStorage antes de ficar vazio
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });
  
  const [alunos, setAlunos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);
  const [erro, setErro] = useState(null);

  // O ESPIÃO DE CLIQUES: Força a atualização se a URL trouxer uma turma nova
  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state]);

  // SALVA NA MEMÓRIA: Toda vez que a turma ativa mudar, guarda no celular
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
      const qT = query(collection(db, 'turmas'), 
        where('instituicaoId', '==', escolaSelecionada.id),
        where('professorUid', '==', currentUser.uid)
      );
      const snapT = await getDocs(qT);
      const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
      setTurmas(turmasData);
      
      // Verifica se a turma na memória ainda existe e pertence a essa instituição
      const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
      const isValid = turmasData.some(t => t.id === targetTurma);
      
      if (isValid) {
        if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
      } else if (turmasData.length > 0) {
        setTurmaAtiva(turmasData[0].id); // Se não for válida, pega a primeira
      }
    } catch (error) {
      setErro("Falha de conexão com o banco de dados.");
    } finally {
      setLoadingTurmas(false);
    }
  }

  useEffect(() => { fetchTurmas(); }, [currentUser, escolaSelecionada]);

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
        
        // CORREÇÃO DO BUG AQUI: Filtra apenas as do tipo "entrega" para gerar as colunas do Mapa
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

  const verificarEntrega = (alunoId, tarefaId) => atividades.some(ativ => ativ.alunoId === alunoId && ativ.tarefaId === tarefaId);
  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';
  const isCarregando = loadingTurmas || loadingMatriz;

  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Mapa de Entregas' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Para visualizar o mapa, o sistema precisa saber em qual instituição você quer trabalhar.</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-xl hover:bg-blue-700 transition-all shadow-lg">Ir para o Centro de Comando</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Mapa de Entregas (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 tracking-tight">
            <ClipboardList className="text-blue-600" size={22} /> Visão Panorâmica <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-full ml-1">v3.3</span>
          </h1>

          {!isCarregando && turmas.length > 0 && (
            <div className="flex items-center gap-2">
              <select 
                className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 py-2 px-3 font-bold shadow-sm cursor-pointer w-full sm:w-auto outline-none"
                value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}
              >
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {isCarregando ? (
        <div className="p-20 text-center animate-pulse flex flex-col items-center gap-3"><ClipboardList className="text-blue-300" size={48} /><p className="font-bold text-blue-400">Sincronizando dados...</p></div>
      ) : erro ? (
        <div className="bg-red-50 border-2 border-dashed border-red-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10">
          <p className="text-red-600 font-bold mb-4">{erro}</p>
          <button onClick={fetchTurmas} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center gap-2 mx-auto hover:bg-red-700"><RefreshCw size={18} /> Tentar Novamente</button>
        </div>
      ) : turmas.length === 0 ? (
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10">
          <BookOpen className="mx-auto text-blue-400 mb-4" size={48} />
          <h2 className="text-xl font-black text-blue-800 mb-2">Sem turmas ativas</h2>
          <p className="text-blue-600 mb-6 font-medium">Você precisa criar uma turma antes de visualizar o mapa.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/turmas" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-md w-full sm:w-auto">Criar Turma</Link>
            <button onClick={fetchTurmas} className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 font-bold py-3 px-8 rounded-xl hover:bg-gray-50 transition-all border border-blue-200 shadow-sm w-full sm:w-auto"><RefreshCw size={18} /> Forçar Sincronização</button>
          </div>
        </div>
      ) : alunos.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-10 rounded-3xl text-center mt-6">
          <Users className="mx-auto text-gray-300 mb-3" size={40} />
          <h2 className="text-lg font-black text-gray-700 mb-1">Turma Vazia</h2>
          <p className="text-gray-500 text-sm mb-5">Adicione alunos à turma <strong>{getNomeTurmaAtiva()}</strong> para ver o mapa.</p>
          <Link to="/alunos" className="text-blue-600 font-bold hover:underline bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm">Adicionar Alunos</Link>
        </div>
      ) : tarefas.length === 0 ? (
        <div className="bg-orange-50 border border-orange-100 p-10 rounded-3xl text-center mt-6">
          <FileText className="mx-auto text-orange-300 mb-3" size={40} />
          <h2 className="text-lg font-black text-orange-800 mb-1">Nenhuma Entrega Criada</h2>
          <p className="text-orange-600 text-sm mb-5">Crie tarefas do tipo "Entrega" para a turma <strong>{getNomeTurmaAtiva()}</strong> para gerar as colunas do mapa.</p>
          <Link to="/tarefas" state={{ turmaIdSelecionada: turmaAtiva }} className="text-orange-600 font-bold hover:underline bg-white px-4 py-2 border border-orange-200 rounded-lg shadow-sm">Criar Primeira Entrega</Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-2">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-black text-gray-700 text-sm">Progresso da Turma</h3>
            <div className="flex gap-4 text-xs font-bold text-gray-500">
              <span className="flex items-center gap-1"><Check className="text-green-500" size={14}/> Entregue</span>
              <span className="flex items-center gap-1"><X className="text-red-400" size={14}/> Pendente</span>
            </div>
          </div>

          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 md:p-4 md:pl-6 border-b border-gray-200 text-[10px] md:text-xs uppercase font-black text-gray-400 tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Aluno
                  </th>
                  {tarefas.map(tarefa => (
                    <th key={tarefa.id} className="px-3 py-3 md:p-4 text-center border-b border-l border-gray-200 min-w-[100px] max-w-[150px]">
                      <div className="text-[9px] uppercase font-black text-orange-500 tracking-widest mb-1 truncate">Entrega</div>
                      <div className="font-bold text-gray-700 text-xs md:text-sm truncate" title={tarefa.nomeTarefa || tarefa.titulo}>
                        {tarefa.nomeTarefa || tarefa.titulo}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunos.map(aluno => (
                  <tr key={aluno.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-4 py-3 md:p-4 md:pl-6 font-bold text-gray-800 text-sm whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50/30 transition-colors z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {aluno.nome}
                    </td>
                    {tarefas.map(tarefa => {
                      const entregou = verificarEntrega(aluno.id, tarefa.id);
                      return (
                        <td key={tarefa.id} className="px-3 py-2 md:p-3 text-center border-l border-gray-100">
                          {entregou ? (
                            <div className="inline-flex bg-green-100 text-green-600 p-1 md:p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform cursor-default" title="Atividade Entregue">
                              <Check size={16} strokeWidth={3}/>
                            </div>
                          ) : (
                            <div className="inline-flex bg-red-50 text-red-300 p-1 md:p-1.5 rounded-full hover:scale-110 transition-transform cursor-default" title="Pendente">
                              <X size={16} strokeWidth={3}/>
                            </div>
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
