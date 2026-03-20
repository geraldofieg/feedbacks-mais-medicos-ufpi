import { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Clock, CheckCheck, Send, ChevronRight, Calendar, Sparkles, Building2, School, UserPlus, FileText, AlertTriangle, User, Pencil } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import OnboardingModal from '../components/OnboardingModal';
// 🔥 ADICIONADO: Importação do Tour

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate(); 
  
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
  
  const [mostrarTour, setMostrarTour] = useState(false);
// 🔥 ADICIONADO: Controle do Modal do Tour

  const radarExecutado = useRef(false);

  const finalizadosVisor = isAdmin ?
kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  useEffect(() => {
    if (!currentUser || radarExecutado.current) return;

    // 🔥 ADICIONADO: Verifica se é o primeiro acesso para mostrar o Tour
    const jaViuTour = localStorage.getItem('@SaaS_TourVisto');
    if (!jaViuTour) setMostrarTour(true);

    async function setupRadarGlobal() {
      radarExecutado.current = true; 
      try {
        const instRef = collection(db, 'instituicoes');
        const snap = await getDocs(instRef);
        const 
lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
       
        setInstituicoes(lista);

        if (lista.length === 0) {
          if (escolaSelecionada !== null) setEscolaSelecionada(null);
          setLoadingInst(false);
          return;
        }

    
    const turmasRef = collection(db, 'turmas');
        const qTurmasGlobais = isAdmin 
          ? turmasRef 
          : query(turmasRef, where('professorUid', '==', currentUser.uid));
const snapTurmas = await getDocs(qTurmasGlobais);
        const turmasGlobais = snapTurmas.docs
            .map(d => ({ ...d.data(), tsCriacao: d.data().dataCriacao?.toMillis ? d.data().dataCriacao.toMillis() : 0 }))
            .filter(t => t.status !== 'lixeira')
            .sort((a, b) => b.tsCriacao - a.tsCriacao);
const escolaCacheStr = localStorage.getItem('@SaaS_EscolaSelecionada');
        const escolaCache = escolaCacheStr ? JSON.parse(escolaCacheStr) : null;
const escolaCacheValida = escolaCache && lista.some(i => i.id === escolaCache.id);

        let escolaAlvo = null;
if (turmasGlobais.length > 0) {
            const idCerta = turmasGlobais[0].instituicaoId;
escolaAlvo = lista.find(i => i.id === idCerta) || null;
            if (escolaAlvo) localStorage.setItem('@SaaS_EscolaSelecionada', JSON.stringify(escolaAlvo));
} else {
            if (escolaCacheValida) escolaAlvo = lista.find(i => i.id === escolaCache.id);
else if (lista.length > 0) escolaAlvo = lista[0];
        }

        if (escolaAlvo) setEscolaSelecionada(escolaAlvo);
} catch (e) { console.error(e); } finally { setLoadingInst(false); }
    }
    setupRadarGlobal();
}, [currentUser, isAdmin, setEscolaSelecionada]);

  useEffect(() => {
    async function fetchDados() {
      if (!escolaSelecionada?.id) return;
      setLoadingDados(true); 
      try {
        const tRef = collection(db, 'turmas');
        const qT = isAdmin ? query(tRef, where('instituicaoId', '==', escolaSelecionada.id)) : query(tRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapT = await getDocs(qT);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() 

        })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);
          
          const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAlunos = await getDocs(qAlunos);
          const listaAlunosVivos 
= snapAlunos.docs
            .filter(d => d.data().status !== 'lixeira' && tIds.includes(d.data().turmaId))
            .map(d => ({id: d.id, nome: d.data().nome, turmaId: d.data().turmaId}));
setTemAlunos(listaAlunosVivos.length > 0);

          const docRefUser = doc(db, 'usuarios', currentUser.uid);
          const docSnapUser = await getDoc(docRefUser);
          const tsPromptRaw = docSnapUser.data()?.timestampPrompt;
const timestampPrompt = tsPromptRaw?.toDate ? tsPromptRaw.toDate().getTime() : (tsPromptRaw || 0);

          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
const snapAtiv = await getDocs(qAtiv);
          
          // 🔥 DESFRAGMENTADOR ANTI-CLONES DO DASHBOARD
          const atividadesMap = new Map();
snapAtiv.docs.forEach(d => {
            const data = d.data();
            if (data.status === 'lixeira' || !tIds.includes(data.turmaId)) return;
            
            const key = `${data.alunoId}_${data.tarefaId}`;
            const existente = atividadesMap.get(key);
            
           
 const peso = (ativ) => {
              if (ativ.postado) return 3;
              if (ativ.status === 'aprovado') return 2;
              return 1;
            };

            if (!existente || peso(data) > peso(existente)) {
             
 atividadesMap.set(key, data);
            } else if (peso(data) === peso(existente)) {
               const t1 = data.dataModificacao?.seconds || data.dataCriacao?.seconds || 0;
               const t2 = existente.dataModificacao?.seconds || existente.dataCriacao?.seconds || 0;
               if (t1 > t2) atividadesMap.set(key, data);
            }
    
      });

          const activities = Array.from(atividadesMap.values());
let p = 0, f = 0, ok = 0, iaTotal = 0, iaOriginais = 0;
activities.forEach(d => {
            const temEntregaOuRascunho = (d.resposta && String(d.resposta).trim() !== '') || d.arquivoUrl || (d.feedbackFinal && String(d.feedbackFinal).trim() !== '');

            if (d.postado) ok++; 
            else if (d.status === 'aprovado') f++; 
            else if (temEntregaOuRascunho) p++;
            
           
 const dataAvaliacao = d.dataAprovacao || d.dataPostagem || d.dataModificacao || d.dataCriacao;
            const timeAvaliacao = dataAvaliacao ? (dataAvaliacao.toDate ? dataAvaliacao.toDate().getTime() : new Date(dataAvaliacao).getTime()) : 0;
            const ehDessaTemporada = timestampPrompt > 0 ? (timeAvaliacao >= timestampPrompt) : true;

            if ((d.status === 'aprovado' || d.postado) && (d.feedbackSugerido || d.feedbackIA) && ehDessaTemporada) {
               iaTotal++;
    
           if (d.feedbackFinal === (d.feedbackSugerido || d.feedbackIA)) iaOriginais++;
            }
          });
setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0 });
const qTar = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTar = await getDocs(qTar);
          const hojeTime = new Date().getTime();
