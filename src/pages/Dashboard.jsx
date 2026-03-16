import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, ChevronRight, Calendar, Sparkles, Building2, School, UserPlus, FileText, AlertTriangle, User, PlayCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate(); 
  
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const planoUsuario = userProfile?.plano || 'basico';
  const isTier1 = planoUsuario === 'basico';
  const isTier2 = planoUsuario === 'intermediario';
  const isTier3 = planoUsuario === 'premium';

  const mostrarRevisao = true; 
  const mostrarFaltaPostar = isAdmin || isTier1 || isTier3; 
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
          
          const limiteInferior = new Date(2026, 0, 5).getTime(); // 05/Jan/2026

          const docRefUser = doc(db, 'usuarios', currentUser.uid);
          const docSnapUser = await getDoc(docRefUser);
          const dataUser = docSnapUser.data();
          const timestampPrompt = dataUser?.timestampPrompt || 0;

          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtiv = await getDocs(qAtiv);
          
          let p = 0, f = 0, ok = 0;
          let iaTotal = 0, iaOriginais = 0;
          let progressoLocal = {};
          
          const mapaDocsValidos = {};

          snapAtiv.docs.forEach(doc => {
            const ativ = doc.data();
            if (!tIds.includes(ativ.turmaId)) return;
            
            const nomeOriginalTarefa = ativ.nomeTarefa || ativ.tarefa || ativ.modulo || 'Tarefa';
            const nomeLimpoAtividade = nomeOriginalTarefa.toLowerCase().replace(/[\s-]/g, '');
            const chaveUnica = `${nomeLimpoAtividade}_${ativ.alunoId}`;
            
            const timeAtual = ativ.dataModificacao?.toMillis() || ativ.dataAprovacao?.toMillis() || ativ.dataCriacao?.toMillis() || 0;

            if (!mapaDocsValidos[chaveUnica] || timeAtual > mapaDocsValidos[chaveUnica].time) {
              mapaDocsValidos[chaveUnica] = { ativ: ativ, time: timeAtual };
            }
          });

          const ativMap = {};
          Object.values(mapaDocsValidos).forEach(item => {
            const d = item.ativ;
            
            const jaPostado = d.postado === true || d.enviado === true || d.status === 'finalizado' || d.status === 'postado';
            const jaAprovado = d.status === 'aprovado' || d.status === 'revisado';
            const temResposta = (d.resposta && String(d.resposta).trim() !== '') || !!d.arquivoUrl;

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

            const dataAvaliacao = d.dataAprovacao || d.dataPostagem || d.dataModificacao || d.dataCriacao;
            const timeAvaliacao = dataAvaliacao ? (dataAvaliacao.toDate ? dataAvaliacao.toDate().getTime() : new Date(dataAvaliacao).getTime()) : 0;
            const ehDessaTemporada = timestampPrompt > 0 ? (timeAvaliacao >= timestampPrompt) : true;

            const fFinal = d.feedbackFinal ? String(d.feedbackFinal).trim() : '';
            const fSugerido = String(d.feedbackSugerido || d.feedbackIA || '').trim();
            
            if ((jaAprovado || jaPostado) && fSugerido !== '' && ehDessaTemporada) {
              iaTotal++;
              if (fFinal === fSugerido) iaOriginais++;
            }

            ativMap[`${d.tarefaId}_${d.alunoId}`] = { jaPostado, jaAprovado, temResposta };
          });

          setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0 });
          setProgressoTarefas(progressoLocal);

          const pendenciasPorTarefa = {};
          tarefasVivas.forEach(t => {
             if (!tIds.includes(t.turmaId)) return;
             pendenciasPorTarefa[t.id] = [];
             
             const alunosDaTurma = alunosVivos.filter(a => a.data().turmaId === t.turmaId);
             
             alunosDaTurma.forEach(alunoDoc => {
                const alunoId = alunoDoc.id;
                
                const tarefaRestrita = t.alunosSelecionados && t.alunosSelecionados.length > 0;
                if (tarefaRestrita && !t.alunosSelecionados.includes(alunoId)) {
                    return; 
                }

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

          let tarefasEntregas = tarefasVivas.filter(t => {
             if (!tIds.includes(t.turmaId)) return false;
             if (!t.dataFim) return false;
             if (t.tipo && t.tipo !== 'entrega' && t.tipo !== 'forum') return false; 
             return true;
          });

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
          }).filter(t => {
             return t.timeInicio >= limiteInferior && t.timeInicio <= hojeTime;
          });

          const atuais = tarefasEntregas.filter(t => t.timeInicio <= hojeTime && t.timeFim >= hojeTime);
          const passadas = tarefasEntregas.filter(t => t.timeFim < hojeTime).sort((a, b) => b.timeFim - a.timeFim);

          const buildGroup = (rawGroup, type) => {
            if (!rawGroup || rawGroup.length === 0) return null;
            let theme = 'gray'; 
            let blockTitle = `Encerradas Recentemente (Anteriores)`;

            if (type === 'atual') {
              theme = 'orange';
              blockTitle = `Tarefas Vigentes (Atuais)`; 
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
          if (atuais.length > 0) {
            atuais.sort((a, b) => a.timeFim - b.timeFim);
            blocoDestaque = buildGroup(atuais, 'atual');
          } 

          let blocoAnterior = null;
          if (passadas.length > 0) {
            const dataPassadaAlvo = passadas[0].timeFim;
            blocoAnterior = buildGroup(passadas.filter(t => t.timeFim === dataPassadaAlvo), 'passado');
          }

          setGestaoVista({ atual: blocoDestaque, anterior: blocoAnterior });

          const agendaCompleta = [...atuais, ...tarefasEntregas.filter(t => t.timeInicio > hojeTime)].map(t => {
            const referenceTime = t.timeInicio > hojeTime ? t.timeInicio : t.timeFim;
            const diasRestantes = Math.ceil((referenceTime - hojeTime) / (1000 * 3600 * 24));
            return {
              id: t.id,
              nomeTarefa: t.nomeTarefa || t.titulo,
              diasRestantes: diasRestantes,
              isFutura: t.timeInicio > hojeTime
            };
          });

          agendaCompleta.sort((a, b) => (a.isFutura === b.isFutura) ? (a.diasRestantes - b.diasRestantes) : (a.isFutura ? 1 : -1));
          setTarefasEmAndamento(agendaCompleta);

        }
      } catch (e) { console.error("Erro ao carregar dados", e); }
    }
    fetchDados();
  }, [escolaSelecionada]);

  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  let passoAtual = 5; 
  if (!escolaSelecionada) passoAtual = 1;
  else if (minhasTurmas.length === 0) passoAtual = 2;
  else if (!temAlunos) passoAtual = 3;
  else if (!temTarefasGeral) passoAtual = 4;

  const renderBarraProgresso = () => {
    const passos = [
      { id: 1, titulo: 'Instituição', icone: <School size={18} /> },
      { id: 2, titulo: 'Turma', icone: <Building2 size={18} /> },
      { id: 3, titulo: 'Alunos', icone: <UserPlus size={18} /> },
      { id: 4, titulo: 'Tarefas', icone: <FileText size={18} /> }
    ];

    const porcentagem = ((passoAtual - 1) / 3) * 100;

    return (
      <div className="max-w-3xl mx-auto mb-10 w-full px-4 pt-6">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full z-0"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-blue-600 rounded-full z-0 transition-all duration-700 ease-out" 
            style={{ width: `${porcentagem}%` }}
          ></div>
          {passos.map(passo => {
            const concluido = passo.id < passoAtual;
            const ativo = passo.id === passoAtual;
            
            let bgCircle = "bg-white";
            let borderCircle = "border-gray-200";
            let textIcon = "text-gray-400";
            let textLabel = "text-gray-400 font-medium";

            if (concluido) {
              bgCircle = "bg-green-500";
              borderCircle = "border-green-500";
              textIcon = "text-white";
              textLabel = "text-green-600 font-bold";
            } else if (ativo) {
              bgCircle = "bg-blue-600 shadow-lg shadow-blue-600/30";
              borderCircle = "border-blue-600";
              textIcon = "text-white";
              textLabel = "text-blue-700 font-black";
            }

            return (
              <div key={passo.id} className="relative z-10 flex flex-col items-center group">
                <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${bgCircle} ${borderCircle} ${textIcon}`}>
                  {concluido ? <CheckCheck size={20} className="animate-in zoom-in" /> : passo.icone}
                </div>
                <span className={`absolute -bottom-7 text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap transition-colors ${textLabel}`}>
                  {passo.titulo}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const tarefasAtuais = tarefasEmAndamento.filter(t => !t.isFutura);
  const temTarefaAtual = tarefasAtuais.length > 0;

  let numCards = 1; 
  if (temTarefaAtual) numCards++;
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
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        {renderBarraProgresso()}
        <div className="bg-blue-600 text-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 mt-16 shadow-2xl shadow-blue-600/30">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-200 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-gray-500">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer shadow-inner" 
              value={escolaSelecionada?.id || ''} 
              onChange={e => {
                if (e.target.value === 'nova_instituicao') {
                  navigate('/turmas', { state: { abrirModalInstituicao: true } });
                } else {
                  setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value));
                }
              }}
            >
              <option value="" disabled>Selecione...</option>
              {instituicoes.map(i => (
                <option key={i.id} value={i.id}>
                  {i.nome} {isAdmin && i.professorUid === currentUser.uid ? '(Sua conta)' : isAdmin ? '(De outro prof.)' : ''}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="nova_instituicao">+ Criar Nova Instituição</option>
            </select>
          </div>
        </div>
      </div>

      {passoAtual <= 4 && renderBarraProgresso()}

      {minhasTurmas.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12">
          <div className="bg-blue-50 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Building2 size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Excelente! A instituição foi criada.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Agora, precisamos criar a sua primeira sala de aula para começarmos a organizar as atividades.</p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
            Passo 2: Criar Turma <ChevronRight size={18}/>
          </Link>
        </div>
      ) : 

      !temAlunos ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12">
          <div className="bg-orange-50 text-orange-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><UserPlus size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Turma criada! Mas e os alunos?</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Uma sala de aula não funciona sem eles. Vamos adicionar a lista de alunos para que eles possam receber as atividades.</p>
          <Link to="/alunos" className="inline-flex items-center gap-2 bg-orange-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 hover:-translate-y-0.5 transition-all">
            Passo 3: Cadastrar Alunos <ChevronRight size={18}/>
          </Link>
        </div>
      ) : 

      !temTarefasGeral ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12">
          <div className="bg-purple-50 text-purple-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><FileText size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Tudo pronto! Vamos ao trabalho.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Sua turma já tem alunos cadastrados. Que tal lançar o seu primeiro desafio ou atividade para eles?</p>
          <Link to="/tarefas" className="inline-flex items-center gap-2 bg-purple-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg shadow-purple-600/20 hover:bg-purple-700 hover:-translate-y-0.5 transition-all">
            Passo 4: Criar Tarefa <ChevronRight size={18}/>
          </Link>
        </div>
      ) : (

        <>
          {/* BARRA PRETA DE PONTO DE SITUAÇÃO - GESTÃO À VISTA FOCO TOTAL */}
          <div className="bg-[#1f2937] text-white rounded-2xl p-5 shadow-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800 mt-6 overflow-hidden">
            <div className="flex gap-4 items-start w-full">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shrink-0 shadow-inner mt-1">
                <Calendar size={24} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-white mb-1.5 tracking-wide">Ponto de Situação do Curso</h2>
                <div className="space-y-1.5 text-sm font-medium text-slate-300">
                  {tarefasEmAndamento.length > 0 ? (
                    <div className="space-y-1">
                      {tarefasEmAndamento.map((t) => (
                        <p key={t.id} className="flex items-center gap-2 truncate">
                          <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${t.isFutura ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                          <strong className="text-white truncate max-w-[70%]" title={t.nomeTarefa}>{t.nomeTarefa}</strong>
                          <span className={`${t.isFutura ? 'text-blue-400' : 'text-green-400'} text-[11px] font-black shrink-0`}>
                            {t.isFutura ? `(Inicia em ${t.diasRestantes} dias)` : `(Faltam ${t.diasRestantes} dias)`}
                          </span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-gray-400 italic">
                      <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></span>
                      Nenhuma tarefa programada no cronograma.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Link to="/tarefas" className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md hover:bg-blue-700 transition-all shrink-0 whitespace-nowrap text-center self-center md:self-auto">
              Cronograma
            </Link>
          </div>

          {mostrarTermometroIA && metricasIA.total > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-5 shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl shrink-0"><Sparkles size={24} className="text-purple-100" /></div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-wide">Termômetro do Prompt Atual</h2>
                  <p className="text-purple-200 text-xs font-medium mt-0.5">Feedbacks aprovados sem alteração.</p>
                </div>
              </div>
              <div className="text-left md:text-right shrink-0">
                <span className="block text-4xl font-black text-white tracking-tighter">{metricasIA.percentual}%</span>
                <span className="text-purple-200 text-[10px] font-bold uppercase tracking-wider">{metricasIA.originais} de {metricasIA.total} originais</span>
              </div>
            </div>
          )}

          <div className={gridClass}>
            {temTarefaAtual && (
              <div className="bg-white border border-indigo-200 rounded-2xl shadow-sm flex flex-col hover:shadow-md transition-shadow relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-full z-0 pointer-events-none"></div>
                <div className="p-5 pb-2 relative z-10 shrink-0 bg-white">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                      {tarefasAtuais.length === 1 ? 'Tarefa Atual' : 'Em Andamento'}
                    </h3>
                    <div className="text-indigo-500 bg-indigo-50 p-1.5 rounded-lg"><PlayCircle size={20}/></div>
                  </div>
                </div>
                <div className="p-5 pt-0 relative z-10 flex-1 overflow-y-auto max-h-[140px]" style={{ scrollbarWidth: 'thin' }}>
                  <div className="space-y-4">
                    {tarefasAtuais.map((tarefa, idx) => (
                      <div key={tarefa.id} className={idx > 0 ? "pt-4 border-t border-indigo-50" : ""}>
                        <span className={`block font-black text-gray-800 leading-tight line-clamp-2 ${tarefasAtuais.length === 1 ? 'text-2xl' : 'text-[17px]'}`} title={tarefa.nomeTarefa}>
                          {tarefa.nomeTarefa}
                        </span>
                        <div className="flex items-center justify-between mt-2">
                          <Link to={`/revisar/${tarefa.id}`} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline w-fit">
                            {progressoTarefas[tarefa.id] ? "Continuar" : "Iniciar"} <ChevronRight size={14}/>
                          </Link>
                          {tarefasAtuais.length > 1 && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {tarefa.diasRestantes} d
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
                <h3 className="text-[11px] font-black text-green-600 uppercase tracking-widest mt-1">Finalizado</h3>
                <div className="text-green-500 bg-green-50 p-1.5 rounded-lg"><CheckCheck size={20}/></div>
              </div>
              <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
              <Link to="/historico" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver histórico <ChevronRight size={14}/></Link>
            </div>
          </div>

          {(gestaoVista.atual || gestaoVista.anterior) && (
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={24}/> Gestão à Vista: Foco Atual
              </h2>
              <div className="space-y-6">
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
