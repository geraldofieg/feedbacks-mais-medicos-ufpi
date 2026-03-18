import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, ChevronRight, Calendar, Sparkles, Building2, School, UserPlus, FileText, AlertTriangle, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate(); 
  
  // 🔥 SEGURANÇA PROFISSIONAL: Sem e-mail no código
  const isAdmin = userProfile?.role === 'admin';
  
  const planoUsuario = (userProfile?.plano || 'basico').toLowerCase().trim();
  const isTier1 = planoUsuario === 'basico' || planoUsuario === 'trial';
  const isTier2 = planoUsuario === 'intermediario';
  const isTier3 = planoUsuario === 'premium';

  const mostrarFaltaPostar = isAdmin || isTier1 || isTier3; 
  const mostrarTermometroIA = isAdmin || isTier3;

  const [instituicoes, setInstituicoes] = useState([]);
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [tarefasEmAndamento, setTarefasEmAndamento] = useState([]);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });
  const [temAlunos, setTemAlunos] = useState(true); 
  const [temTarefasGeral, setTemTarefasGeral] = useState(true);
  const [gestaoVista, setGestaoVista] = useState({ atuais: [], anteriores: [] });
  const [loadingInst, setLoadingInst] = useState(true);
  const [loadingDados, setLoadingDados] = useState(false);

  const radarExecutado = useRef(false);

  // 🔥 CORREÇÃO DO ERRO: Definição da variável que faltava
  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  useEffect(() => {
    if (!currentUser || radarExecutado.current) return;
    async function setupRadarGlobal() {
      radarExecutado.current = true; 
      try {
        const instRef = collection(db, 'instituicoes');
        const snap = await getDocs(instRef);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setInstituicoes(lista);
        if (lista.length === 0) { setLoadingInst(false); return; }
        const escolaCache = JSON.parse(localStorage.getItem('@SaaS_EscolaSelecionada'));
        if (escolaCache && lista.some(i => i.id === escolaCache.id)) {
            setEscolaSelecionada(escolaCache);
        } else if (lista.length > 0) {
            setEscolaSelecionada(lista[0]);
        }
      } catch (e) { console.error(e); } finally { setLoadingInst(false); }
    }
    setupRadarGlobal();
  }, [currentUser]);

  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      setLoadingDados(true); 
      try {
        const tRef = collection(db, 'turmas');
        const qT = isAdmin ? query(tRef, where('instituicaoId', '==', escolaSelecionada.id)) : query(tRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapT = await getDocs(qT);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);
          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtiv = await getDocs(qAtiv);
          const activities = snapAtiv.docs.map(d => d.data()).filter(a => a.status !== 'lixeira' && tIds.includes(a.turmaId));
          
          let p = 0, f = 0, ok = 0;
          let iaTotal = 0, iaOriginais = 0;

          activities.forEach(d => {
            if (d.postado) ok++; else if (d.status === 'aprovado') f++; else if (d.resposta) p++;
            // Lógica do termômetro IA
            if ((d.status === 'aprovado' || d.postado) && (d.feedbackSugerido || d.feedbackIA)) {
               iaTotal++;
               if (d.feedbackFinal === (d.feedbackSugerido || d.feedbackIA)) iaOriginais++;
            }
          });
          setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: iaTotal > 0 ? Math.round((iaOriginais/iaTotal)*100) : 0 });

          const qTar = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTar = await getDocs(qTar);
          const hoje = new Date().getTime();
          const tarefasVivas = snapTar.docs.map(d => {
            const data = d.data();
            const timeFim = data.dataFim?.toDate ? data.dataFim.toDate().getTime() : 0;
            return { id: d.id, ...data, diasRestantes: Math.ceil((timeFim - hoje) / (1000 * 3600 * 24)) };
          }).filter(t => t.status !== 'lixeira' && tIds.includes(t.turmaId) && t.diasRestantes >= 0);
          
          setTarefasEmAndamento(tarefasVivas.sort((a,b) => a.diasRestantes - b.diasRestantes).slice(0, 5));
        }
      } catch (e) { console.error(e); } finally { setLoadingDados(false); } 
    }
    fetchDados();
  }, [escolaSelecionada, currentUser, isAdmin]);

  if (loadingInst || loadingDados) return <div className="p-20 text-center font-bold text-gray-400 animate-pulse">Sincronizando ambiente...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-200 pb-6 gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2 max-w-full">
            <span className="text-sm font-bold text-gray-500 shrink-0">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer truncate max-w-[220px] sm:max-w-md" value={escolaSelecionada?.id || ''} onChange={e => setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value))}>
              {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl py-3 px-4 md:py-4 md:px-5 text-white border border-slate-800 shadow-xl mb-6">
         <div className="flex items-center gap-2.5 mb-3">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Calendar size={16} /></div>
            <h2 className="text-base font-black tracking-tight">Tarefas em andamento</h2>
         </div>
         <div className="space-y-2">
            {tarefasEmAndamento.length > 0 ? (
              tarefasEmAndamento.map(t => (
                <div key={t.id} className="flex justify-between items-center px-4 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></div>
                    <span className="text-sm font-bold text-slate-200 truncate">{t.nomeTarefa}</span>
                    <span className="text-xs font-bold text-green-400 shrink-0 ml-1">Faltam {t.diasRestantes} dias</span>
                  </div>
                  <Link to={`/revisar/${t.id}`} className="text-[10px] font-black uppercase text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-3 py-1.5 rounded-lg border border-blue-500/30 transition-all shrink-0 flex items-center gap-1">
                    Corrigir Tarefa <ChevronRight size={12}/>
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 font-medium italic p-2 text-center">Nenhuma tarefa ativa no momento.</p>
            )}
         </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${mostrarFaltaPostar ? 'lg:grid-cols-3' : ''} gap-5 mb-10`}>
        <div className="bg-white border border-yellow-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-black text-yellow-600 uppercase tracking-widest mt-1">Aguardando Revisão</h3><div className="text-yellow-500 bg-yellow-50 p-1.5 rounded-lg"><Clock size={20}/></div></div>
          <span className="text-4xl font-black text-gray-800">{kanban.pendentes}</span>
          <Link to="/aguardandorevisao" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver lista <ChevronRight size={14}/></Link>
        </div>
        
        {mostrarFaltaPostar && (
          <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">Aguardando Postar</h3><div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg"><Send size={20}/></div></div>
            <span className="text-4xl font-black text-gray-800">{kanban.faltaLancar}</span>
            <Link to="/faltapostar" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Copiar p/ Site <ChevronRight size={14}/></Link>
          </div>
        )}
        
        <div className="bg-white border border-green-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-black text-green-600 uppercase tracking-widest mt-1">Histórico Finalizado</h3><div className="text-green-500 bg-green-50 p-1.5 rounded-lg"><CheckCheck size={20}/></div></div>
          <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
          <Link to="/historico" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver histórico <ChevronRight size={14}/></Link>
        </div>
      </div>
    </div>
  );
}