const tarefasProcessadas = snapTar.docs.map(d => {
            const data = d.data();
            const timeFim = data.dataFim?.toDate ? data.dataFim.toDate().getTime() : 0;
            const timeInicio = data.dataInicio?.toDate ? data.dataInicio.toDate().getTime() : 0;
            const timeCriacao = data.dataCriacao?.toDate ? data.dataCriacao.toDate().getTime() : (data.dataCriacao?.seconds ? data.dataCriacao.seconds * 1000 : 0);
            
     
       return { 
              id: d.id, 
              ...data, 
              timeFim,
              timeInicio,
              timeCriacao,
              isFutura: timeInicio > hojeTime,
 
             isPassada: timeFim > 0 && timeFim < hojeTime,
              diasRestantes: Math.ceil((timeFim - hojeTime) / (1000 * 3600 * 24)) 
            };
          }).filter(t => t.status !== 'lixeira' && tIds.includes(t.turmaId));
const tarefasAtivas = tarefasProcessadas.filter(t => !t.isFutura && !t.isPassada);
          setTarefasEmAndamento(tarefasAtivas.sort((a,b) => a.diasRestantes - b.diasRestantes).slice(0, 5));
const calcularDevedores = (tarefa) => {
            let alvo = listaAlunosVivos.filter(a => a.turmaId === tarefa.turmaId);
if (tarefa.atribuicaoEspecifica) alvo = alvo.filter(a => tarefa.alunosSelecionados?.includes(a.id));
            
            const devedores = alvo.filter(aluno => !activities.find(e => e.tarefaId === tarefa.id && e.alunoId === aluno.id && ((e.resposta && String(e.resposta).trim() !== '') || e.arquivoUrl || (e.feedbackFinal && String(e.feedbackFinal).trim() !== ''))));
return { id: tarefa.id, nome: tarefa.nomeTarefa || tarefa.titulo, devedores: devedores.map(d => d.nome).sort() };
          };
