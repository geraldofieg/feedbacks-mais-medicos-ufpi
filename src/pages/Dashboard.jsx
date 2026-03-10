import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ArrowRight, GraduationCap, Users, LayoutDashboard, Building2, Pencil, Check, X, Calendar, Clock, Trash2, ChevronRight, Send, CheckCheck, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const navigate = useNavigate();
  
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  
  const planoUsuario = userProfile?.plano || 'basico'; 
  const mostrarRevisao = isAdmin || planoUsuario === 'intermediario' || planoUsuario === 'premium';
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');
  const [loadingInst, setLoadingInst] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [editandoInstId, setEditandoInstId] = useState(null);
  const [nomeInstEdicao, setNomeInstEdicao] = useState('');

  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [proximosEventos, setProximosEventos] = useState([]);
  const [tarefasEmAndamento, setTarefasEmAndamento] = useState([]); 
  
  const [loadingDados, setLoadingDados] = useState(false);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });

  useEffect(() => {
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
  }, [escolaSelecionada]);

  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const instList = [];
        const instRef = collection(db, 'instituicoes');
        const qInst = isAdmin 
          ? instRef 
          : query(instRef, where('professorUid', '==', currentUser.uid));
          
        const snapInst = await getDocs(qInst);
        snapInst.docs.forEach(d => {
          const data = d.data();
          if (data.status !== 'lixeira') instList.push({ id: d.id, nome: data.nome });
        });
        
        const listaOrdenada = instList.sort((a, b) => a.nome.localeCompare(b.nome));
        setInstituicoes(listaOrdenada);
        if (listaOrdenada.length === 1 && !escolaSelecionada) setEscolaSelecionada(listaOrdenada[0]);
      } catch (error) { console.error("Erro buscar instituições:", error); } 
      finally { setLoadingInst(false); }
    }
    fetchInstituicoes();
  }, [currentUser, escolaSelecionada, setEscolaSelecionada, isAdmin]);

  useEffect(() => {
    async function fetchDadosDashboard() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoadingDados(true);
      try {
        const turmasRef = collection(db, 'turmas');
        const qTurmas = isAdmin
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
          
        const snapTurmas = await getDocs(qTurmas);
        const turmasData = snapTurmas.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasData);

        if (turmasData.length > 0) {
          const turmasIds = turmasData.map(d => d.id);
          const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapTarefas = await getDocs(qTarefas);
          
          const agora = new Date();
          const hojeMeiaNoite = new Date(); hojeMeiaNoite.setHours(0, 0, 0, 0);
          const limiteSemana = new Date(hojeMeiaNoite); limiteSemana.setDate(hojeMeiaNoite.getDate() + 7); 

          const todasTarefasFiltradas = snapTarefas.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(t => t.status !== 'lixeira' && turmasIds.includes(t.turmaId) && t.dataFim)
            .map(t => {
              const dataF = t.dataFim.toDate ? t.dataFim.toDate() : new Date(t.dataFim);
              const diasRestantes = Math.ceil((dataF.getTime() - agora.getTime()) / (1000 * 3600 * 24));
              return { ...t, objDataFim: dataF, timestamp: dataF.getTime(), diasRestantes };
            });

          const ativas = todasTarefasFiltradas
            .filter(t => t.diasRestantes >= 0 && t.tipo === 'entrega')
            .sort((a, b) => a.diasRestantes - b.diasRestantes);
          setTarefasEmAndamento(ativas);

          const radar = todasTarefasFiltradas
            .filter(t => t.timestamp >= hojeMeiaNoite.getTime() && t.timestamp <= limiteSemana.getTime())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 3); 
          setProximosEventos(radar);

          const qAtividades = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapAtividades = await getDocs(qAtividades);
          
          let contPendentes = 0;
          let contFaltaLancar = 0;
          let contFinalizados = 0;
          let iaTotal = 0;
          let iaOriginais = 0;

          snapAtividades.docs.forEach(doc => {
            const ativ = doc.data();
            if (turmasIds.includes(ativ.turmaId)) {
              if (ativ.postado === true) {
                contFinalizados++;
              } else if (ativ.status === 'aprovado') {
                contFaltaLancar++;
              } else {
                contPendentes++;
              }

              // PROTEÇÃO CONTRA DADOS VAZIOS DA V1
              const isAprovado = ativ.status === 'aprovado' || ativ.postado === true;
              const feedbackSugeridoValido = ativ.feedbackSugerido && typeof ativ.feedbackSugerido === 'string' && ativ.feedbackSugerido.trim() !== '';
              
              if (isAprovado && feedbackSugeridoValido) {
                iaTotal++;
                const feedbackFinal = ativ.feedbackFinal ? String(ativ.feedbackFinal).trim() : '';
                const feedbackSugerido = String(ativ.feedbackSugerido).trim();
                
                if (feedbackFinal === feedbackSugerido) {
                  iaOriginais++;
                }
              }
            }
          });

          setKanban({ pendentes: contPendentes, faltaLancar: contFaltaLancar, finalizados: contFinalizados });
          const percentualIA = iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0;
          setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual: percentualIA });

        } else {
          setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 });
          setMetricasIA({ total: 0, originais: 0, percentual: 0 });
        }
      } catch (error) { console.error("Erro buscar dados:", error); } 
      finally { setLoadingDados(false); }
    }
    if (escolaSelecionada) fetchDadosDashboard();
  }, [currentUser, escolaSelecionada, isAdmin]);

  async function handleCriarAcessar(e) {
    e.preventDefault(); const nomeInst = novaInstituicao.trim(); if (!nomeInst) return;
    try { setSalvando(true); const docRef = await addDoc(collection(db, 'instituicoes'), { nome: nomeInst, professorUid: currentUser.uid, status: 'ativa', dataCriacao: serverTimestamp() }); setEscolaSelecionada({ id: docRef.id, nome: nomeInst }); } 
    catch (error) { console.error("Erro ao criar instituição:", error); } 
    finally { setSalvando(false); }
  }

  const temTurmas = minhasTurmas.length > 0;
  const getNomeVisivelTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    return t === 'compromisso' ? 'Compromisso' : t === 'lembrete' ? 'Post-it' : 'Tarefa do Aluno';
  };
  const finalizadosVisor = isAdmin ? kanban.finalizados : (kanban.finalizados + kanban.faltaLancar);

  if (!escolaSelecionada) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 mt-4 md:mt-8">
        <div className="text-center mb-10">
          <div className="bg-blue-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"><GraduationCap size={32} /></div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-gray-500 mt-2 text-base md:text-lg px-2">Selecione o seu ambiente de trabalho para continuar.</p>
        </div>
        <div className="flex flex-col gap-8 w-full max-w-2xl mx-auto">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><LayoutDashboard size={18}/> Suas Instituições Ativas</h2>
            {loadingInst ? ( <div className="text-gray-400 text-sm font-medium animate-pulse text-center py-6">Carregando...</div> ) : (
              <div className="space-y-3">
                {instituicoes.map(inst => (
                  <div key={inst.id} className="w-full bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between hover:bg-blue-600 hover:text-white transition-all group cursor-pointer shadow-sm" onClick={() => setEscolaSelecionada(inst)}>
                    <span className="flex-1 text-left font-black text-blue-800 group-hover:text-white text-lg truncate">{inst.nome}</span>
                    <ArrowRight size={24} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 justify-between border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3 w-full">
          <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm shrink-0"><GraduationCap size={28} /></div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Centro de Comando</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-gray-500 text-sm font-medium">Instituição:</span>
              <select className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg py-1 px-2 font-bold cursor-pointer outline-none" value={escolaSelecionada.id}
                onChange={(e) => { const val = e.target.value; if (val === 'NOVA') setEscolaSelecionada(null); else { const inst = instituicoes.find(i => i.id === val); if (inst) setEscolaSelecionada(inst); } }}
              >
                {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
                <option value="NOVA">+ Nova Instituição</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!temTurmas && !loadingDados ? (
        <div className="mb-10 text-center bg-blue-50 border-2 border-dashed border-blue-200 p-10 rounded-3xl max-w-2xl mx-auto">
          <Building2 className="mx-auto text-blue-400 mb-4" size={48}/>
          <h2 className="text-xl font-black text-blue-900 mb-2">Quase lá!</h2>
          <p className="text-blue-700 font-medium mb-6">A migração criou os dados, mas você precisa entrar na aba "Turmas" para conferir se está tudo certo.</p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3 px-8 rounded-xl shadow-lg hover:bg-blue-700 transition-all"><Plus size={20}/> Ir para Turmas</Link>
        </div>
      ) : (
        <>
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
            <div className="flex gap-4 items-start w-full">
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 shrink-0 shadow-inner">
                <Calendar size={24} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-white mb-2 tracking-wide">Situação das Atividades</h2>
                <div className="space-y-1.5 text-sm font-medium text-slate-200">
                  <p>Instituição: <span className="text-blue-400">{escolaSelecionada.nome}</span></p>
                  <p>Confira o histórico migrado abaixo.</p>
                </div>
              </div>
            </div>
          </div>

          {isAdmin && metricasIA.total > 0 && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-6 shadow-lg mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl shrink-0"><Sparkles size={28} className="text-purple-100" /></div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-white tracking-wide">Termômetro da IA (Histórico)</h2>
                  <p className="text-purple-200 text-sm font-medium mt-0.5">Feedbacks migrados sem alteração.</p>
                </div>
              </div>
              <div className="text-left md:text-right shrink-0">
                <span className="block text-4xl md:text-5xl font-black text-white tracking-tighter">{metricasIA.percentual}%</span>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 gap-4 mb-10 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-4xl mx-auto'}`}>
            {mostrarRevisao && (
              <div className="bg-white border border-yellow-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <h3 className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-4">Aguardando Revisão</h3>
                <span className="text-4xl font-black text-gray-800">{kanban.pendentes}</span>
              </div>
            )}
            <div className="bg-white border border-green-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
              <h3 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-4">Finalizados (Migrados)</h3>
              <span className="text-4xl font-black text-gray-800">{finalizadosVisor}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
