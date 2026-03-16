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

  // 1. BUSCA INSTITUIÇÕES E ESTABELECE O ESTADO INICIAL
  useEffect(() => {
    async function fetchInst() {
      if (!currentUser) return;
      try {
        const instRef = collection(db, 'instituicoes');
        const q = isAdmin ? instRef : query(instRef, where('professorUid', '==', currentUser.uid));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setInstituicoes(lista);
        
        // Regra de Ouro: Se a lista está vazia, o estado global deve ser null para forçar o onboarding
        if (lista.length === 0) {
          setEscolaSelecionada(null);
        } else {
          const escolaAindaExiste = escolaSelecionada && lista.find(i => i.id === escolaSelecionada.id);
          if (!escolaAindaExiste) setEscolaSelecionada(lista[0]);
        }
      } catch (e) {
        console.error("Erro ao buscar instituições:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchInst();
  }, [currentUser, isAdmin, setEscolaSelecionada]);

  // 2. BUSCA DADOS DA INSTITUIÇÃO SELECIONADA
  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id || instituicoes.length === 0) {
        setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
        setMinhasTurmas([]);
        return;
      }
      
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

          snapAtiv.docs.forEach(doc => {
            const d = doc.data();
            if (tIds.includes(d.turmaId)) {
              const jaPostado = d.postado === true || d.status === 'finalizado' || d.status === 'postado';
              const jaAprovado = d.status === 'aprovado' || d.status === 'revisado';
              const temResposta = (d.resposta && String(d.resposta).trim() !== '') || !!d.arquivoUrl;

              if (jaPostado) { ok++; progressoLocal[d.tarefaId] = true; }
              else if (jaAprovado) { f++; progressoLocal[d.tarefaId] = true; }
              else if (temResposta) { p++; progressoLocal[d.tarefaId] = true; }

              const fFinal = (d.feedbackFinal || "").trim();
              const fSugerido = (d.feedbackSugerido || "").trim();
              if ((jaAprovado || jaPostado) && fSugerido !== "") {
                iaTotal++;
                if (fFinal === fSugerido) iaOriginais++;
              }
            }
          });

          setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0 });
          setProgressoTarefas(progressoLocal);

          const agenda = tarefasVivas.filter(t => t.dataFim).map(t => {
            const end = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
            return { id: t.id, nomeTarefa: t.nomeTarefa || t.titulo, reference: end.getTime(), diasRestantes: Math.ceil((end.getTime() - hojeTime) / (1000 * 3600 * 24)) };
          }).sort((a,b) => a.diasRestantes - b.diasRestantes);
          setTarefasEmAndamento(agenda.filter(t => t.diasRestantes >= 0).slice(0, 5));
        }
      } catch (e) { console.error("Erro ao carregar dados do dashboard:", e); }
    }
    fetchDados();
  }, [escolaSelecionada, instituicoes]);

  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);
  
  // LÓGICA DE PASSOS DO ONBOARDING
  let passoAtual = 5; 
  if (!escolaSelecionada?.id || instituicoes.length === 0) passoAtual = 1;
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
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-blue-600 rounded-full z-0 transition-all duration-700 ease-out" style={{ width: `${porcentagem}%` }}></div>
          {passos.map(passo => (
            <div key={passo.id} className="relative z-10 flex flex-col items-center group">
              <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all duration-500 ${passo.id < passoAtual ? "bg-green-500 border-green-500 text-white" : passo.id === passoAtual ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30" : "bg-white border-gray-200 text-gray-400"}`}>
                {passo.id < passoAtual ? <CheckCheck size={20} /> : passo.icone}
              </div>
              <span className={`absolute -bottom-7 text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap transition-colors ${passo.id < passoAtual ? "text-green-600 font-bold" : passo.id === passoAtual ? "text-blue-700 font-black" : "text-gray-400 font-medium"}`}>{passo.titulo}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center font-bold text-gray-400 animate-pulse">Sincronizando ambiente...</div>;

  // CASO 1: SEM INSTITUIÇÃO (VOLTA À ESTACA ZERO)
  if (!escolaSelecionada?.id || instituicoes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center animate-in fade-in duration-700">
        {renderBarraProgresso()}
        <div className="bg-blue-600 text-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 mt-16 shadow-2xl shadow-blue-600/30">
          <School size={48} />
        </div>
        <h1 className="text-4xl font-black text-gray-800 tracking-tight mb-4">Bem-vindo(a) ao seu novo painel!</h1>
        <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto font-medium">Para começarmos a organizar sua vida acadêmica, o primeiro passo é nos dizer onde você ensina.</p>
        <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl hover:bg-blue-700 hover:-translate-y-1 transition-all text-lg">
          Passo 1: Criar Instituição <ChevronRight size={20}/>
        </Link>
      </div>
    );
  }

  // CASO 2: TELA PRINCIPAL (DASHBOARD)
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-200 pb-6 gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2 max-w-full">
            <span className="text-sm font-bold text-gray-500 shrink-0">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg border-none outline-none cursor-pointer shadow-inner truncate max-w-[220px] sm:max-w-md" 
              value={escolaSelecionada?.id || ''} 
              onChange={e => {
                if (e.target.value === 'nova_instituicao') navigate('/turmas', { state: { abrirModalInstituicao: true } });
                else setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value));
              }}
            >
              {instituicoes.map(i => (
                <option key={i.id} value={i.id} className="truncate">
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
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12 animate-in zoom-in-95 duration-500">
          <div className="bg-blue-50 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Building2 size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Excelente! A instituição foi criada.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">O próximo passo é criar sua primeira turma para gerenciar os alunos.</p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Passo 2: Criar Turma <ChevronRight size={18}/></Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            <div className="bg-white border border-yellow-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-black text-yellow-600 uppercase tracking-widest mt-1">Aguardando Revisão</h3>
                <div className="text-yellow-500 bg-yellow-50 p-1.5 rounded-lg"><Clock size={20}/></div>
              </div>
              <span className="text-4xl font-black text-gray-800">{kanban.pendentes}</span>
              <Link to="/aguardandorevisao" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver lista <ChevronRight size={14}/></Link>
            </div>
            
            <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">Aguardando Postar</h3>
                <div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg"><Send size={20}/></div>
              </div>
              <span className="text-4xl font-black text-gray-800">{kanban.faltaLancar}</span>
              <Link to="/faltapostar" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Copiar p/ Site <ChevronRight size={14}/></Link>
            </div>
            
            <div className="bg-white border border-green-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-black text-green-600 uppercase tracking-widest mt-1">Histórico Finalizado</h3>
                <div className="text-green-500 bg-green-50 p-1.5 rounded-lg"><CheckCheck size={20}/></div>
              </div>
              <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
              <Link to="/historico" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver histórico <ChevronRight size={14}/></Link>
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white border border-slate-800">
             <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-600 p-2.5 rounded-xl"><Calendar size={22} /></div>
                <h2 className="text-xl font-black tracking-tight">Próximas Entregas do Cronograma</h2>
             </div>
             <div className="space-y-3">
                {tarefasEmAndamento.length > 0 ? (
                  tarefasEmAndamento.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl border border-slate-700/50 transition-colors">
                      <span className="font-bold text-slate-200">{t.nomeTarefa}</span>
                      <span className="text-[11px] font-black uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">Faltam {t.diasRestantes} dias</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 font-medium italic p-4">Nenhuma tarefa ativa no momento.</p>
                )}
             </div>
          </div>
        </>
      )}
    </div>
  );
}