const corteCriacao = new Date(2026, 0, 4, 0, 0, 0).getTime();
setGestaoVista({
            atuais: tarefasAtivas.map(calcularDevedores).filter(gv => gv.devedores.length > 0),
            anteriores: tarefasProcessadas
              .filter(t => t.isPassada && t.timeCriacao >= corteCriacao)
              .sort((a,b) => b.timeFim - a.timeFim)
              .map(calcularDevedores)
              .filter(gv => gv.devedores.length > 
0)
              .slice(0, 4) 
          });
}
      } catch (e) { console.error(e); } finally { setLoadingDados(false);
} 
    }
    fetchDados();
  }, [escolaSelecionada, currentUser, isAdmin]);

  if (loadingInst || loadingDados) return <div className="p-20 text-center font-bold text-gray-400 animate-pulse">Sincronizando ambiente...</div>;

  // 🔥 LÓGICA DO BANNER DE ALERTA DE ASSINATURA (OPÇÃO 3)
  let bannerAssinatura = null;
  if (userProfile && !userProfile.isVitalicio && userProfile.dataExpiracao) {
    const dVenc = userProfile.dataExpiracao.toDate ? userProfile.dataExpiracao.toDate() : new Date(userProfile.dataExpiracao.seconds ? userProfile.dataExpiracao.seconds * 1000 : userProfile.dataExpiracao);
    const diff = Math.ceil((dVenc - new Date()) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) {
      bannerAssinatura = (
        <div className="bg-red-50 border border-red-200 p-4 mb-8 rounded-2xl shadow-sm flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-sm font-black text-red-800 uppercase tracking-widest">Atenção: Assinatura Vencida</h3>
            <p className="text-sm font-medium text-red-700 mt-1">Seu período de acesso encerrou há {Math.abs(diff)} dias. Regularize sua assinatura para não perder o acesso às suas turmas.</p>
          </div>
        </div>
      );
    } else if (diff <= 5) {
      bannerAssinatura = (
        <div className="bg-orange-50 border border-orange-200 p-4 mb-8 rounded-2xl shadow-sm flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="text-orange-600 shrink-0 mt-0.5" size={24} />
          <div>
            <h3 className="text-sm font-black text-orange-800 uppercase tracking-widest">Atenção: Assinatura Expirando</h3>
            <p className="text-sm font-medium text-orange-700 mt-1">Seu período de acesso encerra em {diff} dias. Renove agora para não perder o acesso contínuo à plataforma.</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 overflow-hidden">
      
      {/* 🔥 RENDERIZAÇÃO DO BANNER ADICIONADA AQUI */}
      {bannerAssinatura}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-200 pb-6 gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <div className="flex items-center gap-2 mt-2 max-w-full">
            <span className="text-sm font-bold text-gray-500 shrink-0">Instituição:</span>
            <select className="bg-blue-50 text-blue-700 font-bold px-3 
py-1.5 rounded-lg border-none outline-none cursor-pointer truncate max-w-[220px] sm:max-w-md" value={escolaSelecionada?.id || ''} onChange={e => setEscolaSelecionada(instituicoes.find(i => i.id === e.target.value))}>
              {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {minhasTurmas.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-3xl text-center max-w-2xl mx-auto shadow-sm mt-12">
 

          <div className="bg-blue-50 text-blue-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Building2 size={40}/></div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Excelente!
A instituição foi vinculada.</h2>
          <p className="text-gray-500 font-medium mb-8 text-lg">O próximo passo é configurar sua primeira turma.</p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-2xl shadow-xl hover:bg-blue-700 transition-all text-lg">Passo 2: Configurar Turma <ChevronRight size={18}/></Link>
        </div>
      ) : (
        <>
          <div className="bg-slate-900 rounded-2xl py-3 px-4 md:py-4 md:px-5 text-white border border-slate-800 shadow-xl mb-8">
  

            <div className="flex items-center gap-2.5 mb-3">
                <div className="bg-blue-600 p-1.5 rounded-lg"><Calendar size={16} /></div>
                <h2 className="text-base font-black tracking-tight">Tarefas em andamento</h2>
             </div>
             <div className="space-y-2">
               
 
                {tarefasEmAndamento.length > 0 ? (
                  tarefasEmAndamento.map(t => (
                    <div key={t.id} className="flex justify-between items-center px-4 py-2 bg-slate-800/40 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-colors group">
                      <div className="flex items-center gap-3 
min-w-0 flex-1 pr-2">
               
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)] shrink-0"></div>
                        <span className="text-sm font-bold text-slate-200 truncate" title={t.nomeTarefa}>{t.nomeTarefa}</span>
                       
 <span className="text-xs font-black text-green-500 shrink-0 whitespace-nowrap">Faltam {t.diasRestantes} dias</span>
                      </div>
  
                      <Link to={`/revisar/${t.id}`} className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white transition-all shrink-0 ml-2" title="Corrigir Tarefa">
                        <Pencil size={16} />
      
                 </Link>
                  
                    </div>
                  ))
                ) : (
          
         <p className="text-sm text-slate-500 font-medium italic p-2 text-center">Nenhuma tarefa ativa no cronograma.</p>
                )}
             </div>
     
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 ${mostrarFaltaPostar ?
'lg:grid-cols-3' : ''} gap-5 mb-10`}>
            <div className="bg-white border border-yellow-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-black text-yellow-600 uppercase mt-1">Aguardando Revisão</h3><div className="text-yellow-500 bg-yellow-50 p-1.5 rounded-lg"><Clock size={20}/></div></div>
              <span className="text-4xl font-black text-gray-800">{kanban.pendentes}</span>
              <Link to="/aguardandorevisao" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver lista <ChevronRight size={14}/></Link>
   

            </div>
            {mostrarFaltaPostar && (
              <div className="bg-white border border-blue-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-black text-blue-600 uppercase mt-1">Aguardando Postar</h3><div className="text-blue-500 bg-blue-50 p-1.5 rounded-lg"><Send size={20}/></div></div>
                <span className="text-4xl font-black text-gray-800">{kanban.faltaLancar}</span>
  
   
                <Link to="/faltapostar" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Copiar p/ Site <ChevronRight size={14}/></Link>
              </div>
            )}
            <div className="bg-white border border-green-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-2"><h3 className="text-[11px] font-black 
text-green-600 uppercase mt-1">Histórico Finalizado</h3><div className="text-green-500 bg-green-50 p-1.5 rounded-lg"><CheckCheck size={20}/></div></div>
              <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
              <Link to="/historico" className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline w-fit">Ver histórico <ChevronRight size={14}/></Link>
            </div>
          </div>

          {mostrarTermometroIA && (
            <div className="bg-purple-50 
border border-purple-200 rounded-2xl p-4 md:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start sm:items-center gap-3">
                <div className="bg-purple-100 text-purple-600 p-2.5 rounded-xl shrink-0"><Sparkles size={22}/></div>
                <div>
                  <h3 className="text-xs font-black text-purple-700 uppercase tracking-widest">Termômetro de Autonomia da IA</h3>
  
        
                  <p className="text-xs font-medium text-purple-600 mt-1 leading-relaxed max-w-xl">
                    Mede a eficácia da IA.
Mostra a porcentagem de feedbacks que a IA gerou e você aprovou para enviar ao aluno <strong>sem precisar fazer nenhuma edição</strong> no texto original.
</p>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end shrink-0 bg-white px-4 py-2 rounded-xl border border-purple-100 shadow-sm w-full sm:w-auto text-right">
                <span className="text-3xl font-black text-purple-700 w-full">{metricasIA.percentual}%</span>
                <span className="text-[10px] font-bold text-purple-400 uppercase 
tracking-widest w-full">{metricasIA.originais} de {metricasIA.total} exatos</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10 items-start">
              {gestaoVista.atuais.map((gv, idx) => (
                <div key={`atual-${idx}`} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
 

                  <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                    <div className="bg-orange-100 text-orange-600 p-2.5 rounded-xl shrink-0"><AlertTriangle size={20}/></div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide 
flex items-center gap-2">Faltam Entregar <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md text-[10px] tracking-widest">{gv.devedores.length} ALUNOS</span></h3>
                      <p className="text-xs font-bold text-gray-500 mt-0.5 truncate" title={gv.nome}>Atual: {gv.nome}</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 
overflow-y-auto pr-2 pb-4">
                    {gv.devedores.length === 0 ?
(<p className="text-sm font-bold text-green-600 bg-green-50 p-4 rounded-xl text-center">100% de entregas! 🎉</p>) : (
                      gv.devedores.map((nome, i) => (
                        <div key={i} className="text-sm font-medium text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                          <User 
size={14} className="text-gray-400 shrink-0"/> <span className="truncate">{nome}</span>
                        </div>
                      ))
                    )}
                  </div>
            

                </div>
              ))}

              {gestaoVista.anteriores.map((gv, idx) => (
                <div key={`ant-${idx}`} className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
   
            
                    <div className="bg-red-100 text-red-600 p-2.5 rounded-xl shrink-0"><Clock size={20}/></div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">Pendências <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[10px] tracking-widest">{gv.devedores.length} ALUNOS</span></h3>
  
                    <p className="text-xs font-bold text-gray-500 mt-0.5 truncate" title={gv.nome}>Anterior: {gv.nome}</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2 pb-4">
            
        {gv.devedores.length === 0 ?
(<p className="text-sm font-bold text-green-600 bg-green-50 p-4 rounded-xl text-center">Nenhuma pendência! 🎉</p>) : (
                      gv.devedores.map((nome, i) => (
                        <div key={i} className="text-sm font-medium text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-2">
                          <User size={14} 
className="text-gray-400 shrink-0"/> <span className="truncate">{nome}</span>
                        </div>
                      ))
                    )}
                  </div>
             

                </div>
              ))}
          </div>
        </>
      )}

      {/* 🔥 ADICIONADO: Componente do Modal de Onboarding no final da página */}
      <OnboardingModal isOpen={mostrarTour} onClose={() => setMostrarTour(false)} />
    </div>
  );
}
