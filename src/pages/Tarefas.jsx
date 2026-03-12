import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Calendar, StickyNote, GraduationCap, ArrowRight, Check, X, Clock, Info } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

const ordenarTarefas = (lista) => {
  return [...lista].sort((a, b) => {
    const timeA = a.dataFim?.toMillis ? a.dataFim.toMillis() : 0;
    const timeB = b.dataFim?.toMillis ? b.dataFim.toMillis() : 0;

    if (timeA === 0 && timeB !== 0) return 1; 
    if (timeA !== 0 && timeB === 0) return -1; 
    if (timeA !== 0 && timeB !== 0) return timeA - timeB; 

    const criaA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
    const criaB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
    return criaB - criaA;
  });
};

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [alunosTurma, setAlunosTurma] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });

  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', enunciado: '', dataInicio: '', horaInicio: '', dataFim: '', horaFim: '', tipo: 'entrega' });
  const [atribuicaoEspecifica, setAtribuicaoEspecifica] = useState(false); 
  const [alunosSelecionados, setAlunosSelecionados] = useState([]); 
  const [salvando, setSalvando] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState('');
  const tituloInputRef = useRef(null);

  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');
  const [dataInicioEdicao, setDataInicioEdicao] = useState('');
  const [horaInicioEdicao, setHoraInicioEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [horaFimEdicao, setHoraFimEdicao] = useState('');
  const [tipoEdicao, setTipoEdicao] = useState('entrega');

  useEffect(() => {
    if (location.state?.novoRegistro || location.state?.abrirModal) {
      setIsModalOpen(true);
      const stateCopy = { ...location.state };
      delete stateCopy.novoRegistro;
      delete stateCopy.abrirModal;
      window.history.replaceState(stateCopy, document.title);
    }
  }, [location.state]);

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
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        
        const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
        const isValid = turmasData.some(t => t.id === targetTurma);
        
        if (isValid) {
          if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
        } else if (turmasData.length > 0) {
          setTurmaAtiva(turmasData[0].id);
        }
      } catch (error) { console.error("Erro fetch turmas:", error); }
    }
    fetchTurmas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, escolaSelecionada]);

  useEffect(() => {
    async function fetchDadosTurma() {
      if (!turmaAtiva) { setTarefas([]); setAlunosTurma([]); setLoading(false); return; }
      setLoading(true);
      try {
        const qT = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id), where('turmaId', '==', turmaAtiva));
        const snapT = await getDocs(qT);
        const tarefasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        
        setTarefas(ordenarTarefas(tarefasData));

        const qA = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapA = await getDocs(qA);
        setAlunosTurma(snapA.docs.map(d => ({ id: d.id, nome: d.data().nome })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome)));
        
        setAtribuicaoEspecifica(false);
        setAlunosSelecionados([]);

      } catch (error) { console.error("Erro fetch dados:", error); } 
      finally { setLoading(false); }
    }
    fetchDadosTurma();
  }, [turmaAtiva, escolaSelecionada]);

  const tsToDateInput = (ts) => {
    if (!ts) return "";
    try {
      let d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (e) { return ""; }
  };

  const tsToTimeInput = (ts) => {
    if (!ts) return "";
    try {
      let d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (e) { return ""; }
  };

  const criarDataSegura = (dataStr, horaStr, isFim = false) => {
    if (!dataStr) return null;
    const [ano, mes, dia] = dataStr.split('-');
    const horaPadrao = isFim ? '23:59' : '00:00';
    const [hora, min] = (horaStr || horaPadrao).split(':');
    return new Date(ano, mes - 1, dia, hora, min);
  };

  const iniciarEdicao = (t) => {
    const tiposValidos = ['entrega', 'compromisso', 'lembrete'];
    const tipoNormalizado = (t.tipo || 'entrega').toLowerCase();
    
    setTituloEdicao(t.nomeTarefa || t.titulo || 'Tarefa sem nome');
    setEnunciadoEdicao(t.enunciado || '');
    setDataInicioEdicao(tsToDateInput(t.dataInicio));
    setHoraInicioEdicao(tsToTimeInput(t.dataInicio));
    setDataFimEdicao(tsToDateInput(t.dataFim));
    setHoraFimEdicao(tsToTimeInput(t.dataFim));
    setTipoEdicao(tiposValidos.includes(tipoNormalizado) ? tipoNormalizado : 'entrega');
    setEditandoId(t.id); 
  };

  async function handleSalvarEdicao(id) {
    if (!tituloEdicao.trim()) return;
    try {
      const prazoInicial = dataInicioEdicao ? Timestamp.fromDate(criarDataSegura(dataInicioEdicao, horaInicioEdicao, false)) : null;
      const prazoFinal = dataFimEdicao ? Timestamp.fromDate(criarDataSegura(dataFimEdicao, horaFimEdicao, true)) : null;
      
      await updateDoc(doc(db, 'tarefas', id), { 
        nomeTarefa: tituloEdicao.trim(), 
        enunciado: enunciadoEdicao.trim(),
        dataInicio: prazoInicial,
        dataFim: prazoFinal, 
        tipo: tipoEdicao
      });
      
      const listaAtualizada = tarefas.map(t => t.id === id ? { ...t, nomeTarefa: tituloEdicao.trim(), enunciado: enunciadoEdicao.trim(), dataInicio: prazoInicial, dataFim: prazoFinal, tipo: tipoEdicao } : t);
      setTarefas(ordenarTarefas(listaAtualizada));
      setEditandoId(null);
    } catch (error) { console.error("Erro ao salvar:", error); }
  }

  async function handleCriar(e) {
    e.preventDefault();
    if (!novaTarefa.titulo || !turmaAtiva) return;
    
    if (novaTarefa.tipo === 'entrega' && atribuicaoEspecifica && alunosSelecionados.length === 0) {
      alert("Selecione pelo menos um aluno para receber a tarefa.");
      return;
    }

    const tituloSalvo = novaTarefa.titulo.trim();

    try {
      setSalvando(true);
      const prazoInicial = novaTarefa.dataInicio ? Timestamp.fromDate(criarDataSegura(novaTarefa.dataInicio, novaTarefa.horaInicio, false)) : Timestamp.now();
      const prazoFinal = novaTarefa.dataFim ? Timestamp.fromDate(criarDataSegura(novaTarefa.dataFim, novaTarefa.horaFim, true)) : null;
      
      const tData = {
        nomeTarefa: tituloSalvo, 
        enunciado: novaTarefa.enunciado.trim(),
        dataInicio: prazoInicial,
        dataFim: prazoFinal, 
        tipo: novaTarefa.tipo, 
        turmaId: turmaAtiva,
        instituicaoId: escolaSelecionada.id, 
        professorUid: currentUser.uid,
        status: 'ativa', 
        dataCriacao: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'tarefas'), tData);
      const novaId = docRef.id;

      if (novaTarefa.tipo === 'entrega' && alunosTurma.length > 0) {
        const batch = writeBatch(db); 
        
        const listaAlvo = atribuicaoEspecifica 
          ? alunosTurma.filter(a => alunosSelecionados.includes(a.id))
          : alunosTurma;

        listaAlvo.forEach(aluno => {
          const ativRef = doc(collection(db, 'atividades'));
          batch.set(ativRef, {
            alunoId: aluno.id,
            turmaId: turmaAtiva,
            instituicaoId: escolaSelecionada.id,
            tarefaId: novaId,
            resposta: '',
            nota: null,
            feedbackSugerido: '',
            feedbackFinal: '',
            status: 'pendente',
            postado: false,
            dataCriacao: serverTimestamp()
          });
        });
        
        await batch.commit(); 
      }

      const listaComNovo = [{ id: novaId, ...tData, dataCriacao: Timestamp.now() }, ...tarefas];
      setTarefas(ordenarTarefas(listaComNovo));
      
      setNovaTarefa({ titulo: '', enunciado: '', dataInicio: '', horaInicio: '', dataFim: '', horaFim: '', tipo: 'entrega' });
      setAtribuicaoEspecifica(false);
      setAlunosSelecionados([]);
      
      setSucessoMsg(`"${tituloSalvo}" salvo com sucesso!`);
      setTimeout(() => setSucessoMsg(''), 3000);
      setTimeout(() => { if (tituloInputRef.current) tituloInputRef.current.focus(); }, 100);

    } catch (error) { console.error("Erro criar:", error); } finally { setSalvando(false); }
  }

  const toggleAlunoSelecao = (alunoId) => {
    setAlunosSelecionados(prev => 
      prev.includes(alunoId) ? prev.filter(id => id !== alunoId) : [...prev, alunoId]
    );
  };

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Remover o registro "${nome}"?\n\nIsso apagará essa tarefa do radar de todos os alunos.`)) return;
    try {
      await updateDoc(doc(db, 'tarefas', id), { status: 'lixeira' });
      setTarefas(tarefas.filter(t => t.id !== id));
    } catch (error) { console.error("Erro remover:", error); }
  }
  
  const formatarDataLocal = (ts) => {
    if (!ts) return "";
    try {
      let d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  const getIconeTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return <Calendar size={20} className="text-purple-500" />;
    if (t === 'lembrete') return <StickyNote size={20} className="text-yellow-500" />;
    return <FileText size={20} className="text-orange-500" />;
  };

  const getCorTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return 'border-purple-200 bg-purple-50/20 hover:border-purple-300';
    if (t === 'lembrete') return 'border-yellow-300 bg-yellow-50/40 hover:border-yellow-400';
    return 'border-orange-200 bg-orange-50/20 hover:border-orange-300';
  };

  const getNomeVisivelTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return 'Compromisso';
    if (t === 'lembrete') return 'Post-it';
    return 'Tarefa do Aluno';
  };

  const tarefasFiltradas = tarefas.filter(t => (t.nomeTarefa || t.titulo || '').toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Gestão e Cronograma' }]} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-8">
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3 tracking-tight">
          <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl shadow-sm"><Calendar size={26} /></div>
          Gestão de Cronograma
        </h1>
        {turmas.length > 0 && turmaAtiva && (
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white font-black px-6 py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
            <Plus size={20}/> Novo Registro
          </button>
        )}
      </div>

      {turmas.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
            <input type="text" placeholder="Procurar no radar da turma..." className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-700 transition-all placeholder:font-medium" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 min-w-[240px]">
             <GraduationCap size={20} className="text-gray-400 ml-2" />
             <select className="w-full py-3.5 bg-transparent outline-none text-sm font-bold text-blue-700 cursor-pointer" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
               <option value="" disabled>Selecione a Turma...</option>
               {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
             </select>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {turmas.length > 0 && turmaAtiva && (
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Registros no Radar</h2>
            <span className="bg-gray-100 text-gray-500 text-[11px] font-black px-3 py-1 rounded-full">{tarefasFiltradas.length}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center animate-pulse font-black text-gray-300 text-lg">Carregando cronograma...</div>
        ) : !turmaAtiva ? (
           <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8">
            <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <GraduationCap size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Nenhuma turma selecionada</h3>
            <p className="text-gray-500 font-medium mb-8 text-lg">Selecione uma turma no menu acima para gerenciar o cronograma dela.</p>
          </div>
        ) : tarefasFiltradas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8">
            <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Cronograma Vazio!</h3>
            <p className="text-gray-500 font-medium mb-6 text-lg max-w-lg mx-auto">
              Sua turma ainda não tem atividades. Você pode criar <strong className="text-gray-700">Tarefas</strong> (que exigem entrega), <strong className="text-gray-700">Compromissos</strong> (como aulas) ou simples <strong className="text-gray-700">Post-its</strong>.
            </p>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white font-black px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 inline-flex items-center gap-2">
              <Plus size={20}/> Novo Registro
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tarefasFiltradas.map(tarefa => (
              <div key={tarefa.id} className={`bg-white p-5 rounded-2xl border transition-all shadow-sm group ${editandoId === tarefa.id ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : `${getCorTipo(tarefa.tipo)} hover:shadow-md`}`}>
                
                {editandoId === tarefa.id ? (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Tipo de Registro</label>
                      <select className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-medium bg-white outline-none cursor-pointer" value={tipoEdicao} onChange={e => setTipoEdicao(e.target.value)}>
                        <option value="entrega">📝 Tarefa do Aluno</option>
                        <option value="compromisso">📅 Compromisso</option>
                        <option value="lembrete">💡 Post-it</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Título</label>
                      <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-medium outline-none text-slate-800" value={tituloEdicao} onChange={e => setTituloEdicao(e.target.value)}/>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Observações</label>
                      <textarea className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-normal outline-none resize-none text-slate-700" value={enunciadoEdicao} onChange={e => setEnunciadoEdicao(e.target.value)} rows="3"/>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Data de Início</label>
                        <input type="date" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-xs font-medium outline-none text-gray-700" value={dataInicioEdicao} onChange={e => setDataInicioEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Hora de Início</label>
                        <input type="time" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-xs font-medium outline-none text-gray-700" value={horaInicioEdicao} onChange={e => setHoraInicioEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Data Final</label>
                        <input type="date" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-xs font-medium outline-none text-gray-700" value={dataFimEdicao} onChange={e => setDataFimEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-700 uppercase mb-1 block">Hora Final</label>
                        <input type="time" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-xs font-medium outline-none text-gray-700" value={horaFimEdicao} onChange={e => setHoraFimEdicao(e.target.value)}/>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-2 border-t border-gray-100">
                      <button onClick={() => handleSalvarEdicao(tarefa.id)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-black flex items-center justify-center gap-1 shadow-sm hover:bg-green-700"><Check size={16}/> Salvar</button>
                      <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-lg text-sm font-black flex items-center justify-center gap-1 hover:bg-gray-200"><X size={16}/> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 shrink-0 mt-0.5">
                            {getIconeTipo(tarefa.tipo)}
                          </div>
                          <div className="min-w-0 flex-1">
                            {(tarefa.tipo === 'entrega' || !tarefa.tipo) ? (
                              <Link to={`/revisar/${tarefa.id}`} className="block font-black text-gray-800 text-base md:text-lg leading-tight hover:text-blue-600 transition-colors group/link truncate" title={tarefa.nomeTarefa || tarefa.titulo}>
                                {tarefa.nomeTarefa || tarefa.titulo}
                              </Link>
                            ) : (
                              <h3 className="font-black text-gray-800 text-base md:text-lg leading-tight truncate" title={tarefa.nomeTarefa || tarefa.titulo}>
                                {tarefa.nomeTarefa || tarefa.titulo}
                              </h3>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => iniciarEdicao(tarefa)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors shadow-sm" title="Editar"><Pencil size={16}/></button>
                          <button onClick={() => handleLixeira(tarefa.id, tarefa.nomeTarefa || tarefa.titulo)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors shadow-sm" title="Remover"><Trash2 size={16}/></button>
                        </div>
                      </div>

                      {tarefa.enunciado && (
                        <p className="text-sm text-gray-600 font-normal line-clamp-4 mb-4 bg-white/50 p-3 rounded-lg whitespace-pre-wrap">{tarefa.enunciado}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white py-1.5 px-3 rounded-lg border border-gray-100 w-fit mt-auto text-gray-500 shadow-sm">
                      {getNomeVisivelTipo(tarefa.tipo)} • {tarefa.dataFim ? formatarDataLocal(tarefa.dataFim) : 'Sem prazo'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL DE CRIAÇÃO (COM CARDS EDUCATIVOS PLG)
          ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50 sticky top-0 z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600"/> Adicionar ao Cronograma</h2>
              <button onClick={() => { setIsModalOpen(false); setSucessoMsg(''); }} className="text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-full p-2 shadow-sm transition-all hover:scale-105"><X size={20}/></button>
            </div>
            
            {sucessoMsg && (
              <div className="mx-6 mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300">
                <Check size={20} className="shrink-0" />
                <span className="text-sm font-bold">{sucessoMsg}</span>
              </div>
            )}

            <form onSubmit={handleCriar} className="p-6 md:p-8 space-y-6">
              
              {/* SELEÇÃO DE TIPO COM CARDS EDUCATIVOS */}
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 block">Que tipo de registro você quer criar?</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* CARD TAREFA */}
                  <button type="button" onClick={() => setNovaTarefa({...novaTarefa, tipo: 'entrega'})} 
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${novaTarefa.tipo === 'entrega' ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-50' : 'border-gray-100 hover:border-orange-200 bg-white'}`}>
                    <div className={`p-2 rounded-lg w-fit ${novaTarefa.tipo === 'entrega' ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-500'}`}><FileText size={20}/></div>
                    <h4 className="font-black text-slate-800 text-sm">Tarefa</h4>
                    <p className="text-[10px] leading-tight text-slate-500 font-medium italic">Exige entrega do aluno e gera pendência/nota.</p>
                  </button>

                  {/* CARD COMPROMISSO */}
                  <button type="button" onClick={() => setNovaTarefa({...novaTarefa, tipo: 'compromisso'})} 
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${novaTarefa.tipo === 'compromisso' ? 'border-purple-500 bg-purple-50 ring-4 ring-purple-50' : 'border-gray-100 hover:border-purple-200 bg-white'}`}>
                    <div className={`p-2 rounded-lg w-fit ${novaTarefa.tipo === 'compromisso' ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-500'}`}><Calendar size={20}/></div>
                    <h4 className="font-black text-slate-800 text-sm">Compromisso</h4>
                    <p className="text-[10px] leading-tight text-slate-500 font-medium italic">Ex: Aula Síncrona, Prova ou Evento na Agenda.</p>
                  </button>

                  {/* CARD POST-IT */}
                  <button type="button" onClick={() => setNovaTarefa({...novaTarefa, tipo: 'lembrete'})} 
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${novaTarefa.tipo === 'lembrete' ? 'border-yellow-500 bg-yellow-50 ring-4 ring-yellow-50' : 'border-gray-100 hover:border-yellow-200 bg-white'}`}>
                    <div className={`p-2 rounded-lg w-fit ${novaTarefa.tipo === 'lembrete' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600'}`}><StickyNote size={20}/></div>
                    <h4 className="font-black text-slate-800 text-sm">Post-it</h4>
                    <p className="text-[10px] leading-tight text-slate-500 font-medium italic">Um aviso rápido ou dica útil fixada no topo.</p>
                  </button>

                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">Título</label>
                  <input ref={tituloInputRef} type="text" required autoFocus placeholder="Ex: Módulo 1 - Fundamentos..." className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-800 transition-all placeholder:font-normal placeholder:text-gray-400" value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})}/>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 block">Observações (Opcional)</label>
                  <textarea placeholder="Instruções, links ou detalhes adicionais..." rows="3" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-normal text-slate-700 transition-all placeholder:font-normal placeholder:text-gray-400 resize-none" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})}/>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar size={14}/> Início</label>
                    <input type="date" className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all" value={novaTarefa.dataInicio} onChange={e => setNovaTarefa({...novaTarefa, dataInicio: e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Clock size={14}/> Hora</label>
                    <input type="time" className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all" value={novaTarefa.horaInicio} onChange={e => setNovaTarefa({...novaTarefa, horaInicio: e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Calendar size={14}/> Prazo Final</label>
                    <input type="date" className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all" value={novaTarefa.dataFim} onChange={e => setNovaTarefa({...novaTarefa, dataFim: e.target.value})}/>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1"><Clock size={14}/> Hora</label>
                    <input type="time" className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all" value={novaTarefa.horaFim} onChange={e => setNovaTarefa({...novaTarefa, horaFim: e.target.value})}/>
                  </div>
                </div>

                {novaTarefa.tipo === 'entrega' && alunosTurma.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <label className="flex items-center gap-3 text-sm font-black text-slate-700 cursor-pointer hover:text-blue-600 transition-colors mb-3">
                      <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" checked={atribuicaoEspecifica} onChange={(e) => setAtribuicaoEspecifica(e.target.checked)}/>
                      Atribuir apenas a alunos específicos (Exceção)
                    </label>
                    {atribuicaoEspecifica && (
                      <div className="bg-white border border-gray-200 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1 shadow-inner animate-in fade-in slide-in-from-top-2">
                        {alunosTurma.map(aluno => (
                          <label key={aluno.id} className="flex items-center gap-3 p-2.5 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-blue-100">
                            <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" checked={alunosSelecionados.includes(aluno.id)} onChange={() => toggleAlunoSelecao(aluno.id)}/>
                            <span className="text-sm font-bold text-gray-700 truncate">{aluno.nome}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button disabled={salvando || !turmaAtiva} className={`w-full text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4 disabled:opacity-50 text-lg ${sucessoMsg ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20 scale-105' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}>
                {salvando ? 'Processando...' : sucessoMsg ? <><Check size={24}/> Salvo com Sucesso!</> : 'Salvar no Cronograma'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
