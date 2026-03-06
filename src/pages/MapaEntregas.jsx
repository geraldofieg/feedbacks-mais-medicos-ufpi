import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Check, X, BookOpen, Users, FileText } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function MapaEntregas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState(location.state?.turmaIdSelecionada || '');
  
  // A Matriz de Dados
  const [alunos, setAlunos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);

  // 1. Busca as Turmas da Instituição
  useEffect(() => {
    async function fetchTurmas() {
      // CORREÇÃO DEFINITIVA: Se não tiver a chave, ele desliga o carregamento na hora e não trava!
      if (!currentUser || !escolaSelecionada?.id) {
        setLoadingTurmas(false);
        return; 
      }
      
      setLoadingTurmas(true);
      try {
        const qT = query(collection(db, 'turmas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        
        if (turmasData.length > 0 && !turmaAtiva) {
          setTurmaAtiva(turmasData[0].id);
        }
      } catch (error) {
        console.error("Erro ao buscar turmas:", error);
      } finally {
        setLoadingTurmas(false);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  // 2. Constrói a Matriz da Turma Ativa
  useEffect(() => {
    async function fetchMatriz() {
      if (!turmaAtiva) {
        setAlunos([]);
        setTarefas([]);
        setAtividades([]);
        return;
      }
      
      setLoadingMatriz(true);
      try {
        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapAlunos = await getDocs(qAlunos);
        const alunosData = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.status !== 'lixeira')
          .sort((a, b) => a.nome.localeCompare(b.nome)); 
        setAlunos(alunosData);

        const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapTarefas = await getDocs(qTarefas);
        const tarefasData = snapTarefas.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.status !== 'lixeira')
          .sort((a, b) => a.dataCriacao?.toMillis() - b.dataCriacao?.toMillis()); 
        setTarefas(tarefasData);

        const qAtividades = query(collection(db, 'atividades'), where('turmaId', '==', turmaAtiva));
        const snapAtividades = await getDocs(qAtividades);
        const atividadesData = snapAtividades.docs.map(d => ({ id: d.id, ...d.data() }));
        setAtividades(atividadesData);

      } catch (error) {
        console.error("Erro ao montar o mapa:", error);
      } finally {
        setLoadingMatriz(false);
      }
    }
    fetchMatriz();
  }, [turmaAtiva]);

  const verificarEntrega = (alunoId, tarefaId) => {
    return atividades.some(ativ => ativ.alunoId === alunoId && ativ.tarefaId === tarefaId);
  };

  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';
  
  const isCarregando = loadingTurmas || loadingMatriz;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Mapa de Entregas` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 tracking-tight">
            <ClipboardList className="text-blue-600" size={22} /> Visão Panorâmica
          </h1>

          {!isCarregando && turmas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:block">Turma:</span>
              <select 
                className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 py-2 px-3 font-bold shadow-sm cursor-pointer w-full sm:w-auto"
                value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}
              >
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {isCarregando ? (
        <div className="p-20 text-center animate-pulse flex flex-col items-center gap-3">
          <ClipboardList className="text-blue-300" size={48} />
          <p className="font-bold text-blue-400">Sincronizando dados...</p>
        </div>
      ) : turmas.length === 0 ? (
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10">
          <BookOpen className="mx-auto text-blue-400 mb-4" size={48} />
          <h2 className="text-xl font-black text-blue-800 mb-2">Sem turmas ativas</h2>
          <p className="text-blue-600 mb-6 font-medium">Você precisa criar uma turma antes de visualizar o mapa.</p>
          <Link to="/turmas" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-md">
            Ir para Turmas
          </Link>
        </div>
      ) : alunos.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-10 rounded-3xl text-center mt-6">
          <Users className="mx-auto text-gray-300 mb-3" size={40} />
          <h2 className="text-lg font-black text-gray-700 mb-1">Turma Vazia</h2>
          <p className="text-gray-500 text-sm mb-5">Adicione alunos à turma <strong>{getNomeTurmaAtiva()}</strong> para ver o mapa.</p>
          <Link to="/alunos" className="text-blue-600 font-bold hover:underline bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm">
            Adicionar Alunos
          </Link>
        </div>
      ) : tarefas.length === 0 ? (
        <div className="bg-orange-50 border border-orange-100 p-10 rounded-3xl text-center mt-6">
          <FileText className="mx-auto text-orange-300 mb-3" size={40} />
          <h2 className="text-lg font-black text-orange-800 mb-1">Nenhuma Tarefa Criada</h2>
          <p className="text-orange-600 text-sm mb-5">Crie tarefas para a turma <strong>{getNomeTurmaAtiva()}</strong> para gerar as colunas do mapa.</p>
          <Link to="/tarefas" state={{ turmaIdSelecionada: turmaAtiva }} className="text-orange-600 font-bold hover:underline bg-white px-4 py-2 border border-orange-200 rounded-lg shadow-sm">
            Criar Primeira Tarefa
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-2">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="font-black text-gray-700">Progresso da Turma</h3>
            <div className="flex gap-4 text-xs font-bold text-gray-500">
              <span className="flex items-center gap-1"><Check className="text-green-500" size={14}/> Entregue</span>
              <span className="flex items-center gap-1"><X className="text-red-400" size={14}/> Pendente</span>
            </div>
          </div>

          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 pl-6 border-b border-gray-200 text-xs uppercase font-black text-gray-400 tracking-wider sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Aluno
                  </th>
                  {tarefas.map(tarefa => (
                    <th key={tarefa.id} className="p-4 text-center border-b border-l border-gray-200">
                      <div className="text-[10px] uppercase font-black text-orange-500 tracking-widest mb-1">Tarefa</div>
                      <div className="font-bold text-gray-700 text-sm line-clamp-2 leading-tight" title={tarefa.nomeTarefa || tarefa.titulo}>
                        {tarefa.nomeTarefa || tarefa.titulo}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunos.map(aluno => (
                  <tr key={aluno.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-4 pl-6 font-bold text-gray-800 whitespace-nowrap sticky left-0 bg-white group-hover:bg-blue-50/30 transition-colors z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {aluno.nome}
                    </td>
                    {tarefas.map(tarefa => {
                      const entregou = verificarEntrega(aluno.id, tarefa.id);
                      return (
                        <td key={tarefa.id} className="p-3 text-center border-l border-gray-100">
                          {entregou ? (
                            <div className="inline-flex bg-green-100 text-green-600 p-1.5 rounded-full shadow-sm hover:scale-110 transition-transform cursor-default" title="Atividade Entregue">
                              <Check size={18} strokeWidth={3}/>
                            </div>
                          ) : (
                            <div className="inline-flex bg-red-50 text-red-300 p-1.5 rounded-full hover:scale-110 transition-transform cursor-default" title="Pendente">
                              <X size={18} strokeWidth={3}/>
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
