import { useState, useEffect, useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Megaphone, Copy, CheckCircle2, MessageCircle, Send, User, MonitorSmartphone, GraduationCap, RefreshCw, BookOpen, Target, CalendarClock } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Comunicacao() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  // Parâmetros vindos de atalhos (Ex: Tela de Pendências)
  const turmaPreSelecionada = location.state?.turmaIdSelecionada || '';
  const alunoAlvo = location.state?.alunoAlvo || null;

  const [turmas, setTurmas] = useState([]);
  const [turmaAtiva, setTurmaAtiva] = useState(turmaPreSelecionada);
  
  const [tarefasDaTurma, setTarefasDaTurma] = useState([]);
  const [tarefaAtivaId, setTarefaAtivaId] = useState('');
  
  const [devedores, setDevedores] = useState([]);
  
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDados, setLoadingDados] = useState(false);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(null);

  // 1. Busca as Turmas da Instituição
  useEffect(() => {
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
        if (turmasData.length > 0 && !turmaAtiva) setTurmaAtiva(turmasData[0].id);
      } catch (error) {
        setErro("Falha de conexão com o banco de dados.");
      } finally {
        setLoadingTurmas(false);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  // 2. Busca Tarefas, Alunos e calcula Pendências da Turma e Tarefa selecionadas
  useEffect(() => {
    async function fetchDadosComunicacao() {
      if (!turmaAtiva) {
        setTarefasDaTurma([]); setDevedores([]); setTarefaAtivaId('');
        return;
      }
      setLoadingDados(true);
      try {
        // Busca Tarefas
        const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapTarefas = await getDocs(qTarefas);
        const tarefasData = snapTarefas.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        
        // Ordena por dataFim (mais próximas primeiro)
        tarefasData.sort((a, b) => {
          const timeA = a.dataFim?.toMillis() || 0;
          const timeB = b.dataFim?.toMillis() || 0;
          return timeA - timeB;
        });
        
        setTarefasDaTurma(tarefasData);
        
        // Auto-seleciona a primeira tarefa se não tiver nenhuma selecionada
        const tarefaAtualId = tarefaAtivaId && tarefasData.some(t => t.id === tarefaAtivaId) ? tarefaAtivaId : (tarefasData[0]?.id || '');
        setTarefaAtivaId(tarefaAtualId);

        if (!tarefaAtualId) {
          setDevedores([]);
          setLoadingDados(false);
          return;
        }

        // Busca Alunos e Entregas (Atividades)
        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapAlunos = await getDocs(qAlunos);
        const alunosData = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira');

        const qAtividades = query(collection(db, 'atividades'), where('tarefaId', '==', tarefaAtualId));
        const snapAtividades = await getDocs(qAtividades);
        const entregasFeitas = new Set(snapAtividades.docs.map(d => d.data().alunoId));

        // Filtra quem não entregou ESTA tarefa específica
        const listaDevedores = alunosData.filter(aluno => !entregasFeitas.has(aluno.id));

        // Coloca o alunoAlvo no topo, se existir
        listaDevedores.sort((a, b) => {
          if (a.nome === alunoAlvo) return -1;
          if (b.nome === alunoAlvo) return 1;
          return a.nome.localeCompare(b.nome);
        });

        setDevedores(listaDevedores);
      } catch (error) {
        console.error("Erro ao montar pendências:", error);
      } finally {
        setLoadingDados(false);
      }
    }
    fetchDadosComunicacao();
  }, [turmaAtiva, tarefaAtivaId, alunoAlvo]);

  // --- CÁLCULO DE DATAS E HORAS (Mantido da V1/V2) ---
  const getDiasRestantes = (timestampFim) => {
    if (!timestampFim || !timestampFim.toDate) return null;
    const agora = new Date();
    const dataFim = timestampFim.toDate(); // Pega a hora exata (ex: 23:59)
    const diferencaTime = dataFim.getTime() - agora.getTime();
    return Math.ceil(diferencaTime / (1000 * 3600 * 24));
  };

  const getPrimeiroNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    const primeiro = partes[0];
    return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
  };

  // --- GERADORES DE MENSAGENS INTELIGENTES (IDÊNTICOS À V1) ---
  const tarefaAtualObj = tarefasDaTurma.find(t => t.id === tarefaAtivaId);
  const diasRestantesVisual = tarefaAtualObj ? getDiasRestantes(tarefaAtualObj.dataFim) : null;
  const nomeTarefa = tarefaAtualObj?.nomeTarefa || tarefaAtualObj?.titulo || 'a tarefa';

  const gerarMensagemGeral = () => {
    if (!tarefaAtualObj) return '';
    if (diasRestantesVisual !== null) {
      if (diasRestantesVisual < 0) return `Olá, pessoal!\nO prazo oficial de *${nomeTarefa}* foi encerrado. Notei algumas pendências no sistema.\n\nPor favor, regularizem as entregas imediatamente para evitarmos problemas com a aprovação. Fico no aguardo.`;
      if (diasRestantesVisual >= 20) return `Olá, pessoal! 🌟 Passando para avisar que a etapa de *${nomeTarefa}* já está em andamento.\n\nFaltam ${diasRestantesVisual} dias para o encerramento. Quem já quiser ir adiantando as atividades, desejo excelentes estudos!\nQualquer coisa, podem contar comigo.`;
      if (diasRestantesVisual >= 8) return `Olá, pessoal! Nosso lembrete de acompanhamento sobre *${nomeTarefa}*.\n\nEntramos na fase intermediária e faltam ${diasRestantesVisual} dias para o encerramento.\nVamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, estou à disposição.`;
      
      return `Olá, colegas!\n🚨 Passando para alertar que entramos na reta final de *${nomeTarefa}*. Faltam apenas ${diasRestantesVisual} dias para o encerramento!\n\nPeço a regularização das tarefas pendentes o quanto antes para evitarmos problemas.`;
    }
    return `Olá, pessoal!\nPassando para lembrar do nosso acompanhamento sobre *${nomeTarefa}*. Peço a regularização das tarefas pendentes o quanto antes para não acumular.\nQualquer dúvida, estou por aqui!`;
  };

  const gerarMensagemIndividual = (nomeAluno) => {
    const primeiroNome = getPrimeiroNome(nomeAluno);
    if (diasRestantesVisual !== null) {
      if (diasRestantesVisual < 0) return `Olá, ${primeiroNome}! Tudo bem?\nO prazo oficial de *${nomeTarefa}* foi encerrado. Notei no sistema que ainda consta pendência para a entrega desta atividade.\n\nPor favor, regularize essa situação imediatamente para evitarmos problemas com a aprovação. Fico no aguardo!`;
      if (diasRestantesVisual >= 20) return `Olá, ${primeiroNome}! Tudo bem? 🌟\nPassando para avisar que a etapa de *${nomeTarefa}* já está em andamento. Faltam ${diasRestantesVisual} dias para o encerramento e notei pendência na sua entrega.\n\nRecomendo adiantar a execução, pra não ficar para a última hora. Qualquer coisa, pode contar comigo!`;
      if (diasRestantesVisual >= 8) return `Olá, ${primeiroNome}! Tudo bem?\nNosso lembrete de acompanhamento sobre *${nomeTarefa}*. Faltam ${diasRestantesVisual} dias para o encerramento e notei pendência na sua entrega.\n\nVamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, pode me chamar.`;
      
      return `Olá, ${primeiroNome}! Tudo bem?\n🚨 Passando para alertar que entramos na reta final de *${nomeTarefa}*. Faltam apenas ${diasRestantesVisual} dias para o encerramento!\n\nNotei pendência para esta entrega. Recomendo que regularize o quanto antes para não acumular nem termos problemas. Qualquer coisa, me chame.`;
    }
    return `Olá, ${primeiroNome}! Tudo bem?\nPassando para lembrar do nosso acompanhamento sobre *${nomeTarefa}*. Notei pendência para esta entrega.\n\nRecomendo a regularização o quanto antes para não acumular. Qualquer dúvida, pode contar comigo!`;
  };

  // --- CONTROLES DE AÇÃO ---
  const aplicarFeedback = (idCopia, acaoAposFeedback) => {
    setCopiado(idCopia);
    setTimeout(() => {
      setCopiado(null);
      if (acaoAposFeedback) acaoAposFeedback();
    }, 1500);
  };

  const handleCopiar = (texto, id) => {
    navigator.clipboard.writeText(texto);
    aplicarFeedback(id);
  };

  const handleEnviarWhatsAppGeral = (texto) => {
    navigator.clipboard.writeText(texto);
    aplicarFeedback('geral', () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    });
  };

  const handleEnviarWhatsAppIndividual = (alunoObjeto, idCopia) => {
    const textoFinal = gerarMensagemIndividual(alunoObjeto.nome);
    navigator.clipboard.writeText(textoFinal);
    const numeroLimpo = alunoObjeto.whatsapp ? alunoObjeto.whatsapp.replace(/\D/g, '') : '';
    const textoCodificado = encodeURIComponent(textoFinal);
    const url = numeroLimpo ? `https://wa.me/${numeroLimpo}?text=${textoCodificado}` : `https://wa.me/?text=${textoCodificado}`;
    aplicarFeedback(idCopia, () => window.open(url, '_blank'));
  };

  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';
  const isCarregando = loadingTurmas || loadingDados;
  const msgGeralPronta = gerarMensagemGeral();

  // UX Defesa 1: Sem Instituição
  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Comunicação' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <GraduationCap className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Para acessar a central de comunicação, selecione a sua instituição de trabalho.</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-xl hover:bg-blue-700 transition-all shadow-lg">Ir para o Centro de Comando</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      {/* CABEÇALHO */}
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Comunicação (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-xl font-black text-green-700 flex items-center gap-2 tracking-tight">
            <Megaphone className="text-green-600" size={24} /> Central de Cobrança
          </h1>

          {!loadingTurmas && turmas.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:block">Turma:</span>
              <select 
                className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl focus:ring-2 focus:ring-green-500 py-2 px-3 font-bold shadow-sm cursor-pointer w-full sm:w-auto"
                value={turmaAtiva} onChange={e => { setTurmaAtiva(e.target.value); setTarefaAtivaId(''); }}
              >
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loadingTurmas ? (
        <div className="p-20 text-center animate-pulse flex flex-col items-center gap-3"><Megaphone className="text-green-300" size={48} /><p className="font-bold text-green-600">Preparando mensagens...</p></div>
      ) : turmas.length === 0 ? (
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10">
          <BookOpen className="mx-auto text-blue-400 mb-4" size={48} />
          <h2 className="text-xl font-black text-blue-800 mb-2">Sem turmas ativas</h2>
          <p className="text-blue-600 mb-6 font-medium">Você precisa criar uma turma antes de enviar comunicados.</p>
          <Link to="/turmas" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-md">Criar Turma</Link>
        </div>
      ) : (
        <>
          {/* SMART TABS (TAREFAS DA TURMA) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                <Target size={16} /> Tarefa em Foco
              </h3>
              <p className="text-xs text-gray-400 font-medium">Selecione qual tarefa da turma <strong>{getNomeTurmaAtiva()}</strong> você deseja cobrar neste momento.</p>
            </div>

            {tarefasDaTurma.length === 0 ? (
              <div className="text-sm text-orange-600 font-bold bg-orange-50 p-4 rounded-xl border border-orange-200">
                Nenhuma tarefa cadastrada para esta turma.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {tarefasDaTurma.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTarefaAtivaId(t.id)}
                    className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${
                      tarefaAtivaId === t.id
                        ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${tarefaAtivaId === t.id ? 'bg-white' : 'bg-green-500 animate-pulse'}`}></span>
                    {t.nomeTarefa || t.titulo}
                  </button>
                ))}
              </div>
            )}

            {/* RELÓGIO DE PRAZO INTELIGENTE */}
            {tarefaAtivaId && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                {diasRestantesVisual !== null ? (
                  <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap shadow-sm ${diasRestantesVisual < 0 ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                    <CalendarClock size={16} /> 
                    {diasRestantesVisual < 0 ? 'Prazo Encerrado' : `Faltam ${diasRestantesVisual} dias para o fim`}
                  </div>
                ) : (
                  <div className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap bg-gray-50 text-gray-500 border border-gray-200">
                    <CalendarClock size={16} /> Tarefa sem prazo definido
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ÁREAS DE MENSAGENS */}
          {tarefaAtivaId && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              
              {/* COLUNA ESQUERDA: Mensagem Geral */}
              <div className="xl:col-span-1 space-y-6 xl:sticky xl:top-24">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200">
                  <h3 className="text-lg font-black text-green-900 mb-2 flex items-center gap-2">
                    <MessageCircle size={20} className="text-green-600"/> Grupo da Turma
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 font-medium">Aviso coletivo inteligente adaptado ao prazo da tarefa.</p>
                  
                  <div className="bg-green-50/50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap border border-green-100 mb-4 shadow-inner italic">
                    "{msgGeralPronta}"
                  </div>

                  <button 
                    onClick={() => handleEnviarWhatsAppGeral(msgGeralPronta)}
                    disabled={loadingDados}
                    className={`w-full font-black py-3 rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm text-sm disabled:opacity-50 ${copiado === 'geral' ? 'bg-green-200 text-green-900 scale-95' : 'bg-green-600 text-white hover:bg-green-700'}`}
                  >
                    {copiado === 'geral' ? <><CheckCircle2 size={18}/> Copiado! Abrindo Zap...</> : <><Send size={18}/> Enviar para o Grupo</>}
                  </button>
                </div>
              </div>

              {/* COLUNA DIREITA: Cobrança Individualizada */}
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-gray-100 pb-4 mb-6 gap-2">
                    <div>
                      <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        <MonitorSmartphone size={20} className="text-blue-600"/> Textos Individualizados
                      </h3>
                      <p className="text-sm text-gray-500 font-medium mt-1">Copie a mensagem e cole no sistema oficial da sua instituição ou chame direto no Zap.</p>
                    </div>
                    {devedores.length > 0 && (
                      <span className="bg-red-50 text-red-600 text-xs font-black px-3 py-1.5 rounded-lg shrink-0 border border-red-100">
                        {devedores.length} Faltam Entregar
                      </span>
                    )}
                  </div>

                  {loadingDados ? (
                    <div className="text-center py-12 text-gray-400 font-bold animate-pulse">Calculando pendências...</div>
                  ) : devedores.length === 0 ? (
                    <div className="text-center py-16 text-green-600 font-bold bg-green-50 rounded-2xl border border-green-100">
                      <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} strokeWidth={3} />
                      </div>
                      100% Entregue! Ninguém devendo esta tarefa! 🎉
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {devedores.map((pend, idx) => {
                        const idCopiaPlat = `plat-${idx}`;
                        const idCopiaZap = `zap-${idx}`;
                        const msgIndividualizada = gerarMensagemIndividual(pend.nome);
                        const isFocado = pend.nome === alunoAlvo;
                        
                        return (
                          <div key={idx} className={`p-5 rounded-2xl border transition-all ${isFocado ? 'bg-blue-50/30 bord
