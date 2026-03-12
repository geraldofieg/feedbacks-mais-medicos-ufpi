import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, ChevronRight, Calendar, Sparkles, Building2, School, UserPlus, FileText, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  // REGRAS DE NEGÓCIO (TIERS E ACESSOS)
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const planoUsuario = userProfile?.plano || 'basico'; 
  
  // Apenas a partir do Intermediário o professor tem acesso à Esteira de Correção
  const mostrarRevisao = isAdmin || planoUsuario === 'intermediario' || planoUsuario === 'premium';
  
  // Apenas a partir do Premium o professor tem acesso à IA
  const mostrarTermometroIA = isAdmin || planoUsuario === 'premium';
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [tarefasEmAndamento, setTarefasEmAndamento] = useState([]);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });
  const [loading, setLoading] = useState(true);
  
  // Estados para o Tapete Vermelho (Onboarding)
  const [temAlunos, setTemAlunos] = useState(true); 
  const [temTarefasGeral, setTemTarefasGeral] = useState(true);

  // 1. Busca Instituições
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
      } else {
        setEscolaSelecionada(null);
      }
      setLoading(false);
    }
    fetchInst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAdmin, setEscolaSelecionada]);

  // 2. Busca Dados para Onboarding e Dashboard
  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      
      setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 }); 
      setMetricasIA({ total: 0, originais: 0, percentual: 0 });
      setTarefasEmAndamento([]);
      
      try {
        // Verifica Turmas
        const qTurmas = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapT = await getDocs(qTurmas);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);

          // Verifica Alunos
          const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAlunos = await getDocs(qAlunos);
          const alunosVivos = snapAlunos.docs.filter(d => d.data().status !== 'lixeira');
          setTemAlunos(alunosVivos.length > 0);
          
          // Verifica Tarefas Gerais e Ponto de Situação
          const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTarefas = await getDocs(qTarefas);
          const tarefasVivas = snapTarefas.docs.map(d => ({id: d.id, ...d.data()})).filter(t => t.status !== 'lixeira');
          setTemTarefasGeral(tarefasVivas.length > 0);

          const agora = new Date();
          const ativas = tarefasVivas
            .filter(t => tIds.includes(t.turmaId))
            .map(t => {
              const dataRaw = t.dataFim || t.data || t.prazo || t.vencimento;
              if (!dataRaw) return null;
              let dataF;
              try { dataF = dataRaw.toDate ? dataRaw.toDate() : new Date(dataRaw); } catch(e) { return null; }
              if (isNaN(dataF)) return null;

              const diasRestantes = Math.ceil((dataF.getTime() - agora.getTime()) / (1000 * 3600 * 24));
              return { 
                ...t, 
                diasRestantes,
                nomeTarefa: t.nomeTarefa || t.titulo || t.nome || t.modulo || 'Atividade'
              };
            })
            .filter(t => t && t.diasRestantes >= 0)
            .sort((a, b) => a.diasRestantes - b.diasRestantes)
            .slice(0, 3);
            
          setTarefasEmAndamento(ativas);

          // Lógica do Kanban
          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtiv = await getDocs(qAtiv);
          
          let p = 0, f = 0, ok = 0;
          let iaTotal = 0, iaOriginais = 0;

          snapAtiv.docs.forEach(doc => {
            const d = doc.data();
            if (tIds.includes(d.turmaId)) {
              const jaPostado = d.postado === true || d.enviado === true || d.status === 'finalizado' || d.status === 'postado';
              const jaAprovado = d.status === 'aprovado' || d.status === 'revisado' || (d.feedbackFinal && String(d.feedbackFinal).trim() !== '');

              if (jaPostado) ok++; 
              else if (jaAprovado) f++;  
              else p++;  

              const fFinal = d.feedbackFinal ? String(d.feedbackFinal).trim() : '';
              const fSugerido = String(d.feedbackSugerido || d.feedbackIA || '').trim();
              
              if ((jaAprovado || jaPostado) && fSugerido !== '') {
                iaTotal++;
                if (fFinal === fSugerido) iaOriginais++;
              }
            }
          });
          
          setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
          const percent = iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0;
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: percent });
        }
      } catch (e) { console.error("Erro ao carregar dados", e); }
    }
    fetchDados();
  }, [escolaSelecionada]);

  // Se não for admin, o finalizado "engole" as tarefas prontas para focar a visão do professor
  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  if (loading) return <div className="p-20 text-center font-bold">Carregando Estação...</div>;

  // =========================================================================
  // ONBOARDING - PASSO 1: Não tem Instituição
  // =========================================================================
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
      {/* HEADER E SELETOR DE INSTITUIÇÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-200 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-gray-500">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer shadow-inner" 
              value={escolaSelecionada?.id || ''} 
              onChange={e => setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value))}
            >
              <option value="" disabled>Selecione...</option>
              {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ONBOARDING - PASSOS 2, 3 E 4
          ========================================================================= */}
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

      /* =========================================================================
         DASHBOARD OFICIAL V3
         ========================================================================= */
        <>
          {/* BARRA PRETA: PONTO DE SITUAÇÃO */}
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
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></span>
                      <span className="text-gray-400 shrink-0">Assíncrono:</span>
                      <strong className="text-white truncate" title={tarefasEmAndamento[0].nomeTarefa}>{tarefasEmAndamento[0].nomeTarefa}</strong>
                      <span className="text-green-400 text-xs font-bold shrink-0">(Faltam {tarefasEmAndamento[0].diasRestantes} dias)</span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0"></span>
                      Nenhuma tarefa ativa no cronograma.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Link to="/tarefas" className="bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md hover:bg-blue-700 transition-all shrink-0 whitespace-nowrap text-center">
              Ver Cronograma Completo
            </Link>
          </div>

          {/* TERMÔMETRO DA IA (Tier Premium ou Admin) */}
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

          {/* GRID DO KANBAN DINÂMICO BASEADO NO PERFIL */}
          <div className={`grid grid-cols-1 gap-5 mb-10 ${isAdmin ? 'md:grid-cols-3' : (mostrarRevisao ? 'md:grid-cols-2 max-w-4xl' : 'max-w-md mx-auto')}`}>
            
            {/* ESTEIRA DE PRODUÇÃO (Só aparece se o usuário for Tier 2+ ou Admin) */}
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

            {/* ÁREA DE ADMIN (Aguardando Postar) */}
            {isAdmin && (
              <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">Aguardando Postar</h3>
                  <div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg"><Send size={20}/></div>
                </div>
                <span className="text-4xl font-black text-gray-800">{kanban.faltaLancar}</span>
                <Link to="/faltapostar" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Copiar p/ Site <ChevronRight size={14}/></Link>
              </div>
            )}

            {/* HISTÓRICO (Aparece para todos, independente do Tier) */}
            <div className="bg-white border border-green-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-black text-green-600 uppercase tracking-widest mt-1">Histórico Finalizado</h3>
                <div className="text-green-500 bg-green-50 p-1.5 rounded-lg"><CheckCheck size={20}/></div>
              </div>
              <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
              <Link to="/historico" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver histórico <ChevronRight size={14}/></Link>
            </div>
            
          </div>
        </>
      )}
    </div>
  );
}
