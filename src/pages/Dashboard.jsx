import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, ChevronRight, Calendar, Sparkles, Building2, School, UserPlus, FileText, AlertTriangle, User, PlayCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate(); 
  
  // LEITURA DE CRACHÁ (RBAC)
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const planoUsuario = userProfile?.plano || 'basico';
  const isTier1 = planoUsuario === 'basico';
  const isTier2 = planoUsuario === 'intermediario';
  const isTier3 = planoUsuario === 'premium';

  // VISIBILIDADE DAS CAIXAS
  const mostrarRevisao = true; // Todos veem a caixa de Revisão
  const mostrarFaltaPostar = isAdmin || isTier1 || isTier3; // Tier 2 (Patrícia) não precisa ver a caixa de postar
  const mostrarTermometroIA = isAdmin || isTier3;

  const [instituicoes, setInstituicoes] = useState([]);
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [tarefasEmAndamento, setTarefasEmAndamento] = useState([]);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });
  const [progressoTarefas, setProgressoTarefas] = useState({}); 
  
  const [loading, setLoading] = useState(true);
  const [temAlunos, setTemAlunos] = useState(true); 
  const [temTarefasGeral, setTemTarefasGeral] = useState(true);

  const [gestaoVista, setGestaoVista] = useState({ atual: null, anterior: null });

  useEffect(() => {
    async function fetchInst() {
      if (!currentUser) return;
      const instRef = collection(db, 'instituicoes');
      const q = isAdmin ? instRef : query(instRef, where('professorUid', '==', currentUser.uid));
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
      lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setInstituicoes(lista);
      if (lista.length > 0) {
        const escolaAindaExiste = escolaSelecionada && lista.find(i => i.id === escolaSelecionada.id);
        if (!escolaAindaExiste) setEscolaSelecionada(lista[0]);
      } else { setEscolaSelecionada(null); }
      setLoading(false);
    }
    fetchInst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin, setEscolaSelecionada]);

  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 }); 
      setMetricasIA({ total: 0, originais: 0, percentual: 0 });
      setTarefasEmAndamento([]);
      setProgressoTarefas({});
      setGestaoVista({ atual: null, anterior: null });
      
      try {
        const qTurmas = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapT = await getDocs(qTurmas);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);

          const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAlunos = await getDocs(qAlunos);
          const alunosVivos = snapAlunos.docs.filter(d => d.data().status !== 'lixeira');
          setTemAlunos(alunosVivos.length > 0);

          const alunosMap = {};
          alunosVivos.forEach(d => { alunosMap[d.id] = d.data().nome; });
          
          const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTarefas = await getDocs(qTarefas);
          const tarefasVivas = snapTarefas.docs.map(d => ({id: d.id, ...d.data()})).filter(t => t.status !== 'lixeira');
          setTemTarefasGeral(tarefasVivas.length > 0);

          const hoje = new Date();
          const hojeTime = hoje.getTime();

          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtiv = await getDocs(qAtiv);
          
          let p = 0, f = 0, ok = 0;
          let iaTotal = 0, iaOriginais = 0;
          let progressoLocal = {};
          
          const ativMap = {}; 

          snapAtiv.docs.forEach(doc => {
            const d = doc.data();
            if (tIds.includes(d.turmaId)) {
              // MATEMÁTICA PURA DAS CAIXAS
              const jaPostado = d.postado === true || d.enviado === true || d.status === 'finalizado' || d.status === 'postado';
              const jaAprovado = d.status === 'aprovado' || d.status === 'revisado';
              const temResposta = d.resposta && String(d.resposta).trim() !== '';

              if (jaPostado) {
                ok++; 
                progressoLocal[d.tarefaId] = true;
              } else if (jaAprovado) {
                f++;  
                progressoLocal[d.tarefaId] = true;
              } else if (temResposta) {
                p++;  
                progressoLocal[d.tarefaId] = true;
              }

              // TERMÔMETRO IA
              const fFinal = d.feedbackFinal ? String(d.feedbackFinal).trim() : '';
              const fSugerido = String(d.feedbackSugerido || d.feedbackIA || '').trim();
              if ((jaAprovado || jaPostado) && fSugerido !== '') {
                iaTotal++;
                if (fFinal === fSugerido) iaOriginais++;
              }

              // Salva o status do aluno para a Gestão à Vista
              ativMap[`${d.tarefaId}_${d.alunoId}`] = { jaPostado, jaAprovado, temResposta };
            }
          });

          setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0 });
          setProgressoTarefas(progressoLocal);

          // GESTÃO À VISTA (Matemática Blindada)
          const pendenciasPorTarefa = {};
          tarefasVivas.forEach(t => {
             if (!tIds.includes(t.turmaId)) return;
             pendenciasPorTarefa[t.id] = [];
             
             const alunosDaTurma = alunosVivos.filter(a => a.data().turmaId === t.turmaId);
             
             alunosDaTurma.forEach(alunoDoc => {
                const alunoId = alunoDoc.id;
                const nomeAluno = alunoDoc.data().nome;
                const ativDoAluno = ativMap[`${t.id}_${alunoId}`];
                
                if (!ativDoAluno) {
                    pendenciasPorTarefa[t.id].push(nomeAluno);
                } else {
                    const faltaAteTrazerResposta = !ativDoAluno.jaPostado && !ativDoAluno.jaAprovado && !ativDoAluno.temResposta;
                    if (faltaAteTrazerResposta) {
                        pendenciasPorTarefa[t.id].push(nomeAluno);
                    }
                }
             });
          });

          let tarefasEntregas = tarefasVivas.filter(t => tIds.includes(t.turmaId) && t.dataFim && t.tipo === 'entrega');
          tarefasEntregas = tarefasEntregas.map(t => {
            const endObj = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
            const startRaw = t.dataInicio || t.data_inicio || t.dataCriacao;
            const startObj = startRaw ? (startRaw.toDate ? startRaw.toDate() : new Date(startRaw)) : new Date();

            return { 
              ...t, 
              timeInicio: startObj.getTime(), 
              timeFim: endObj.getTime(),
              dataFimStr: endObj.toLocaleDateString('pt-BR')
            };
          });

          const atuais = tarefasEntregas.filter(t => t.timeInicio <= hojeTime && t.timeFim >= hojeTime);
          const futuras = tarefasEntregas.filter(t => t.timeInicio > hojeTime).sort((a, b) => a.timeInicio - b.timeInicio);
          const passadas = tarefasEntregas.filter(t => t.timeFim < hojeTime).sort((a, b) => b.timeFim - a.timeFim);

          const buildGroup = (rawGroup, type) => {
            if (!rawGroup || rawGroup.length === 0) return null;
            let label = 'Anterior';
            let theme = 'gray'; 
            let blockTitle = `Encerrado em ${rawGroup[0].dataFimStr} (Anterior)`;

            if (type === 'atual') {
              label = 'Atual';
              theme = 'orange';
              blockTitle = `Prazo até ${rawGroup[0].dataFimStr} (Atual)`;
            } else if (type === 'futuro') {
              label = 'Em breve';
              theme = 'blue';
              const startStr = new Date(rawGroup[0].timeInicio).toLocaleDateString('pt-BR');
              blockTitle = `Iniciará em ${startStr} (Em breve)`;
            }

            let totalPendencias = 0;
            const tarefasComAlunos = rawGroup.map(t => {
              const pendentes = pendenciasPorTarefa[t.id] || [];
              totalPendencias += pendentes.length;
              return { 
                ...t, 
                nomeExibicao: t.nomeTarefa || t.titulo,
                pendentes: pendentes.sort((a,b) => a.localeCompare(b)) 
              };
            });

            return { blockTitle, theme, totalPendencias, tarefas: tarefasComAlunos };
          };

          let blocoDestaque = null;
          let ativasParaBarraPreta = [];

          if (atuais.length > 0) {
            atuais.sort((a, b) => a.timeFim - b.timeFim);
            const dataFimAlvo = atuais[0].timeFim;
            const grupoAtual = atuais.filter(t => t.timeFim === dataFimAlvo);
            blocoDestaque = buildGroup(grupoAtual, 'atual');
            ativasParaBarraPreta = grupoAtual;
          } else if (futuras.length > 0) {
            const dataInicioAlvo = futuras[0].timeInicio;
            const grupoFuturo = futuras.filter(t => t.timeInicio === dataInicioAlvo);
            blocoDestaque = buildGroup(grupoFuturo, 'futuro');
            ativasParaBarraPreta = grupoFuturo;
          }

          let blocoAnterior = null;
          if (passadas.length > 0) {
            const dataPassadaAlvo = passadas[0].timeFim;
            blocoAnterior = buildGroup(passadas.filter(t => t.timeFim === dataPassadaAlvo), 'passado');
          }

          setGestaoVista({ atual: blocoDestaque, anterior: blocoAnterior });

          if (ativasParaBarraPreta.length > 0) {
            const t = ativasParaBarraPreta[0];
            const isFutura = t.timeInicio > hoje.getTime();
            const alvoTempo = isFutura ? t.timeInicio : t.timeFim;
            const diasRestantes = Math.ceil((alvoTempo - hoje.getTime()) / (1000 * 3600 * 24));

            setTarefasEmAndamento([{
              id: t.id,
              nomeTarefa: t.nomeTarefa || t.titulo,
              diasRestantes: diasRestantes,
              isFutura: isFutura
            }]);
          } else {
            setTarefasEmAndamento([]);
          }

        }
      } catch (e) { console.error("Erro ao carregar dados", e); }
    }
    fetchDados();
  }, [escolaSelecionada]);

  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  // --- LÓGICA DE EXIBIÇÃO DO GRID E DO CARD DE AÇÃO RÁPIDA ---
  const tarefaAtualValida = tarefasEmAndamento.length > 0 && !tarefasEmAndamento[0].isFutura ? tarefasEmAndamento[0] : null;
  
  // INTELIGÊNCIA DO BOTÃO TELETRANSPORTE
  let textoBotaoTeletransporte = "Iniciar correções";
  if (tarefaAtualValida && progressoTarefas[tarefaAtualValida.id]) {
    textoBotaoTeletransporte = "Continuar correções";
  }

  // Calculando quantas colunas o Kanban precisa ter para não quebrar o layout
  let numCards = 1; // Histórico sempre aparece
  if (tarefaAtualValida) numCards++;
  if (mostrarRevisao) numCards++;
  if (mostrarFaltaPostar) numCards++;

  let gridClass = "grid grid-cols-1 gap-5 mb-10 ";
  if (numCards === 4) gridClass += "md:grid-cols-2 lg:grid-cols-4";
  else if (numCards === 3) gridClass += "md:grid-cols-3";
  else if (numCards === 2) gridClass += "md:grid-cols-2 max-w-3xl";
  else gridClass += "max-w-md mx-auto";

  if (loading) return <div className="p-20 text-center font-bold">Carregando Estação...</div>;

  if (!escolaSelecionada) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-blue-600 text-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-600/30">
          <School size={48} />
        </div>
        <h1 className="text-4xl font-black text-gray-800 tracking-tight mb-4">Bem-vindo(a) ao seu novo painel!</h1>
        <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto font-medium">Para começarmos a organizar sua vida acadêmica, o primeiro passo é nos dizer onde você ensina.</p>
        <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-1 transition-all text-lg">
          Passo 1: Criar Instituição <ChevronRight size={20}/>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-200 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-gray-500">Instituição:</span>
            
            {/* SELETOR ATUALIZADO COM O GATILHO DE NAVEGAÇÃO */}
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer shadow-inner" 
              value={escolaSelecionada?.id || ''} 
              onChange={e => {
                if (e.target.value === 'nova_instituicao') {
                  // NOVO: Navega e envia a "ordem" para abrir o formulário
                  navigate('/turmas', { state: { abrirModalInstituicao: true } });
                } else {
                  setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value));
                }
              }}
            >
              <option value="" disabled>Selecione...</option>
              {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              <option disabled>──────────</option>
              <option value="nova_instituicao">+ Criar Nova Instituição</option>
            </select>

          </div>
        </div>
      </div>

      {minhasTurmas.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-8">
          <div className="bg-blue-50 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Building2 size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Excelente! A instituição foi criada.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Agora, precisamos criar a sua primeira sala de aula para começarmos a organizar as atividades.</p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
            Passo 2: Criar Turma <ChevronRight size={18}/>
          </Link>
        </div>
      ) : 

      !temAlunos ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-8">
          <div className="bg-orange-50 text-orange-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><UserPlus size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Turma criada! Mas e os alunos?</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Uma sala de aula não funciona sem eles. Vamos adicionar a lista de alunos para que eles possam receber as atividades.</p>
          <Link to="/alunos" className="inline-flex items-center gap-2 bg-orange-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 hover:-translate-y-0.5 transition-all">
            Passo 3: Cadastrar Alunos <ChevronRight size={18}/>
          </Link>
        </div>
      ) : 

      !temTarefasGeral ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-8">
          <div className="bg-purple-50 text-purple-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><FileText size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Tudo pronto! Vamos ao trabalho.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Sua turma já tem alunos cadastrados. Que tal lançar o seu primeiro desafio ou atividade para eles?</p>
          <Link to="/tarefas" className="inline-flex items-center gap-2 bg-purple-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg shadow-purple-600/20 hover:bg-purple-700 hover:-translate-y-0.5 transition-all">
            Passo 4: Criar Tarefa <ChevronRight size={18}/>
          </Link>
        </div>
      ) : (

        <>
          {/* BARRA PRETA DE PONTO DE SITUAÇÃO */}
          <div className="bg-[#1f2937] text-white rounded-2xl p-5 shadow-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
            <div className="flex gap-4 items-center w-full">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shrink-0 shadow-inner">
                <Calendar size={24} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-white mb-1.5 tracking-wide">Ponto de Situação do Curso</h2>
                <div className="space-y-1 text-sm font-medium text-slate-300">
                  {tarefasEmAndamento.length > 0 ? (
                    <p className="flex items-center gap-2 truncate">
                      <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${tarefasEmAndamento[0].isFutura ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      <span className="text-gray-400 shrink-0">Agenda:</span>
                      <strong className="text-white truncate" title={tarefasEmAndamento[0].nomeTarefa}>{tarefasEmAndamento[0].nomeTarefa}</strong>
                      <span className={`${tarefasEmAndamento[0].isFutura ? 'text-blue-400' : 'text-green-400'} text-xs font-bold shrink-0`}>
                        ({tarefasEmAndamento[0].isFutura ? `Inicia em ${tarefasEmAndamento[0].diasRestantes} dias` : `Faltam ${tarefasEmAndamento[0].diasRestantes} dias`})
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></span>
                      Nenhuma tarefa programada no cronograma.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Link to="/tarefas" className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md hover:bg-blue-700 transition-all shrink-0 whitespace-nowrap text-center">
              Ver Cronograma Completo
            </Link>
          </div>

          {/* TERMÔMETRO DA IA */}
          {mostrarTermometroIA && metricasIA.total > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-5 shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl shrink-0"><Sparkles size={24} className="text-purple-100" /></div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-wide">Termômetro da IA</h2>
                  <p className="text-purple-200 text-xs font-medium mt-0.5">Porcentagem de feedbacks aprovados sem NENHUMA alteração.</p>
                </div>
              </div>
              <div className="text-left md:text-right shrink-0">
                <span className="block text-4xl font-black text-white tracking-tighter">{metricasIA.percentual}%</span>
                <span className="text-purple-200 text-[10px] font-bold uppercase tracking-wider">{metricasIA.originais} de {metricasIA.total} originais</span>
              </div>
            </div>
          )}

          {/* KANBAN E ATALHOS */}
          <div className={gridClass}>
            
            {/* CARD DE TELETRANSPORTE (SÓ APARECE SE TIVER TAREFA ROLANDO HOJE) */}
            {tarefaAtualValida && (
              <div className="bg-white border border-indigo-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-full -z-0"></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                  <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-1">Tarefa Atual</h3>
                  <div className="text-indigo-500 bg-indigo-50 p-1.5 rounded-lg"><PlayCircle size={20}/></div>
                </div>
                <span className="text-2xl font-black text-gray-800 relative z-10 leading-tight line-clamp-2" title={tarefaAtualValida.nomeTarefa}>
                  {tarefaAtualValida.nomeTarefa}
                </span>
                <Link to={`/revisar/${tarefaAtualValida.id}`} className="mt-4 text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline w-fit relative z-10">
                  {textoBotaoTeletransporte} <ChevronRight size={14}/>
                </Link>
              </div>
            )}

            {/* KANBAN TRADICIONAL */}
            {mostrarRevisao && (
              <div className="bg-white border border-yellow-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[11px] font-black text-yellow-600 uppercase tracking-widest mt-1">Aguardando Revisão</h3>
                  <div className="text-yellow-500 bg-yellow-50 p-1.5 rounded-lg"><Clock size={20}/></div>
                </div>
                <span className="text-4xl font-black text-gray-800">{kanban.pendentes}</span>
                <Link to="/aguardandorevisao" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver lista <ChevronRight size={14}/></Link>
              </div>
            )}
             
            {mostrarFaltaPostar && (
              <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">Aguardando Postar</h3>
                  <div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg"><Send size={20}/></div>
                </div>
                <span className="text-4xl font-black text-gray-800">{kanban.faltaLancar}</span>
                <Link to="/faltapostar" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Copiar p/ Site <ChevronRight size={14}/></Link>
              </div>
            )}
            
            <div className="bg-white border border-green-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-black text-green-600 uppercase tracking-widest mt-1">Histórico Finalizado</h3>
                <div className="text-green-500 bg-green-50 p-1.5 rounded-lg"><CheckCheck size={20}/></div>
              </div>
              <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
              <Link to="/historico" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver histórico <ChevronRight size={14}/></Link>
            </div>
          </div>

          {/* =========================================================================
                 MOTOR DE GESTÃO À VISTA POR DATA ESTRITA (Sem Adivinhar Texto)
              ========================================================================= */}
          {(gestaoVista.atual || gestaoVista.anterior) && (
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={24}/> Gestão à Vista: Foco Atual
              </h2>
              
              <div className="space-y-6">
                
                {/* BLOCO ATUAL OU FUTURO */}
                {gestaoVista.atual && (
                  <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${gestaoVista.atual.theme === 'blue' ? 'border-blue-200' : 'border-orange-200'}`}>
                    <div className={`p-4 flex justify-between items-center border-b ${gestaoVista.atual.theme === 'blue' ? 'bg-blue-50/50 border-blue-100' : 'bg-orange-50/50 border-orange-100'}`}>
                      <h3 className={`font-black text-lg truncate pr-4 ${gestaoVista.atual.theme === 'blue' ? 'text-blue-900' : 'text-orange-900'}`}>{gestaoVista.atual.blockTitle}</h3>
                      <span className={`text-xs font-black px-3 py-1 rounded-full whitespace-nowrap shrink-0 ${gestaoVista.atual.theme === 'blue' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{gestaoVista.atual.totalPendencias} pendências</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {gestaoVista.atual.tarefas.map(t => (
                        <div key={t.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                          <h4 className="text-sm font-bold text-gray-700 mb-2">{t.nomeExibicao}</h4>
                          {t.pendentes.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {t.pendentes.map((nome, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-600 shadow-sm hover:border-orange-300 transition-colors cursor-default">
                                  <User size={12} className="text-gray-400"/> {nome}
                               </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCheck size={14}/> 100% Entregue!</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BLOCO ANTERIOR */}
                {gestaoVista.anterior && (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                      <h3 className="font-black text-gray-700 text-lg truncate pr-4" title={gestaoVista.anterior.blockTitle}>{gestaoVista.anterior.blockTitle}</h3>
                      <span className="bg-gray-200 text-gray-700 text-xs font-black px-3 py-1 rounded-full whitespace-nowrap shrink-0">{gestaoVista.anterior.totalPendencias} pendências</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {gestaoVista.anterior.tarefas.map(t => (
                        <div key={t.id} className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                          <h4 className="text-sm font-bold text-gray-600 mb-2">{t.nomeExibicao}</h4>
                          {t.pendentes.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {t.pendentes.map((nome, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-500 shadow-sm hover:border-gray-300 transition-colors cursor-default">
                                  <User size={12} className="text-gray-400"/> {nome}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-green-600 flex items-center gap-1"><CheckCheck size={14}/> 100% Entregue!</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
