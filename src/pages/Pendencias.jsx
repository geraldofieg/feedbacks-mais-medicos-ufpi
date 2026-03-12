import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, User, Calendar, CalendarClock, BookOpen, GraduationCap, MessageCircle, Clock } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Pendencias() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); 
  
  const [turmas, setTurmas] = useState([]);
  
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });
  
  const [pendencias, setPendencias] = useState([]);
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erro, setErro] = useState(null);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state, turmaAtiva]);

  useEffect(() => {
    if (turmaAtiva) localStorage.setItem('ultimaTurmaAtiva', turmaAtiva);
  }, [turmaAtiva]);

  useEffect(() => {
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
    fetchTurmas(); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, escolaSelecionada, isAdmin]); 

  // ====================================================================================
  // MOTOR DE CÁLCULO DE PRAZOS
  // ====================================================================================
  const getStatusPrazo = (t) => {
    if (!t.dataFim) return { temPrazo: false, timestampFim: 0, timeInicio: 0 };
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeTime = hoje.getTime();

    const fimObj = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
    const startRaw = t.dataInicio || t.data_inicio || t.dataCriacao;
    const inicioObj = startRaw ? (startRaw.toDate ? startRaw.toDate() : new Date(startRaw)) : new Date();

    const dFimNormal = new Date(fimObj); dFimNormal.setHours(0, 0, 0, 0);
    const dInicioNormal = new Date(inicioObj); dInicioNormal.setHours(0, 0, 0, 0);

    const timeFim = dFimNormal.getTime();
    const timeInicio = dInicioNormal.getTime();

    const dias = Math.ceil((timeFim - hojeTime) / (1000 * 3600 * 24));
    
    // Define a Categoria Temporal da Tarefa
    let categoria = 'futura';
    if (timeFim < hojeTime) categoria = 'vencida';
    else if (timeInicio <= hojeTime && timeFim >= hojeTime) categoria = 'atual';

    return { 
      temPrazo: true, 
      dataFormatada: dFimNormal.toLocaleDateString('pt-BR'), 
      diasRestantes: dias, 
      vencido: dias < 0,
      timestampFim: timeFim,
      timeInicio: timeInicio,
      categoria: categoria
    };
  };

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
        
        let tarefasData = snapTarefas.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.status !== 'lixeira' && (t.tipo === 'entrega' || !t.tipo));

        // Aplica o Motor de Status Temporal em cada Tarefa
        tarefasData = tarefasData.map(t => ({ ...t, statusTemp: getStatusPrazo(t) }));

        // ORDENAÇÃO INTELIGENTE (V1-STYLE):
        // 1º Vencidas Mais Recentes (As últimas que passaram)
        // 2º Atuais (Em andamento)
        // 3º Futuras
        // 4º Sem Prazo
        const tarefasOrdenadas = tarefasData.sort((a, b) => {
          const sA = a.statusTemp;
          const sB = b.statusTemp;

          if (!sA.temPrazo && sB.temPrazo) return 1;
          if (sA.temPrazo && !sB.temPrazo) return -1;
          if (!sA.temPrazo && !sB.temPrazo) {
            const cA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
            const cB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
            return cB - cA; // Mais nova criada no topo (se não tiver data)
          }

          // Hierarquia: Vencidas (Descrescente) -> Atuais (Crescente) -> Futuras (Crescente)
          const rank = { vencida: 1, atual: 2, futura: 3 };
          if (rank[sA.categoria] !== rank[sB.categoria]) {
            return rank[sA.categoria] - rank[sB.categoria];
          }

          // Desempate dentro da mesma categoria
          if (sA.categoria === 'vencida') return sB.timestampFim - sA.timestampFim; // A vencida há menos tempo (ontem) no topo
          if (sA.categoria === 'atual') return sA.timestampFim - sB.timestampFim; // A atual que vence mais rápido no topo
          if (sA.categoria === 'futura') return sA.timeInicio - sB.timeInicio; // A próxima que vai começar no topo
          
          return 0;
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
              devedores: devedores,
              status: tarefa.statusTemp
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

  const isCarregando = loadingTurmas || loadingDados;
  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';

  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Pendências' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Para gerenciar pendências, selecione uma instituição.</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-xl hover:bg-blue-700 shadow-lg">Ir para o Centro de Comando</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Pendências (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3 tracking-tight">
            <div className="bg-red-100 text-red-600 p-2.5 rounded-xl shadow-sm"><AlertTriangle size={26} /></div>
            Relatório de Pendências
          </h1>
          {!isCarregando && turmas.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 min-w-[240px]">
              <GraduationCap size={20} className="text-gray-400 ml-2" />
              <select className="w-full py-3.5 bg-transparent outline-none text-sm font-bold text-gray-700 cursor-pointer" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg font-medium">{erro}</div>
      )}

      {isCarregando ? (
        <div className="p-20 text-center animate-pulse flex flex-col items-center gap-3">
          <AlertTriangle className="text-red-300" size={48} />
          <p className="font-bold text-red-400 text-lg">Filtrando entregas de alunos...</p>
        </div>
      ) : pendencias.length === 0 ? (
        <div className="bg-green-50 p-16 rounded-3xl text-center border border-green-200 shadow-sm mt-8">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-black text-green-700 mb-2">Turma em Dia!</h2>
          <p className="text-green-600 font-bold text-lg">Nenhum aluno deve tarefas de entrega no momento.</p>
        </div>
      ) : (
        <div className="space-y-6 mt-8">
          {pendencias.map((item, idx) => {
            const status = item.status;
            
            // INTELIGÊNCIA VISUAL DE CORES BASEADA NO STATUS TEMPORAL
            let theme = {
              cardBorder: 'border-gray-200',
              headerBg: 'bg-gray-50',
              headerBorder: 'border-gray-200',
              iconColor: 'text-gray-500',
              titleColor: 'text-gray-800',
              badgeBg: 'bg-gray-100 border-gray-200 text-gray-500'
            };

            if (status.categoria === 'vencida') {
              theme = {
                cardBorder: 'border-red-200',
                headerBg: 'bg-red-50/80',
                headerBorder: 'border-red-100',
                iconColor: 'text-red-500',
                titleColor: 'text-red-900',
                badgeBg: 'bg-red-100 border-red-200 text-red-800'
              };
            } else if (status.categoria === 'atual') {
              theme = {
                cardBorder: 'border-orange-200 shadow-md shadow-orange-500/10',
                headerBg: 'bg-orange-50/80',
                headerBorder: 'border-orange-100',
                iconColor: 'text-orange-500',
                titleColor: 'text-orange-900',
                badgeBg: 'bg-orange-100 border-orange-200 text-orange-800'
              };
            }

            return (
              <div key={idx} className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${theme.cardBorder}`}>
                <div className={`${theme.headerBg} p-4 border-b ${theme.headerBorder} flex flex-col md:flex-row md:items-center justify-between gap-3`}>
                  <div className="flex items-center gap-3">
                    <Calendar className={`${theme.iconColor} shrink-0`} size={24} />
                    <div>
                      <h3 className={`font-black leading-tight text-lg ${theme.titleColor}`}>
                        {item.tarefa.nomeTarefa || item.tarefa.titulo}
                        {status.categoria === 'atual' && <span className="ml-2 text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase align-middle">Em Andamento</span>}
                      </h3>
                      <p className={`text-xs font-bold uppercase tracking-widest mt-0.5 ${theme.iconColor}`}>{item.devedores.length} devedores identificados</p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {status.temPrazo ? (
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border ${theme.badgeBg}`}>
                        {status.categoria === 'vencida' ? <AlertTriangle size={14} /> : <Clock size={14}/>} 
                        {status.categoria === 'vencida' ? `Vencido em ${status.dataFormatada}` : 
                         status.categoria === 'atual' ? `Vence em ${status.diasRestantes} dias` : 
                         `Iniciará em breve`}
                      </div>
                    ) : ( 
                      <div className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 bg-gray-100 text-gray-500 border border-gray-200"> 
                        <CalendarClock size={14} /> Sem prazo definido 
                      </div> 
                    )}
                  </div>
                </div>
                <div className="p-5 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {item.devedores.map(aluno => (
                      <div key={aluno.id} onClick={() => navigate('/comunicacao', { state: { turmaIdSelecionada: turmaAtiva, alunoAlvo: aluno.nome } })} className="flex items-center justify-between gap-2 text-sm font-bold text-gray-700 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 p-3 rounded-xl border border-gray-100 transition-colors group cursor-pointer shadow-sm">
                        <div className="flex items-center gap-2 truncate"> 
                          <User size={16} className="text-gray-400 group-hover:text-blue-500 shrink-0"/> 
                          <span className="truncate">{aluno.nome}</span> 
                        </div>
                        <div className="bg-white p-2 md:p-1.5 rounded-md border border-blue-200 text-blue-600 shadow-sm flex items-center gap-1"> 
                          <MessageCircle size={14}/> <span className="text-[10px] uppercase font-black tracking-widest md:hidden">Cobrar</span> 
                        </div>
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
