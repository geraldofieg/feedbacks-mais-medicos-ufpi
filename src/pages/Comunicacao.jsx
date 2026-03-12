import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Megaphone, Copy, CheckCircle2, MessageCircle, Send, MonitorSmartphone, GraduationCap, BookOpen, Target, CalendarClock, User } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Comunicacao() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const location = useLocation();
  const alunoAlvo = location.state?.alunoAlvo || null;

  const [turmas, setTurmas] = useState([]);
  
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });
  
  const [tarefasDaTurma, setTarefasDaTurma] = useState([]);
  const [tarefaAtivaId, setTarefaAtivaId] = useState('');
  const [devedores, setDevedores] = useState([]);
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingDados, setLoadingDados] = useState(false);
  const [copiado, setCopiado] = useState(null);

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
      if (!currentUser || !escolaSelecionada?.id) { setLoadingTurmas(false); return; }
      setLoadingTurmas(true);
      try {
        const turmasRef = collection(db, 'turmas');
        const qT = isAdmin 
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        
        const snapT = await getDocs(qT);
        
        let turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        turmasData.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0));
        
        setTurmas(turmasData);
        
        const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
        const isValid = turmasData.some(t => t.id === targetTurma);
        
        if (isValid) {
          if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
        } else if (turmasData.length > 0) {
          setTurmaAtiva(turmasData[0].id);
        }
      } catch (error) { console.error(error); } finally { setLoadingTurmas(false); }
    }
    fetchTurmas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, escolaSelecionada, isAdmin]);

  useEffect(() => {
    async function fetchDadosComunicacao() {
      if (!turmaAtiva) { setTarefasDaTurma([]); setDevedores([]); setTarefaAtivaId(''); return; }
      setLoadingDados(true);
      try {
        const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapTarefas = await getDocs(qTarefas);
        
        const tarefasData = snapTarefas.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(t => t.status !== 'lixeira' && (t.tipo === 'entrega' || !t.tipo));
        
        tarefasData.sort((a, b) => (a.dataFim?.toMillis() || 0) - (b.dataFim?.toMillis() || 0));
        setTarefasDaTurma(tarefasData);
        
        const tarefaAtualId = tarefaAtivaId && tarefasData.some(t => t.id === tarefaAtivaId) ? tarefaAtivaId : (tarefasData[0]?.id || '');
        setTarefaAtivaId(tarefaAtualId);

        if (!tarefaAtualId) { setDevedores([]); setLoadingDados(false); return; }

        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapAlunos = await getDocs(qAlunos);
        const alunosData = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira');

        const qAtividades = query(collection(db, 'atividades'), where('tarefaId', '==', tarefaAtualId));
        const snapAtividades = await getDocs(qAtividades);
        const entregasFeitas = new Set(snapAtividades.docs.map(d => d.data().alunoId));

        const listaDevedores = alunosData.filter(aluno => !entregasFeitas.has(aluno.id));
        listaDevedores.sort((a, b) => {
          if (a.nome === alunoAlvo) return -1;
          if (b.nome === alunoAlvo) return 1;
          return a.nome.localeCompare(b.nome);
        });

        setDevedores(listaDevedores);
      } catch (error) { console.error(error); } finally { setLoadingDados(false); }
    }
    fetchDadosComunicacao();
  }, [turmaAtiva, tarefaAtivaId, alunoAlvo]);

  const getDiasRestantes = (timestampFim) => {
    if (!timestampFim || !timestampFim.toDate) return null;
    const agora = new Date(); const dataFim = timestampFim.toDate(); 
    return Math.ceil((dataFim.getTime() - agora.getTime()) / (1000 * 3600 * 24));
  };

  const getPrimeiroNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    return nomeCompleto.trim().split(' ')[0].charAt(0).toUpperCase() + nomeCompleto.trim().split(' ')[0].slice(1).toLowerCase();
  };

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

  const aplicarFeedback = (idCopia, acaoAposFeedback) => {
    setCopiado(idCopia);
    setTimeout(() => { setCopiado(null); if (acaoAposFeedback) acaoAposFeedback(); }, 1500);
  };

  const handleCopiar = (texto, id) => { navigator.clipboard.writeText(texto); aplicarFeedback(id); };

  const handleEnviarWhatsAppGeral = (texto) => {
    navigator.clipboard.writeText(texto);
    aplicarFeedback('geral', () => { window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank'); });
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
  const msgGeralPronta = gerarMensagemGeral();
  
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
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: `Comunicação (${escolaSelecionada.nome})` }]} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-3">
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3 tracking-tight">
            <div className="bg-green-100 text-green-600 p-2.5 rounded-xl shadow-sm"><Megaphone size={26} /></div>
            Central de Cobrança
          </h1>

          {!loadingTurmas && turmas.length > 0 && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 min-w-[240px]">
              <GraduationCap size={20} className="text-gray-400 ml-2" />
              <select 
                className="w-full py-3.5 bg-transparent outline-none text-sm font-bold text-gray-700 cursor-pointer"
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
          {/* BLOCO SUPERIOR: SELEÇÃO DA TAREFA */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Target size={16} /> Tarefa em Foco
              </h3>
              <p className="text-xs text-gray-400 font-medium">Selecione abaixo a tarefa ou módulo que você deseja gerenciar e cobrar neste momento.</p>
            </div>

            {tarefasDaTurma.length === 0 ? (
              <div className="text-sm text-orange-600 font-bold bg-orange-50 p-4 rounded-xl border border-orange-200">
                Nenhuma tarefa do aluno cadastrada para esta turma.
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {tarefasDaTurma.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTarefaAtivaId(t.id)}
                    className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border ${tarefaAtivaId === t.id ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${tarefaAtivaId === t.id ? 'bg-white' : 'bg-green-500 animate-pulse'}`}></span>
                    {t.nomeTarefa || t.titulo}
                  </button>
                ))}
              </div>
            )}

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

          {/* DUAS COLUNAS V1-STYLE */}
          {tarefaAtivaId && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              
              {/* COLUNA ESQUERDA: ZAP E GRUPO */}
              <div className="xl:col-span-1 space-y-6 xl:sticky xl:top-24">
                
                {/* CARD 1: GRUPO DA TURMA */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200">
                  <h3 className="text-lg font-black text-green-900 mb-1 flex items-center gap-2">
                    <MessageCircle size={20} className="text-green-600"/> Grupo da Turma
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 font-medium">Aviso coletivo inteligente adaptado ao prazo.</p>
                  
                  <div className="bg-green-50/50 p-4 rounded-xl text-sm text-gray-700 whitespace-pre-wrap border border-green-100 mb-4 shadow-inner italic">
                    "{msgGeralPronta}"
                  </div>

                  <button 
                    onClick={() => handleEnviarWhatsAppGeral(msgGeralPronta)}
                    disabled={loadingDados}
                    className={`w-full font-black py-3 rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm text-sm disabled:opacity-50 ${copiado === 'geral' ? 'bg-green-200 text-green-900 scale-95' : 'bg-green-600 text-white hover:bg-green-700'}`}
                  >
                    {copiado === 'geral' ? <><CheckCircle2 size={18}/> Copiado!</> : <><Send size={18}/> Enviar para o Grupo</>}
                  </button>
                </div>

                {/* CARD 2: ZAP DIRETO (RESTAURADO DA V1) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-black text-gray-800 mb-1 flex items-center gap-2">
                    <User size={20} className="text-green-600"/> Zap Direto
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 font-medium">Envie mensagens privadas para o WhatsApp de cada aluno.</p>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {devedores.filter(a => a.whatsapp).length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl border border-gray-100">Nenhum aluno com WhatsApp cadastrado possui pendência.</p>
                    ) : (
                      devedores.filter(a => a.whatsapp).map((pend, idx) => {
                        const idCopiaZap = `zap-${idx}`;
                        return (
                          <div key={idx} className="bg-gray-50 border border-gray-100 p-4 rounded-xl flex flex-col gap-3 hover:border-green-200 transition-colors">
                            <div>
                              <h4 className="font-black text-gray-800 text-sm truncate" title={pend.nome}>{getPrimeiroNome(pend.nome)} <span className="font-medium text-xs text-gray-500">({pend.nome})</span></h4>
                              <p className="text-[10px] font-black text-red-500 uppercase mt-0.5 tracking-widest truncate">Deve: {nomeTarefa}</p>
                            </div>
                            <button
                              onClick={() => handleEnviarWhatsAppIndividual(pend, idCopiaZap)}
                              className={`w-full py-2.5 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-all ${copiado === idCopiaZap ? 'bg-green-200 text-green-900' : 'bg-white border border-green-500 text-green-600 hover:bg-green-50 shadow-sm'}`}
                            >
                              {copiado === idCopiaPlat ? <CheckCircle2 size={16}/> : <Send size={16}/>} {copiado === idCopiaZap ? 'Abrindo...' : 'Enviar Zap'}
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* COLUNA DIREITA: COPIAR PARA PLATAFORMA */}
              <div className="xl:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-gray-100 pb-4 mb-6 gap-4">
                    <div>
                      <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        <Copy size={20} className="text-blue-600"/> Copiar para a Plataforma
                      </h3>
                      <p className="text-sm text-gray-500 font-medium mt-1 max-w-lg">Textos individualizados. Copie a mensagem personalizada e cole no perfil do aluno na plataforma oficial (Ex: Gov.br, Moodle).</p>
                    </div>
                    {devedores.length > 0 && (
                      <span className="bg-red-50 text-red-600 text-xs font-black px-4 py-2 rounded-lg shrink-0 border border-red-100 shadow-sm">
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
                      <h3 className="text-xl font-black mb-1">100% Entregue!</h3>
                      <p className="text-green-700/70 font-medium">Ninguém devendo esta tarefa na turma.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {devedores.map((pend, idx) => {
                        const idCopiaPlat = `plat-${idx}`;
                        const msgIndividualizada = gerarMensagemIndividual(pend.nome);
                        const isFocado = pend.nome === alunoAlvo;
                        
                        return (
                          <div key={idx} className={`p-5 rounded-2xl border transition-all ${isFocado ? 'bg-blue-50/30 border-blue-300 shadow-md ring-4 ring-blue-50' : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'}`}>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                              <div>
                                <span className="font-black text-gray-900 text-lg flex items-center gap-2">
                                  {pend.nome}
                                  {isFocado && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Foco</span>}
                                </span>
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-1">
                                  Deve: {nomeTarefa}
                                </p>
                              </div>
                              
                              <button 
                                onClick={() => handleCopiar(msgIndividualizada, idCopiaPlat)}
                                className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm border ${copiado === idCopiaPlat ? 'bg-blue-600 text-white border-blue-600 scale-105' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                              >
                                {copiado === idCopiaPlat ? <CheckCircle2 size={16}/> : <Copy size={16}/>} {copiado === idCopiaPlat ? 'Copiado!' : 'Copiar Mensagem'}
                              </button>
                            </div>
                            
                            <div className="bg-gray-50 p-5 rounded-xl text-sm text-gray-600 whitespace-pre-wrap border border-gray-100 font-medium italic shadow-inner">
                              "{msgIndividualizada}"
                            </div>
                            
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
