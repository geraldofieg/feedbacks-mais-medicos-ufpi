import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Calendar, StickyNote, GraduationCap, ArrowRight, Check, X, Clock, Info, RefreshCw, Paperclip, FileUp, FileCheck, ExternalLink, Users, User } from 'lucide-react';
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
  
  // NOVOS ESTADOS PARA UPLOAD DO ENUNCIADO
  const [uploading, setUploading] = useState(false);
  const [enunciadoArquivoUrl, setEnunciadoArquivoUrl] = useState('');
  const [enunciadoArquivoNome, setEnunciadoArquivoNome] = useState('');

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

  async function handleUploadEnunciado(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const storageRef = ref(storage, `enunciados/${currentUser.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      null, 
      (error) => { console.error(error); setUploading(false); }, 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setEnunciadoArquivoUrl(url);
        setEnunciadoArquivoNome(file.name);
        setUploading(false);
      }
    );
  }

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
        enunciadoArquivoUrl: enunciadoArquivoUrl, 
        enunciadoArquivoNome: enunciadoArquivoNome, 
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
        const listaAlvo = atribuicaoEspecifica ? alunosTurma.filter(a => alunosSelecionados.includes(a.id)) : alunosTurma;

        listaAlvo.forEach(aluno => {
          const ativRef = doc(collection(db, 'atividades'));
          batch.set(ativRef, {
            alunoId: aluno.id,
            turmaId: turmaAtiva,
            instituicaoId: escolaSelecionada.id,
            tarefaId: novaId,
            
            // 🔥 CIRURGIA V1: Etiquetas Poliglotas injetadas na criação
            nomeAluno: aluno.nome,
            aluno: aluno.nome,
            nomeTarefa: tituloSalvo,
            tarefa: tituloSalvo,
            modulo: tituloSalvo,

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
      
      setSucessoMsg(`"${tituloSalvo}" salvo com sucesso!`);
      
      setTimeout(() => {
        setSucessoMsg('');
        setIsModalOpen(false);
        setNovaTarefa({ titulo: '', enunciado: '', dataInicio: '', horaInicio: '', dataFim: '', horaFim: '', tipo: 'entrega' });
        setEnunciadoArquivoUrl('');
        setEnunciadoArquivoNome('');
        setAtribuicaoEspecifica(false);
        setAlunosSelecionados([]);
      }, 1500);

    } catch (error) { console.error("Erro criar:", error); } 
    finally { setSalvando(false); }
  }

  const toggleAlunoSelecao = (alunoId) => {
    setAlunosSelecionados(prev => prev.includes(alunoId) ? prev.filter(id => id !== alunoId) : [...prev, alunoId]);
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
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
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
        {loading ? (
          <div className="p-16 text-center animate-pulse font-black text-slate-300 text-lg">Carregando cronograma...</div>
        ) : !turmaAtiva ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8">
            <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><GraduationCap size={40} /></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Nenhuma turma selecionada</h3>
            <p className="text-slate-500 font-medium mb-8 text-lg">Selecione uma turma para gerenciar o cronograma.</p>
          </div>
        ) : tarefasFiltradas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm mt-8">
            <div className="bg-blue-50 text-blue-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Calendar size={40} /></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Cronograma Vazio!</h3>
            <p className="text-slate-500 font-medium mb-6 text-lg max-w-lg mx-auto">Sua turma ainda não tem atividades cadastradas.</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white font-black px-8 py-3.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2 mx-auto"><Plus size={20}/> Novo Registro</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tarefasFiltradas.map(tarefa => (
              <div key={tarefa.id} className={`bg-white p-5 rounded-2xl border transition-all shadow-sm group ${editandoId === tarefa.id ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : `${getCorTipo(tarefa.tipo)} hover:shadow-md`}`}>
                
                {editandoId === tarefa.id ? (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                    <button onClick={() => handleSalvarEdicao(tarefa.id)} className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-black shadow-sm">Salvar Alterações</button>
                    <button onClick={() => setEditandoId(null)} className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-lg text-sm font-black">Cancelar</button>
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
                              <Link to={`/revisar/${tarefa.id}`} className="block font-black text-slate-800 text-base md:text-lg leading-tight hover:text-blue-600 transition-colors group/link truncate" title={tarefa.nomeTarefa || tarefa.titulo}>
                                {tarefa.nomeTarefa || tarefa.titulo}
                              </Link>
                            ) : (
                              <h3 className="font-black text-slate-800 text-base md:text-lg leading-tight truncate" title={tarefa.nomeTarefa || tarefa.titulo}>
                                {tarefa.nomeTarefa || tarefa.titulo}
                              </h3>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => iniciarEdicao(tarefa)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors shadow-sm" title="Editar"><Pencil size={16}/></button>
                          <button onClick={() => handleLixeira(tarefa.id, tarefa.nomeTarefa || tarefa.titulo)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors shadow-sm" title="Remover"><Trash2 size={16}/></button>
                        </div>
                      </div>

                      {tarefa.enunciado && (
                        <p className="text-sm text-slate-600 font-medium line-clamp-4 mb-4 bg-white/50 p-3 rounded-lg whitespace-pre-wrap">{tarefa.enunciado}</p>
                      )}

                      {tarefa.enunciadoArquivoUrl && (
                        <a href={tarefa.enunciadoArquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider mb-4 hover:bg-blue-100 transition-colors">
                          <Paperclip size={12}/> Ver Anexo <ExternalLink size={10}/>
                        </a>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white py-1.5 px-3 rounded-lg border border-slate-100 w-fit mt-auto text-slate-500 shadow-sm">
                      {getNomeVisivelTipo(tarefa.tipo)} • {tarefa.dataFim ? formatarDataLocal(tarefa.dataFim) : 'Sem prazo'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 md:p-6 border-b border-gray-100 bg-slate-50 shrink-0 z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Plus className="text-blue-600"/> Adicionar ao Cronograma</h2>
              <button onClick={() => { setIsModalOpen(false); setSucessoMsg(''); }} className="text-gray-400 hover:text-red-500 bg-white border border-gray-200 rounded-full p-2 shadow-sm transition-all hover:scale-110"><X size={20}/></button>
            </div>
            
            <div className="overflow-y-auto p-5 md:p-8 flex-1">
              {sucessoMsg && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2">
                  <Check size={20} className="shrink-0" /><span className="text-sm font-black">{sucessoMsg}</span>
                </div>
              )}

              <form onSubmit={handleCriar} className="space-y-6 pb-4">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 block">Tipo de Registro</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button type="button" onClick={() => setNovaTarefa({...novaTarefa, tipo: 'entrega'})} className={`p-4 rounded-2xl border-2 transition-all text-left ${novaTarefa.tipo === 'entrega' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                      <FileText size={20} className="text-orange-500 mb-2"/><h4 className="font-black text-sm">Tarefa</h4>
                    </button>
                    <button type="button" onClick={() => setNovaTarefa({...novaTarefa, tipo: 'compromisso'})} className={`p-4 rounded-2xl border-2 transition-all text-left ${novaTarefa.tipo === 'compromisso' ? 'border-purple-500 bg-purple-50' : 'border-slate-100 bg-white'}`}>
                      <Calendar size={20} className="text-purple-500 mb-2"/><h4 className="font-black text-sm">Compromisso</h4>
                    </button>
                    <button type="button" onClick={() => setNovaTarefa({...novaTarefa, tipo: 'lembrete'})} className={`p-4 rounded-2xl border-2 transition-all text-left ${novaTarefa.tipo === 'lembrete' ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 bg-white'}`}>
                      <StickyNote size={20} className="text-yellow-500 mb-2"/><h4 className="font-black text-sm">Post-it</h4>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 block">Título da Atividade</label>
                    <input ref={tituloInputRef} type="text" required autoFocus placeholder="Ex: Módulo 08 - Fórum" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800" value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})}/>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">Enunciado da Tarefa</label>
                      <div className="flex items-center gap-2">
                        {enunciadoArquivoUrl ? (
                          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200 animate-in zoom-in">
                            <FileCheck size={12}/>
                            <span className="text-[10px] font-black uppercase truncate max-w-[100px]">{enunciadoArquivoNome}</span>
                            <button type="button" onClick={() => { setEnunciadoArquivoUrl(''); setEnunciadoArquivoNome(''); }} className="hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                          </div>
                        ) : (
                          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                            {uploading ? <RefreshCw size={12} className="animate-spin"/> : <FileUp size={12}/>}
                            <span className="text-[10px] font-black uppercase">{uploading ? 'Subindo...' : 'Anexar PDF/Doc'}</span>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUploadEnunciado} disabled={uploading}/>
                          </label>
                        )}
                      </div>
                    </div>
                    <textarea placeholder="Cole o texto ou anexe um arquivo acima..." rows="5" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-700 resize-none leading-relaxed" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})}/>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-black text-slate-800 uppercase mb-2 block">Início</label>
                      <input type="date" className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={novaTarefa.dataInicio} onChange={e => setNovaTarefa({...novaTarefa, dataInicio: e.target.value})}/>
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-800 uppercase mb-2 block">Prazo Final</label>
                      <input type="date" className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={novaTarefa.dataFim} onChange={e => setNovaTarefa({...novaTarefa, dataFim: e.target.value})}/>
                    </div>
                  </div>

                  {novaTarefa.tipo === 'entrega' && (
                    <div className="mt-6 border-t border-slate-100 pt-6 animate-in fade-in slide-in-from-bottom-2">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 block">Atribuição da Tarefa</label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <button type="button" onClick={() => setAtribuicaoEspecifica(false)} className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${!atribuicaoEspecifica ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                          <div className={`p-2 rounded-full ${!atribuicaoEspecifica ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Users size={18}/></div>
                          <div className="text-left">
                            <h4 className="font-black text-sm text-slate-800">Turma Completa</h4>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">Todos receberão a tarefa</p>
                          </div>
                        </button>

                        <button type="button" onClick={() => setAtribuicaoEspecifica(true)} className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${atribuicaoEspecifica ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                          <div className={`p-2 rounded-full ${atribuicaoEspecifica ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}><User size={18}/></div>
                          <div className="text-left">
                            <h4 className="font-black text-sm text-slate-800">Alunos Específicos</h4>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">Ex: Atividade de recuperação</p>
                          </div>
                        </button>
                      </div>

                      {atribuicaoEspecifica && alunosTurma.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto mt-2 animate-in slide-in-from-top-2">
                          <div className="flex justify-between items-center mb-3 sticky top-0 bg-slate-50 pb-2">
                            <span className="text-xs font-bold text-slate-500">Selecione os alunos:</span>
                            <span className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{alunosSelecionados.length} selecionados</span>
                          </div>
                          <div className="space-y-1">
                            {alunosTurma.map(aluno => (
                              <label key={aluno.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${alunosSelecionados.includes(aluno.id) ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-200 text-slate-700'}`}>
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                  checked={alunosSelecionados.includes(aluno.id)}
                                  onChange={() => toggleAlunoSelecao(aluno.id)}
                                />
                                <span className="text-sm truncate select-none">{aluno.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button disabled={salvando || uploading} className={`w-full text-white font-black py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 mt-4 text-xl active:scale-95 ${sucessoMsg ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {salvando ? <RefreshCw className="animate-spin" size={24}/> : sucessoMsg ? <><Check size={28}/> Sucesso!</> : 'Salvar no Cronograma'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
