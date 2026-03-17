import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
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

  // ESTADOS DO NOVO ONBOARDING (PASSO 1 INLINE)
  const [showFormNova, setShowFormNova] = useState(false);
  const [nomeNovaInst, setNomeNovaInst] = useState('');
  const [criandoInst, setCriandoInst] = useState(false);

  // 1. BUSCA TODAS AS INSTITUIÇÕES PARA O ONBOARDING
  useEffect(() => {
    async function fetchInst() {
      if (!currentUser) return;
      try {
        const instRef = collection(db, 'instituicoes');
        const snap = await getDocs(instRef);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setInstituicoes(lista);
        
        if (lista.length === 0) {
          setEscolaSelecionada(null);
        } else {
          const escolaAindaExiste = escolaSelecionada && lista.find(i => i.id === escolaSelecionada.id);
          if (escolaSelecionada && !escolaAindaExiste) setEscolaSelecionada(null);
        }
      } catch (e) {
        console.error("Erro ao buscar instituições:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchInst();
  }, [currentUser, setEscolaSelecionada, escolaSelecionada]);

  // 2. BUSCA DADOS DA INSTITUIÇÃO SELECIONADA (COM TRAVA DE QUINTAL PRIVADO)
  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id || instituicoes.length === 0) {
        setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
        setMinhasTurmas([]);
        return;
      }
      
      try {
        // 🔥 A MÁGICA DA BIFURCAÇÃO: Busca APENAS as turmas deste professor (ou todas se for admin)
        const turmasRef = collection(db, 'turmas');
        const qTurmas = isAdmin 
            ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
            : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
            
        const snapT = await getDocs(qTurmas);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);
          
          // Verifica se existem alunos NAS TURMAS DELE
          const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAlunos = await getDocs(qAlunos);
          const alunosVivos = snapAlunos.docs.filter(d => d.data().status !== 'lixeira' && tIds.includes(d.data().turmaId));
          setTemAlunos(alunosVivos.length > 0);

          // Verifica se existem tarefas NAS TURMAS DELE
          const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTarefas = await getDocs(qTarefas);
          const tarefasVivas = snapTarefas.docs.map(d => ({id: d.id, ...d.data()})).filter(t => t.status !== 'lixeira' && tIds.includes(t.turmaId));
          setTemTarefasGeral(tarefasVivas.length > 0);

          const hoje = new Date();
          const hojeTime = hoje.getTime();

          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtiv = await getDocs(qAtiv);

          let p = 0, f = 0, ok = 0;
          let iaTotal = 0, iaOriginais = 0;
          let progressoLocal = {};

          const docRefUser = doc(db, 'usuarios', currentUser.uid);
          const docSnapUser = await getDoc(docRefUser);
          const dataUser = docSnapUser.data();
          const timestampPrompt = dataUser?.timestampPrompt || 0;

          snapAtiv.docs.forEach(doc => {
            const d = doc.data();
            if (tIds.includes(d.turmaId)) {
              // Trava anti-falsos positivos (Ignora alunos não selecionados em tarefas restritas)
              const tarefaPai = tarefasVivas.find(t => t.id === d.tarefaId);
              const tarefaRestrita = tarefaPai?.alunosSelecionados && tarefaPai.alunosSelecionados.length > 0;
              if (tarefaRestrita && !tarefaPai.alunosSelecionados.includes(d.alunoId)) return;

              const jaPostado = d.postado === true || d.status === 'finalizado' || d.status === 'postado';
              const jaAprovado = d.status === 'aprovado' || d.status === 'revisado';
              const temResposta = (d.resposta && String(d.resposta).trim() !== '') || !!d.arquivoUrl;

              if (jaPostado) { ok++; progressoLocal[d.tarefaId] = true; }
              else if (jaAprovado) { f++; progressoLocal[d.tarefaId] = true; }
              else if (temResposta) { p++; progressoLocal[d.tarefaId] = true; }

              const dataAvaliacao = d.dataAprovacao || d.dataPostagem || d.dataModificacao || d.dataCriacao;
              const timeAvaliacao = dataAvaliacao ? (dataAvaliacao.toDate ? dataAvaliacao.toDate().getTime() : new Date(dataAvaliacao).getTime()) : 0;
              const ehDessaTemporada = timestampPrompt > 0 ? (timeAvaliacao >= timestampPrompt) : true;

              const fFinal = (d.feedbackFinal || "").trim();
              const fSugerido = (d.feedbackSugerido || d.feedbackIA || "").trim();
              if ((jaAprovado || jaPostado) && fSugerido !== "" && ehDessaTemporada) {
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
            const startRaw = t.dataInicio || t.data_inicio || t.dataCriacao;
            const startObj = startRaw ? (startRaw.toDate ? startRaw.toDate() : new Date(startRaw)) : new Date();
            const timeInicio = startObj.getTime();
            
            const referenceTime = timeInicio > hojeTime ? timeInicio : end.getTime();
            const diasRestantes = Math.ceil((referenceTime - hojeTime) / (1000 * 3600 * 24));
            
            return { 
                id: t.id, 
                nomeTarefa: t.nomeTarefa || t.titulo, 
                diasRestantes: diasRestantes,
                isFutura: timeInicio > hojeTime 
            };
          }).sort((a,b) => (a.isFutura === b.isFutura) ? (a.diasRestantes - b.diasRestantes) : (a.isFutura ? 1 : -1));

          setTarefasEmAndamento(agenda.filter(t => t.diasRestantes >= 0 || !t.isFutura).slice(0, 5));
        } else {
          // Se o professor não tem turmas, zera os indicadores complementares para forçar a barra de progresso
          setTemAlunos(false);
          setTemTarefasGeral(false);
        }
      } catch (e) { console.error("Erro ao carregar dados do dashboard:", e); }
    }
    fetchDados();
  }, [escolaSelecionada, instituicoes, currentUser, isAdmin]);

  async function handleCriarInstituicao(e) {
    e.preventDefault();
    if (!nomeNovaInst.trim() || criandoInst) return;
    setCriandoInst(true);
    try {
      const docRef = await addDoc(collection(db, 'instituicoes'), {
        nome: nomeNovaInst.trim(),
        professorUid: currentUser.uid,
        professorEmail: currentUser.email,
        dataCriacao: serverTimestamp(),
        status: 'ativa'
      });
      const novaInst = { id: docRef.id, nome: nomeNovaInst.trim() };
      setInstituicoes(prev => [...prev, novaInst].sort((a,b) => a.nome.localeCompare(b.nome)));
      setEscolaSelecionada(novaInst);
      localStorage.setItem('@SaaS_EscolaSelecionada', JSON.stringify(novaInst));
      setShowFormNova(false);
      setNomeNovaInst('');
    } catch (err) { console.error(err); } finally { setCriandoInst(false); }
  }

  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);
  
  // LÓGICA DE PASSOS DO ONBOARDING
  let passoAtual = 5;
  if (!escolaSelecionada?.id || instituicoes.length === 0) passoAtual = 1;
  else if (minhasTurmas.length === 0) passoAtual = 2;
  else if (!temAlunos) passoAtual = 3;
  else if (!temTarefasGeral) passoAtual = 4;

  // A BARRA DE PROGRESSO GLOBAL GUIADA
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

  // CASO 1: SEM INSTITUIÇÃO (ONBOARDING INLINE TOTALMENTE GUIADO)
  if (!escolaSelecionada?.id || instituicoes.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center animate-in fade-in duration-700">
        {renderBarraProgresso()}
        
        <div className="bg-white border border-gray-200 p-8 md:p-12 rounded-[40px] shadow-2xl max-w-lg mx-auto mt-10">
           <School size={56} className="mx-auto text-blue-600 mb-6" />
           <h1 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">Onde você ensina?</h1>
           <p className="text-gray-500 font-medium mb-8 text-lg leading-relaxed">
             Selecione sua instituição para acessar turmas já criadas por colegas, ou cadastre uma nova.
           </p>
           
           <div className="space-y-4 text-left">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Instituições Cadastradas</label>
              <select 
                 className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-gray-700 outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                 defaultValue=""
                 onChange={(e) => {
                    if (e.target.value === 'nova') {
                        setShowFormNova(true);
                    } else if (e.target.value !== '') {
                        const inst = instituicoes.find(i => i.id === e.target.value);
                        setEscolaSelecionada(inst);
                        localStorage.setItem('@SaaS_EscolaSelecionada', JSON.stringify(inst));
                    }
                 }}
              >
                 <option value="" disabled>Selecione na lista...</option>
                 {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                 <option disabled>──────────</option>
                 <option value="nova">+ Cadastrar Nova Instituição</option>
              </select>

              {showFormNova && (
                 <form onSubmit={handleCriarInstituicao} className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in slide-in-from-top-4 duration-300">
                    <input 
                      autoFocus required placeholder="Nome da nova instituição..." 
                      className="w-full p-4 bg-white border-2 border-blue-200 rounded-2xl font-bold outline-none focus:border-blue-500 mb-3 text-gray-800"
                      value={nomeNovaInst} onChange={e => setNomeNovaInst(e.target.value)}
                    />
                    <button disabled={criandoInst} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">{criandoInst ? 'Criando...' : 'Salvar Instituição'}</button>
                    <button type="button" onClick={() => setShowFormNova(false)} className="w-full mt-2 py-2 text-sm font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                 </form>
              )}
           </div>
        </div>
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

      {/* A BARRA DE PROGRESSO DEVE ESTAR VISÍVEL ENQUANTO ELE NÃO CHEGAR AO PASSO 5 */}
      {passoAtual <= 4 && renderBarraProgresso()}

      {minhasTurmas.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12 animate-in zoom-in-95 duration-500">
          <div className="bg-blue-50 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Building2 size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Excelente! A instituição foi vinculada.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">O próximo passo é configurar sua primeira turma para gerenciar os alunos.</p>
          
          <div className="space-y-4">
            <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl hover:bg-blue-700 transition-all text-lg">
              Passo 2: Configurar Turma <ChevronRight size={18}/>
            </Link>
            <div className="flex items-center justify-center gap-2 text-purple-600 font-bold text-sm animate-pulse mt-4">
              <Sparkles size={16}/>
              <span>Dica: Você poderá "Copiar turma existente" neste passo!</span>
            </div>
          </div>
        </div>
      ) : 

      !temAlunos ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12 animate-in zoom-in-95 duration-500">
          <div className="bg-orange-50 text-orange-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><UserPlus size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Turma configurada! Mas e os alunos?</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Uma sala de aula não funciona sem eles. Vamos adicionar a lista de alunos para que eles possam receber as atividades.</p>
          <Link to="/alunos" className="inline-flex items-center gap-2 bg-orange-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all">
            Passo 3: Cadastrar Alunos <ChevronRight size={18}/>
          </Link>
        </div>
      ) : 

      !temTarefasGeral ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12 animate-in zoom-in-95 duration-500">
          <div className="bg-purple-50 text-purple-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><FileText size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Tudo pronto! Vamos ao trabalho.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">Sua turma já tem alunos cadastrados. Que tal lançar o seu primeiro desafio ou atividade para eles?</p>
          <Link to="/tarefas" className="inline-flex items-center gap-2 bg-purple-600 text-white font-black py-3.5 px-8 rounded-xl shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all">
            Passo 4: Criar Tarefa <ChevronRight size={18}/>
          </Link>
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
          
          <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white border border-slate-800 shadow-xl">
             <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-600 p-2.5 rounded-xl"><Calendar size={22} /></div>
                <h2 className="text-xl font-black tracking-tight">Próximas Entregas do Cronograma</h2>
             </div>
             <div className="space-y-3">
                {tarefasEmAndamento.length > 0 ? (
                  tarefasEmAndamento.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl border border-slate-700/50 transition-colors">
                      <span className="font-bold text-slate-200 truncate pr-4">{t.nomeTarefa}</span>
                      <span className="text-[11px] font-black uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 shrink-0">Faltam {t.diasRestantes} dias</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 font-medium italic p-4 text-center">Nenhuma tarefa ativa no momento.</p>
                )}
             </div>
          </div>
        </>
      )}
    </div>
  );
}
