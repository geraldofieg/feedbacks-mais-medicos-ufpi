import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Check, X, CalendarClock, Calendar, StickyNote, Info } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [turmaAtiva, setTurmaAtiva] = useState(location.state?.turmaIdSelecionada || '');

  // Estados para Criação (Agora com 'tipo')
  const [novaTarefa, setNovaTarefa] = useState({ 
    titulo: '', 
    enunciado: '', 
    dataFim: '', 
    tipo: 'entrega' // Padrão: Entrega de Aluno
  });
  const [salvando, setSalvando] = useState(false);

  // Estados para Edição Inline
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [tipoEdicao, setTipoEdicao] = useState('entrega');

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        if (turmasData.length > 0 && !turmaAtiva) setTurmaAtiva(turmasData[0].id);
      } catch (error) { console.error("Erro ao buscar turmas:", error); }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  useEffect(() => {
    async function fetchTarefas() {
      if (!turmaAtiva) { setTarefas([]); setLoading(false); return; }
      setLoading(true);
      try {
        const qA = query(collection(db, 'tarefas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('turmaId', '==', turmaAtiva)
        );
        const snapA = await getDocs(qA);
        const tarefasData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTarefas(tarefasData.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0)));
      } catch (error) { console.error("Erro ao buscar tarefas:", error); } 
      finally { setLoading(false); }
    }
    fetchTarefas();
  }, [turmaAtiva, escolaSelecionada]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!novaTarefa.titulo || !turmaAtiva) return;
    try {
      setSalvando(true);
      const prazoFinal = novaTarefa.dataFim ? Timestamp.fromDate(new Date(novaTarefa.dataFim)) : null;
      const tarefaData = {
        nomeTarefa: novaTarefa.titulo.trim(),
        enunciado: novaTarefa.enunciado.trim(),
        dataFim: prazoFinal,
        tipo: novaTarefa.tipo, // NOVO: Define se é Entrega, Compromisso ou Lembrete
        turmaId: turmaAtiva,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'tarefas'), tarefaData);
      setTarefas([{ id: docRef.id, ...tarefaData, dataCriacao: Timestamp.now() }, ...tarefas]);
      setNovaTarefa({ titulo: '', enunciado: '', dataFim: '', tipo: 'entrega' });
    } catch (error) { console.error("Erro ao criar:", error); } 
    finally { setSalvando(false); }
  }

  async function handleSalvarEdicao(id) {
    if (!tituloEdicao.trim()) return;
    try {
      const prazoFinal = dataFimEdicao ? Timestamp.fromDate(new Date(dataFimEdicao)) : null;
      await updateDoc(doc(db, 'tarefas', id), { 
        nomeTarefa: tituloEdicao.trim(),
        enunciado: enunciadoEdicao.trim(),
        dataFim: prazoFinal,
        tipo: tipoEdicao
      });
      setTarefas(tarefas.map(t => t.id === id ? { ...t, nomeTarefa: tituloEdicao.trim(), enunciado: enunciadoEdicao.trim(), dataFim: prazoFinal, tipo: tipoEdicao } : t));
      setEditandoId(null);
    } catch (error) { console.error("Erro ao editar:", error); }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Mover "${nome}" para a lixeira?`)) return;
    try {
      await updateDoc(doc(db, 'tarefas', id), { status: 'lixeira' });
      setTarefas(tarefas.filter(t => t.id !== id));
    } catch (error) { console.error("Erro ao remover:", error); }
  }

  const formatarDataLocal = (ts) => {
    if (!ts || !ts.toDate) return "";
    return ts.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const tsToInput = (ts) => {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
    const getIconeTipo = (tipo) => {
    switch(tipo) {
      case 'entrega': return <FileText size={22} className="text-orange-500" />;
      case 'compromisso': return <Calendar size={22} className="text-purple-500" />;
      case 'lembrete': return <StickyNote size={22} className="text-blue-500" />;
      default: return <FileText size={22} />;
    }
  };

  const getCorTipo = (tipo) => {
    switch(tipo) {
      case 'entrega': return 'border-orange-200 hover:border-orange-400 bg-orange-50/20';
      case 'compromisso': return 'border-purple-200 hover:border-purple-400 bg-purple-50/20';
      case 'lembrete': return 'border-blue-200 hover:border-blue-400 bg-blue-50/20';
      default: return 'border-gray-200';
    }
  };

  const tarefasFiltradas = tarefas.filter(t => (t.nomeTarefa || t.titulo || '').toLowerCase().includes(busca.toLowerCase()));
  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Tarefas' }]} />
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 mt-3 tracking-tight">
          <FileText className="text-orange-500" size={22} /> Gestão e Cronograma
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
            <div className="mb-6 pb-4 border-b border-gray-100">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Turma Ativa</label>
              <select className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-700 cursor-pointer" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Adicionar ao Calendário</h2>
            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Tipo de Registro</label>
                <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 outline-none" value={novaTarefa.tipo} onChange={e => setNovaTarefa({...novaTarefa, tipo: e.target.value})}>
                  <option value="entrega">📝 Entrega de Aluno (Desafio)</option>
                  <option value="compromisso">📅 Compromisso (Aula/Reunião)</option>
                  <option value="lembrete">💡 Lembrete (Post-it)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título</label>
                <input type="text" required placeholder="Ex: Encontro no Zoom..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Data e Hora (Opcional)</label>
                <input type="datetime-local" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-blue-500 outline-none font-medium" value={novaTarefa.dataFim} onChange={e => setNovaTarefa({...novaTarefa, dataFim: e.target.value})} />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Observações / Enunciado</label>
                <textarea placeholder="Link do Zoom ou orientações..." rows="3" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-blue-500 outline-none font-medium resize-none" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})} />
              </div>

              <button disabled={salvando || !turmaAtiva} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                <Plus size={20}/> {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
            <input type="text" placeholder="Procurar no seu radar..." className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {loading ? (
            <div className="p-10 text-center animate-pulse font-bold text-gray-400">Sincronizando...</div>
          ) : tarefasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">Nenhum registro para esta turma.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tarefasFiltradas.map(tarefa => {
                const nomeSeguro = tarefa.nomeTarefa || tarefa.titulo || 'Sem nome';
                const tipo = tarefa.tipo || 'entrega';
                
                return (
                <div key={tarefa.id} className={`bg-white p-5 rounded-2xl border transition-all group ${editandoId === tarefa.id ? 'border-blue-400 shadow-md ring-2 ring-blue-50' : `${getCorTipo(tipo)} shadow-sm`}`}>
                  {editandoId === tarefa.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Título</label>
                          <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold text-sm outline-none" value={tituloEdicao} onChange={e => setTituloEdicao(e.target.value)}/>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Tipo</label>
                          <select className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold text-sm outline-none bg-white" value={tipoEdicao} onChange={e => setTipoEdicao(e.target.value)}>
                            <option value="entrega">Entrega</option>
                            <option value="compromisso">Compromisso</option>
                            <option value="lembrete">Lembrete</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Data/Hora</label>
                        <input type="datetime-local" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold text-sm outline-none" value={dataFimEdicao} onChange={e => setDataFimEdicao(e.target.value)}/>
                      </div>
                      <textarea className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm outline-none resize-none" value={enunciadoEdicao} onChange={e => setEnunciadoEdicao(e.target.value)} rows="3"/>
                      <div className="flex gap-2">
                        <button onClick={() => handleSalvarEdicao(tarefa.id)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-1 shadow-sm"><Check size={16}/> Salvar</button>
                        <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-500 py-2.5 rounded-lg font-bold flex items-center justify-center gap-1"><X size={16}/> Sair</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white rounded-xl shadow-inner border border-gray-100">{getIconeTipo(tipo)}</div>
                          <div>
                            <h3 className="font-black text-gray-800 text-base leading-tight pr-4">{nomeSeguro}</h3>
                            <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{tipo}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditandoId(tarefa.id); setTituloEdicao(nomeSeguro); setEnunciadoEdicao(tarefa.enunciado || ''); setDataFimEdicao(tsToInput(tarefa.dataFim)); setTipoEdicao(tipo); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={18}/></button>
                          <button onClick={() => handleLixeira(tarefa.id, nomeSeguro)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 mt-2">
                        <p className="text-gray-500 text-xs line-clamp-2 font-medium italic flex-1">
                          {tarefa.enunciado || "Sem observações."}
                        </p>
                        <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-[10px] ${tarefa.dataFim ? "bg-white text-gray-700 border-gray-100 shadow-sm" : "bg-gray-100 text-gray-400 border-transparent"}`}>
                          <CalendarClock size={14} className={tarefa.dataFim ? "text-blue-500" : "text-gray-300"} />
                          {tarefa.dataFim ? formatarDataLocal(tarefa.dataFim) : "Sem prazo"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
