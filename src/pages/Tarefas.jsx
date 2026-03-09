import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Calendar, StickyNote, GraduationCap, ArrowRight, CheckSquare } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [alunosTurma, setAlunosTurma] = useState([]); // Guarda os alunos para a atribuição
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  // A MÁGICA DA MEMÓRIA
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });

  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', enunciado: '', dataFim: '', tipo: 'entrega' });
  const [atribuicaoEspecifica, setAtribuicaoEspecifica] = useState(false); // Flag de Exceção
  const [alunosSelecionados, setAlunosSelecionados] = useState([]); // Quem vai receber a exceção
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [tipoEdicao, setTipoEdicao] = useState('entrega');

  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state]);

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

  // BUSCA AS TAREFAS E OS ALUNOS (PARA A ATRIBUIÇÃO MÁGICA)
  useEffect(() => {
    async function fetchDadosTurma() {
      if (!turmaAtiva) { setTarefas([]); setAlunosTurma([]); setLoading(false); return; }
      setLoading(true);
      try {
        // Busca Tarefas
        const qT = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id), where('turmaId', '==', turmaAtiva));
        const snapT = await getDocs(qT);
        const tarefasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTarefas(tarefasData.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0)));

        // Busca Alunos da Turma
        const qA = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapA = await getDocs(qA);
        setAlunosTurma(snapA.docs.map(d => ({ id: d.id, nome: d.data().nome })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome)));
        
        // Reseta o estado de seleção
        setAtribuicaoEspecifica(false);
        setAlunosSelecionados([]);

      } catch (error) { console.error("Erro fetch dados:", error); } 
      finally { setLoading(false); }
    }
    fetchDadosTurma();
  }, [turmaAtiva, escolaSelecionada]);

  const tsToInput = (ts) => {
    if (!ts) return "";
    try {
      let d;
      if (ts.toDate) d = ts.toDate();
      else if (ts instanceof Date) d = ts;
      else if (ts.seconds) d = new Date(ts.seconds * 1000);
      else d = new Date(ts);
      if (isNaN(d.getTime())) return "";
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch (e) { return ""; }
  };

  const iniciarEdicao = (t) => {
    const tiposValidos = ['entrega', 'compromisso', 'lembrete'];
    const tipoNormalizado = (t.tipo || 'entrega').toLowerCase();
    
    setTituloEdicao(t.nomeTarefa || t.titulo || 'Tarefa sem nome');
    setEnunciadoEdicao(t.enunciado || '');
    setDataFimEdicao(tsToInput(t.dataFim));
    setTipoEdicao(tiposValidos.includes(tipoNormalizado) ? tipoNormalizado : 'entrega');
    setEditandoId(t.id); 
  };

  async function handleSalvarEdicao(id) {
    if (!tituloEdicao.trim()) return;
    try {
      const prazoFinal = dataFimEdicao ? Timestamp.fromDate(new Date(dataFimEdicao)) : null;
      await updateDoc(doc(db, 'tarefas', id), { 
        nomeTarefa: tituloEdicao.trim(), enunciado: enunciadoEdicao.trim(),
        dataFim: prazoFinal, tipo: tipoEdicao
      });
      setTarefas(tarefas.map(t => t.id === id ? { ...t, nomeTarefa: tituloEdicao.trim(), enunciado: enunciadoEdicao.trim(), dataFim: prazoFinal, tipo: tipoEdicao } : t));
      setEditandoId(null);
    } catch (error) { console.error("Erro ao salvar:", error); }
  }

  // A MAGICA DA DISTRIBUIÇÃO ACONTECE AQUI
  async function handleCriar(e) {
    e.preventDefault();
    if (!novaTarefa.titulo || !turmaAtiva) return;
    
    // Trava de segurança: Se marcou a flag, tem que escolher pelo menos 1 aluno
    if (novaTarefa.tipo === 'entrega' && atribuicaoEspecifica && alunosSelecionados.length === 0) {
      alert("Selecione pelo menos um aluno para receber a tarefa.");
      return;
    }

    try {
      setSalvando(true);
      const prazoFinal = novaTarefa.dataFim ? Timestamp.fromDate(new Date(novaTarefa.dataFim)) : null;
      const tData = {
        nomeTarefa: novaTarefa.titulo.trim(), enunciado: novaTarefa.enunciado.trim(),
        dataFim: prazoFinal, tipo: novaTarefa.tipo, turmaId: turmaAtiva,
        instituicaoId: escolaSelecionada.id, professorUid: currentUser.uid,
        status: 'ativa', dataCriacao: serverTimestamp()
      };
      
      // 1. Salva a Tarefa "Mãe"
      const docRef = await addDoc(collection(db, 'tarefas'), tData);
      const novaId = docRef.id;

      // 2. Se for uma "Entrega", distribui as obrigações
      if (novaTarefa.tipo === 'entrega' && alunosTurma.length > 0) {
        const batch = writeBatch(db); // Usamos batch para salvar vários de uma vez sem estourar o banco
        
        // Define quem vai receber (a turma toda ou só os marcados)
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
        
        await batch.commit(); // Executa o salvamento em massa
      }

      setTarefas([{ id: novaId, ...tData, dataCriacao: Timestamp.now() }, ...tarefas]);
      setNovaTarefa({ titulo: '', enunciado: '', dataFim: '', tipo: 'entrega' });
      setAtribuicaoEspecifica(false);
      setAlunosSelecionados([]);
    } catch (error) { console.error("Erro criar:", error); } finally { setSalvando(false); }
  }

  const toggleAlunoSelecao = (alunoId) => {
    setAlunosSelecionados(prev => 
      prev.includes(alunoId) ? prev.filter(id => id !== alunoId) : [...prev, alunoId]
    );
  };

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Remover "${nome}"?`)) return;
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
    if (t === 'compromisso') return <Calendar size={22} className="text-purple-500" />;
    if (t === 'lembrete') return <StickyNote size={22} className="text-blue-500" />;
    return <FileText size={22} className="text-orange-500" />;
  };

  const getCorTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return 'border-purple-200 bg-purple-50/20';
    if (t === 'lembrete') return 'border-blue-200 bg-blue-50/20';
    return 'border-orange-200 bg-orange-50/20';
  };

  const getNomeVisivelTipo = (tipo) => {
    const t = (tipo || 'entrega').toLowerCase();
    if (t === 'compromisso') return 'Compromisso';
    if (t === 'lembrete') return 'Post-it';
    return 'Tarefa do Aluno';
  };

  const tarefasFiltradas = tarefas.filter(t => (t.nomeTarefa || t.titulo || '').toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Gestão e Cronograma' }]} />
      
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600"><GraduationCap size={24}/></div>
          <div>
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Turma Ativa</h2>
            <p className="text-xs text-gray-500 font-medium">Selecione para ver ou gerenciar os registros</p>
          </div>
        </div>
        {turmas.length > 0 && (
          <select className="w-full sm:w-auto px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl font-black text-blue-700 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        
        <div className="flex-1 lg:w-2/3 space-y-4">
          <input type="text" placeholder="Procurar no radar da turma..." className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-blue-500" value={busca} onChange={e => setBusca(e.target.value)} />
          
          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="text-center py-10 font-bold text-gray-400 animate-pulse">Carregando registros...</div>
            ) : tarefasFiltradas.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500 font-medium">Nenhum registro encontrado para esta turma.</p>
              </div>
            ) : (
              tarefasFiltradas.map(tarefa => (
                <div key={tarefa.id} className={`bg-white p-5 rounded-2xl border transition-all ${editandoId === tarefa.id ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : `${getCorTipo(tarefa.tipo)}`}`}>
                  {editandoId === tarefa.id ? (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold text-sm outline-none" value={tituloEdicao} onChange={e => setTituloEdicao(e.target.value)}/>
                        
                        <select className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold bg-white outline-none cursor-pointer" value={tipoEdicao} onChange={e => setTipoEdicao(e.target.value)}>
                          <option value="entrega">Tarefa do Aluno</option>
                          <option value="compromisso">Compromisso</option>
                          <option value="lembrete">Post-it</option>
                        </select>
                      </div>
                      <input type="datetime-local" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold text-sm outline-none" value={dataFimEdicao} onChange={e => setDataFimEdicao(e.target.value)}/>
                      <textarea className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm outline-none resize-none" value={enunciadoEdicao} onChange={e => setEnunciadoEdicao(e.target.value)} rows="3"/>
                      <div className="flex gap-2">
                        <button onClick={() => handleSalvarEdicao(tarefa.id)} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow-md">Salvar</button>
                        <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3 truncate">
                        <div className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100">{getIconeTipo(tarefa.tipo)}</div>
                        <div className="truncate">
                          {(tarefa.tipo === 'entrega' || !tarefa.tipo) ? (
                            <Link to={`/revisar/${tarefa.id}`} className="font-black text-orange-700 hover:text-orange-800 hover:underline truncate leading-tight flex items-center gap-1 group/link">
                              {tarefa.nomeTarefa || tarefa.titulo} <ArrowRight size={14} className="opacity-0 group-hover/link:opacity-100 transition-opacity hidden md:block"/>
                            </Link>
                          ) : (
                            <h3 className="font-black text-gray-800 truncate leading-tight">{tarefa.nomeTarefa || tarefa.titulo}</h3>
                          )}
                          
                          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            {getNomeVisivelTipo(tarefa.tipo)} • {tarefa.dataFim ? formatarDataLocal(tarefa.dataFim) : 'Sem data'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => iniciarEdicao(tarefa)} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={20}/></button>
                        <button onClick={() => handleLixeira(tarefa.id, tarefa.nomeTarefa || tarefa.titulo)} className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:w-1/3">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm lg:sticky lg:top-24">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={16}/> Adicionar à Turma
            </h2>
            <form onSubmit={handleCriar} className="space-y-4">
              
              <select className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" value={novaTarefa.tipo} onChange={e => {setNovaTarefa({...novaTarefa, tipo: e.target.value}); setAtribuicaoEspecifica(false);}}>
                <option value="entrega">📝 Tarefa do Aluno</option>
                <option value="compromisso">📅 Compromisso</option>
                <option value="lembrete">💡 Post-it</option>
              </select>
              
              <input type="text" required placeholder="Título..." className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})} />
              <input type="datetime-local" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" value={novaTarefa.dataFim} onChange={e => setNovaTarefa({...novaTarefa, dataFim: e.target.value})} />
              <textarea placeholder="Observações/Enunciado (Opcional)..." rows="3" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none resize-none focus:ring-2 focus:ring-blue-500" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})} />
              
              {/* O MENU DE EXCEÇÃO (APARECE SÓ SE FOR TAREFA DO ALUNO) */}
              {novaTarefa.tipo === 'entrega' && alunosTurma.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-600 cursor-pointer hover:text-gray-800 transition-colors mb-3">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                      checked={atribuicaoEspecifica}
                      onChange={(e) => setAtribuicaoEspecifica(e.target.checked)}
                    />
                    Atribuir apenas a alunos específicos (Exceção)
                  </label>
                  
                  {atribuicaoEspecifica && (
                    <div className="bg-white border border-gray-200 rounded-xl max-h-48 overflow-y-auto p-2 space-y-1 shadow-inner animate-in fade-in slide-in-from-top-2">
                      {alunosTurma.map(aluno => (
                        <label key={aluno.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                          <input 
                            type="checkbox"
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                            checked={alunosSelecionados.includes(aluno.id)}
                            onChange={() => toggleAlunoSelecao(aluno.id)}
                          />
                          <span className="text-sm font-medium text-gray-700 truncate">{aluno.nome}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button disabled={salvando || !turmaAtiva} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 mt-2"> {salvando ? 'Criando e Distribuindo...' : 'Adicionar Tarefa'} </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
