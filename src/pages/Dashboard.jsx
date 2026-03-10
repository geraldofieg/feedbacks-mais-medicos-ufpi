import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, ChevronRight, Calendar, Sparkles, Building2, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const planoUsuario = userProfile?.plano || 'basico'; 
  const mostrarRevisao = isAdmin || planoUsuario === 'intermediario' || planoUsuario === 'premium';
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [tarefasEmAndamento, setTarefasEmAndamento] = useState([]);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });
  const [loading, setLoading] = useState(true);

  // 1. BUSCA INSTITUIÇÕES (E corrige a memória do navegador)
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

  // 2. BUSCA TODOS OS DADOS (Kanban, IA, Tarefas Futuras)
  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      
      // Reseta os visores enquanto carrega a nova escola
      setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 }); 
      setMetricasIA({ total: 0, originais: 0, percentual: 0 });
      setTarefasEmAndamento([]);
      
      try {
        // Busca Turmas
        const qTurmas = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapT = await getDocs(qTurmas);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);
          
          // Busca Tarefas (Para o Radar)
          const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTarefas = await getDocs(qTarefas);
          const agora = new Date();
          
          const ativas = snapTarefas.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(t => t.status !== 'lixeira' && tIds.includes(t.turmaId) && t.dataFim)
            .map(t => {
              const dataF = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
              const diasRestantes = Math.ceil((dataF.getTime() - agora.getTime()) / (1000 * 3600 * 24));
              return { ...t, diasRestantes };
            })
            .filter(t => t.diasRestantes >= 0)
            .sort((a, b) => a.diasRestantes - b.diasRestantes)
            .slice(0, 3); // Pega só as 3 mais próximas
            
          setTarefasEmAndamento(ativas);

          // Busca Atividades (Para o Kanban e Termômetro)
          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtiv = await getDocs(qAtiv);
          
          let p = 0, f = 0, ok = 0;
          let iaTotal = 0, iaOriginais = 0;

          snapAtiv.docs.forEach(doc => {
            const d = doc.data();
            if (tIds.includes(d.turmaId)) {
              // Contagem Kanban
              if (d.postado === true) ok++; 
              else if (d.status === 'aprovado') f++;  
              else p++;  

              // Contagem Termômetro IA (Só conta se foi aprovado e se tinha sugestão da IA)
              const isAprovado = d.status === 'aprovado' || d.postado === true;
              const temSugerido = d.feedbackSugerido && String(d.feedbackSugerido).trim() !== '';
              
              if (isAprovado && temSugerido) {
                iaTotal++;
                const feedbackFinal = d.feedbackFinal ? String(d.feedbackFinal).trim() : '';
                const feedbackSugerido = String(d.feedbackSugerido).trim();
                
                if (feedbackFinal === feedbackSugerido) iaOriginais++;
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

  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  if (loading) return <div className="p-20 text-center font-bold">Carregando Estação...</div>;

  if (!escolaSelecionada) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><LayoutDashboard size={32} /></div>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Bem-vindo(a)!</h1>
        <p className="text-gray-500 mt-2 text-lg">Você ainda não possui instituições ativas.</p>
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

      {minhasTurmas.length === 0 ? (
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto">
          <Building2 className="mx-auto text-blue-400 mb-4" size={48}/>
          <h2 className="text-xl font-black text-blue-900 mb-2">Quase lá!</h2>
          <p className="text-blue-700 font-medium mb-6">A migração criou a base, mas você precisa entrar na aba "Turmas" para conferir se está tudo certo.</p>
          <Link to="/turmas" className="inline-flex bg-blue-600 text-white font-black py-3 px-8 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Ir para Turmas</Link>
        </div>
      ) : (
        <>
          {/* PAINEL DE SITUAÇÃO DO CURSO */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
            <div className="flex gap-4 items-start w-full">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shrink-0 shadow-inner">
                <Calendar size={24} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-white mb-2 tracking-wide">Ponto de Situação do Curso</h2>
                <div className="space-y-1.5 text-sm font-medium text-slate-300">
                  <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Base Migrada Ativa na V3</p>
                  <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Instituição: <span className="text-white">{escolaSelecionada.nome}</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* TERMÔMETRO DA IA (Mostra se tiver dados) */}
          {mostrarRevisao && metricasIA.total > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-6 shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl shrink-0"><Sparkles size={28} className="text-purple-100" /></div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-white tracking-wide">Termômetro da IA</h2>
                  <p className="text-purple-200 text-sm font-medium mt-0.5">Porcentagem de feedbacks aprovados sem NENHUMA alteração.</p>
                </div>
              </div>
              <div className="text-left md:text-right shrink-0">
                <span className="block text-4xl md:text-5xl font-black text-white tracking-tighter">{metricasIA.percentual}%</span>
                <span className="text-purple-200 text-xs font-bold uppercase tracking-wider">{metricasIA.originais} de {metricasIA.total} originais</span>
              </div>
            </div>
          )}

          {/* GRID DO KANBAN */}
          <div className={`grid grid-cols-1 gap-6 mb-10 ${isAdmin ? 'md:grid-cols-3' : (mostrarRevisao ? 'md:grid-cols-2 max-w-4xl' : 'max-w-md mx-auto')}`}>
            {mostrarRevisao && (
              <div className="bg-white border-2 border-yellow-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xs font-black text-yellow-600 uppercase tracking-widest">Aguardando Revisão</h3>
                  <div className="bg-yellow-50 p-2 rounded-lg"><Clock className="text-yellow-500" size={24}/></div>
                </div>
                <span className="text-6xl font-black text-gray-800">{kanban.pendentes}</span>
                <Link to="/aguardandorevisao" className="mt-6 text-xs font-bold text-yellow-600 flex items-center gap-1 hover:underline">Ver lista <ChevronRight size={14}/></Link>
              </div>
            )}

            {isAdmin && (
              <div className="bg-white border-2 border-blue-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest">Aguardando Postar</h3>
                  <div className="bg-blue-50 p-2 rounded-lg"><Send className="text-blue-500" size={24}/></div>
                </div>
                <span className="text-6xl font-black text-gray-800">{kanban.faltaLancar}</span>
                <Link to="/faltapostar" className="mt-6 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">Copiar p/ Site <ChevronRight size={14}/></Link>
              </div>
            )}

            <div className="bg-white border-2 border-green-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xs font-black text-green-600 uppercase tracking-widest">Histórico Finalizado</h3>
                <div className="bg-green-50 p-2 rounded-lg"><CheckCheck className="text-green-500" size={24}/></div>
              </div>
              <span className="text-6xl font-black text-gray-800">{finalizadosVisor}</span>
              <Link to="/historico" className="mt-6 text-xs font-bold text-green-600 flex items-center gap-1 hover:underline">Ver histórico <ChevronRight size={14}/></Link>
            </div>
          </div>

          {/* RADAR DE TAREFAS (Se houver tarefas) */}
          {tarefasEmAndamento.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm">
              <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">Gestão à Vista: Foco Atual</h2>
              <div className="space-y-4">
                {tarefasEmAndamento.map(t => (
                  <div key={t.id} className="bg-orange-50/50 border border-orange-100 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-800">{t.nomeTarefa}</h4>
                      <p className="text-sm text-gray-500 mt-1">Faltam {t.diasRestantes} dias para o encerramento.</p>
                    </div>
                    <Link to="/tarefas" className="bg-white border shadow-sm px-4 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">Ver Tarefa</Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}
