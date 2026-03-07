import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Check, X, CalendarClock, Calendar, StickyNote } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [turmaAtiva, setTurmaAtiva] = useState(location.state?.turmaIdSelecionada || '');

  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', enunciado: '', dataFim: '', tipo: 'entrega' });
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [tipoEdicao, setTipoEdicao] = useState('entrega');

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        if (turmasData.length > 0 && !turmaAtiva) setTurmaAtiva(turmasData[0].id);
      } catch (error) { console.error("Erro fetch turmas:", error); }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  useEffect(() => {
    async function fetchTarefas() {
      if (!turmaAtiva) { setTarefas([]); setLoading(false); return; }
      setLoading(true);
      try {
        const qA = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id), where('turmaId', '==', turmaAtiva));
        const snapA = await getDocs(qA);
        const tarefasData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTarefas(tarefasData.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0)));
      } catch (error) { console.error("Erro fetch tarefas:", error); } 
      finally { setLoading(false); }
    }
    fetchTarefas();
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

  async function handleCriar(e) {
    e.preventDefault();
    if (!novaTarefa.titulo || !turmaAtiva) return;
    try {
      setSalvando(true);
      const prazoFinal = novaTarefa.dataFim ? Timestamp.fromDate(new Date(novaTarefa.dataFim)) : null;
      const tData = {
        nomeTarefa: novaTarefa.titulo.trim(), enunciado: novaTarefa.enunciado.trim(),
        dataFim: prazoFinal, tipo: novaTarefa.tipo, turmaId: turmaAtiva,
        instituicaoId: escolaSelecionada.id, professorUid: currentUser.uid,
        status: 'ativa', dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'tarefas'), tData);
      setTarefas([{ id: docRef.id, ...tData, dataCriacao: Timestamp.now() }, ...tarefas]);
      setNovaTarefa({ titulo: '', enunciado: '', dataFim: '', tipo: 'entrega' });
    } catch (error) { console.error("Erro criar:", error); } finally { setSalvando(false); }
  }

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

  const tarefasFiltradas = tarefas.filter(t => (t.nomeTarefa || t.titulo || '').toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Gestão e Cronograma' }]} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-1">
          {/* A CORREÇÃO ESTÁ AQUI: lg:sticky e lg:top-24 matam o fantasma no celular */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm lg:sticky lg:top-24">
            <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Turma Ativa</label>
            <select className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl mb-6 font-black text-blue-700 outline-none" value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <form onSubmit={handleCriar} className="space-y-4">
              <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none" value={novaTarefa.tipo} onChange={e => setNovaTarefa({...novaTarefa, tipo: e.target.value})}>
                <option value="entrega">📝 Entrega (Desafio)</option>
                <option value="compromisso">📅 Compromisso (Aula)</option>
                <option value="lembrete">💡 Lembrete (Post-it)</option>
              </select>
              <input type="text" required placeholder="Título..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})} />
              <input type="datetime-local" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none" value={novaTarefa.dataFim} onChange={e => setNovaTarefa({...novaTarefa, dataFim: e.target.value})} />
              <textarea placeholder="Observações..." rows="3" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none resize-none" value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})} />
              <button disabled={salvando} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-md"> {salvando ? 'Salvando...' : 'Adicionar'} </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <input type="text" placeholder="Procurar no radar..." className="w-full px-6 py-4 bg-white border border-gray-200 rounded-2xl outline-none shadow-sm" value={busca} onChange={e => setBusca(e.target.value)} />
          <div className="grid grid-cols-1 gap-4">
            {tarefasFiltradas.map(tarefa => (
              <div key={tarefa.id} className={`bg-white p-5 rounded-2xl border transition-all ${editandoId === tarefa.id ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : `${getCorTipo(tarefa.tipo)}`}`}>
                {editandoId === tarefa.id ? (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-200">
                    <div className="grid grid-cols-2 gap-3">
                      <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold text-sm outline-none" value={tituloEdicao} onChange={e => setTituloEdicao(e.target.value)}/>
                      <select className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold bg-white outline-none" value={tipoEdicao} onChange={e => setTipoEdicao(e.target.value)}>
                        <option value="entrega">Entrega</option>
                        <option value="compromisso">Compromisso</option>
                        <option value="lembrete">Lembrete</option>
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
                        <h3 className="font-black text-gray-800 truncate leading-tight">{tarefa.nomeTarefa || tarefa.titulo}</h3>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          {tarefa.tipo || 'entrega'} • {tarefa.dataFim ? formatarDataLocal(tarefa.dataFim) : 'Sem data'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => iniciarEdicao(tarefa)} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Pencil size={20}/></button>
                      <button onClick={() => handleLixeira(tarefa.id, tarefa.nomeTarefa || tarefa.titulo)} className="p-2.5 text-red-400 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
