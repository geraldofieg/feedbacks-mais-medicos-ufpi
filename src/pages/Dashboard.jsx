import { useState, useEffect } from 'react';
// CORREÇÃO: Adicionados addDoc, updateDoc, doc e serverTimestamp nos imports
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

              const isAprovado = ativ.status === 'aprovado' || ativ.postado === true;
              const temSugestaoIA = ativ.feedbackSugerido && ativ.feedbackSugerido.trim() !== '';
              
              if (isAprovado && temSugestaoIA) {
                iaTotal++;
                const feedbackFinal = ativ.feedbackFinal ? ativ.feedbackFinal.trim() : '';
                const feedbackSugerido = ativ.feedbackSugerido.trim();
                
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
          setProximosEventos([]);
          setTarefasEmAndamento([]);
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
    try { 
      setSalvando(true); 
      const docRef = await addDoc(collection(db, 'instituicoes'), { 
        nome: nomeInst, 
        professorUid: currentUser.uid, 
        status: 'ativa', 
        dataCriacao: serverTimestamp() 
      }); 
      setEscolaSelecionada({ id: docRef.id, nome: nomeInst }); 
    } 
    catch (error) { console.error("Erro ao criar instituição:", error); } 
    finally { setSalvando(false); }
  }

  async function handleSalvarEdicaoInst(e, id) {
    e.stopPropagation(); if (!nomeInstEdicao.trim()) return;
    try { await updateDoc(doc(db, 'instituicoes', id), { nome: nomeInstEdicao.trim() }); setInstituicoes(instituicoes.map(inst => inst.id === id ? { ...inst, nome: nomeInstEdicao.trim() } : inst)); setEditandoInstId(null); if (escolaSelecionada?.id === id) setEscolaSelecionada({ id, nome: nomeInstEdicao.trim() }); } 
    catch (error) { console.error("Erro editar:", error); }
  }

  async function handleLixeiraInstituicao(e, id, nome) {
    e.stopPropagation(); if (!window.confirm(`Apagar o espaço "${nome}"?\n\nEle será enviado para a lixeira.`)) return;
    try { await updateDoc(doc(db, 'instituicoes', id), { status: 'lixeira' }); setInstituicoes(instituicoes.filter(inst => inst.id !== id)); } 
    catch (error) { console.error("Erro:", error); }
  }
  
  const temTurmas = minhasTurmas.length > 0;

  const getNomeVisivelTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return 'Compromisso';
    if (t === 'lembrete') return 'Post-it';
    return 'Tarefa do Aluno';
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
            {loadingInst ? ( <div className="text-gray-400 text-sm font-medium animate-pulse text-center py-6">Carregando...</div> ) : instituicoes.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p className="text-gray-500 text-sm font-medium">Nenhuma instituição cadastrada.</p></div>
            ) : (
              <div className="space-y-3">
                {instituicoes.map(inst => (
                  <div key={inst.id} className="w-full bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between hover:bg-blue-600 hover:text-white transition-all group cursor-pointer shadow-sm" onClick={() => setEscolaSelecionada(inst)}>
                    {editandoInstId === inst.id ? (
                      <div className="flex items-center gap-2 w-full pr-2" onClick={e => e.stopPropagation()}>
                        <input type="text" value={nomeInstEdicao} onChange={(e) => setNomeInstEdicao(e.target.value)} className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" autoFocus />
                        <button onClick={(e) => handleSalvarEdicaoInst(e, inst.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditandoInstId(null); }} className="bg-gray-200 text-gray-600 p-1.5 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-left font-black text-blue-800 group-hover:text-white text-lg truncate">{inst.nome}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditandoInstId(inst.id); setNomeInstEdicao(inst.nome); }} className="p-2 text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Pencil size={18} /></button>
                          <button onClick={(e) => handleLixeiraInstituicao(e, inst.id, inst.nome)} className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                          <div className="p-2 text-blue-600 group-hover:text-white ml-1"><ArrowRight size={24} /></div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
             <h2 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><Plus size={18}/> Cadastrar Novo Vínculo</h2>
            <form onSubmit={handleCriarAcessar} className="flex gap-2">
              <input type="text" required placeholder="Ex: UFPI..." className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 transition-colors font-medium outline-none" value={novaInstituicao} onChange={(e) => setNovaInstituicao(e.target.value)} />
              <button type="submit" disabled={salvando} className="bg-gray-800 text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-900 disabled:opacity-50 transition-all shadow-sm">{salvando ? '...' : 'Criar'}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* O RESTANTE DO CÓDIGO DO SEU DASHBOARD CONTINUA EXATAMENTE IGUAL AQUI PARA BAIXO */}
    </div>
  );
}
