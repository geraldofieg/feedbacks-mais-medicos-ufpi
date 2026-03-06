import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, User, Calendar, CalendarClock, ArrowRight, BookOpen, RefreshCw, GraduationCap, MessageCircle } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Pendencias() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState(location.state?.turmaIdSelecionada || '');
  
  const [pendencias, setPendencias] = useState([]);
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erro, setErro] = useState(null);

  // 1. Busca as Turmas
  async function fetchTurmas() {
    if (!currentUser || !escolaSelecionada?.id) {
      setLoadingTurmas(false);
      return; 
    }
    setErro(null);
    setLoadingTurmas(true);
    try {
      const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
      const snapT = await getDocs(qT);
      const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
      setTurmas(turmasData);
      
      if (turmasData.length > 0 && !turmaAtiva) {
        setTurmaAtiva(turmasData[0].id);
      }
    } catch (error) {
      setErro("Falha de conexão com o banco de dados.");
    } finally {
      setLoadingTurmas(false);
    }
  }

  useEffect(() => { fetchTurmas(); }, [currentUser, escolaSelecionada]);

  // 2. Constrói o Relatório de Pendências (Focado na Tarefa, como na V1)
  useEffect(() => {
    async function fetchPendencias() {
      if (!turmaAtiva) {
        setPendencias([]);
        return;
      }
      setLoadingDados(true);
      try {
        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapAlunos = await getDocs(qAlunos);
        const alunosData = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome));

        if (alunosData.length === 0) {
          setPendencias([]);
          setLoadingDados(false);
          return;
        }

        const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapTarefas = await getDocs(qTarefas);
        const tarefasData = snapTarefas.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');

        // Ordenação Original da V1: Mais recentes (ou com prazo mais longe) no topo
        const tarefasOrdenadas = tarefasData.sort((a, b) => {
          const timeA = a.dataFim?.toMillis() || (a.dataCriacao?.toMillis() || 0);
          const timeB = b.dataFim?.toMillis() || (b.dataCriacao?.toMillis() || 0);
          return timeB - timeA; 
        });

        const qAtividades = query(collection(db, 'atividades'), where('turmaId', '==', turmaAtiva));
        const snapAtividades = await getDocs(qAtividades);
        const atividadesData = snapAtividades.docs.map(d => d.data());

        const resultado = [];
        
        tarefasOrdenadas.forEach(tarefa => {
          const entregasDaTarefa = new Set(atividadesData.filter(a => a.tarefaId === tarefa.id).map(a => a.alunoId));
          const devedores = alunosData.filter(aluno => !entregasDaTarefa.has(aluno.id));
          
          if (devedores.length > 0) {
            resultado.push({ 
              tarefa: tarefa, 
              devedores: devedores 
            });
          }
        });

        setPendencias(resultado);
      } catch (error) {
        console.error("Erro ao buscar pendências:", error);
      } finally {
        setLoadingDados(false);
      }
    }

    fetchPendencias();
  }, [turmaAtiva]); 

  // Função original da V1 mantida para calcular o selo do prazo
  const getStatusPrazo = (timestampFim) => {
    if (!timestampFim || !timestampFim.toDate) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataFim = timestampFim.toDate();
    
    const dataFimDia = new Date(dataFim);
    dataFimDia.setHours(0, 0, 0, 0);
    
    const diferencaTime = dataFimDia.getTime() - hoje.getTime();
    const dias = Math.ceil(diferencaTime / (1000 * 3600 * 24));
    
    return {
      dataFormatada: dataFim.toLocaleDateString('pt-BR'),
      diasRestantes: dias,
      vencido: dias < 0
    };
  };

  const isCarregando = loadingTurmas || loadingDados;
  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';

  // UX Defesa 1: Sem Instituição
  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Pendências' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Para gerenciar pendências, o sistema precisa saber em qual instituição você quer trabalhar.</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-xl hover:bg-blue-700 transition-all shadow-lg">Ir para o Centro de Comando</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Pendências (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-xl font-black text-red-600 flex items-center gap-2 tracking-tight">
            <AlertTriangle className="text-red-500" size={24} /> Relatório de Pendências
          </h1>

          {!isCarregando && turmas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:block">Filtro:</span>
              <select 
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl focus:ring-2 focus:ring-red-500 py-2 px-3 font-bold shadow-sm cursor-pointer w-full sm:w-auto"
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
          <AlertTriangle className="text-red-300" size={48} />
          <p className="font-bold text-red-400">Cruzando dados e calculando prazos...</p>
        </div>
      ) : erro ? (
        <div className="bg-red-50 border-2 border-dashed border-red-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10">
          <p className="text-red-600 font-bold mb-4">{erro}</p>
          <button onClick={fetchTurmas} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center gap-2 mx-auto hover:bg-red-700"><RefreshCw size={18} /> Tentar Novamente</button>
        </div>
      ) : turmas.length === 0 ? (
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10">
          <BookOpen className="mx-auto text-blue-400 mb-4" size={48} />
          <h2 className="text-xl font-black text-blue-800 mb-2">Sem turmas ativas</h2>
          <p className="text-blue-600 mb-6 font-medium">Você precisa criar uma turma antes de buscar pendências.</p>
          <Link to="/turmas" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-md">Criar Turma</Link>
        </div>
      ) : pendencias.length === 0 ? (
        <div className="bg-green-50 p-12 rounded-3xl text-center border-2 border-dashed border-green-200 shadow-sm mt-10">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-green-700 mb-2">Turma em Dia!</h2>
          <p className="text-green-600 font-bold">Uau! Nenhuma pendência nas tarefas da turma {getNomeTurmaAtiva()}.</p>
        </div>
      ) : (
        <div className="space-y-6 mt-4">
          {pendencias.map((item, idx) => {
            const status = getStatusPrazo(item.tarefa.dataFim);

            return (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-red-50/50 p-4 border-b border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-red-500 shrink-0" size={24} />
                    <div>
                      <h3 className="font-black text-red-900 leading-tight text-lg">{item.tarefa.nomeTarefa || item.tarefa.titulo}</h3>
                      <p className="text-xs font-bold text-red-500 uppercase tracking-widest mt-0.5">{item.devedores.length} devedores identificados</p>
                    </div>
                  </div>
                  
                  {/* SELO DE PRAZO INTELIGENTE (Preservado da V1) */}
                  <div className="shrink-0 flex items-center gap-3">
                    {status ? (
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${status.vencido ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                        <CalendarClock size={14} /> 
                        {status.vencido ? `Vencido em ${status.dataFormatada}` : `Vence em ${status.dataFormatada}`}
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-gray-100 text-gray-500 border border-gray-200">
                        <CalendarClock size={14} /> Sem prazo definido
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-5 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {item.devedores.map(aluno => (
                      <div key={aluno.id} className="flex items-center justify-between gap-2 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 p-3 rounded-xl border border-gray-100 transition-colors group">
                        <div className="flex items-center gap-2 truncate">
                          <User size={16} className="text-gray-400 group-hover:text-blue-500 shrink-0"/> 
                          <span className="truncate">{aluno.nome}</span>
                        </div>
                        
                        {/* PONTE DE INTEGRAÇÃO COM COMUNICAÇÃO */}
                        <Link 
                          to="/comunicacao" 
                          state={{ turmaIdSelecionada: turmaAtiva, alunoAlvo: aluno.nome }}
                          className="bg-white p-1.5 rounded-md border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 shadow-sm transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          title="Cobrar Aluno"
                        >
                          <MessageCircle size={14}/>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
                }
