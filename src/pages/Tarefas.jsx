import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Check, X, CalendarClock, AlertCircle } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const [turmaAtiva, setTurmaAtiva] = useState(location.state?.turmaIdSelecionada || '');

  // Estados para Criação (Agora com dataFim)
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', enunciado: '', dataFim: '' });
  const [salvando, setSalvando] = useState(false);

  // Estados para Edição Inline
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');

  // 1. Busca as Turmas da Instituição
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
        
        if (turmasData.length > 0 && !turmaAtiva) {
          setTurmaAtiva(turmasData[0].id);
        }
      } catch (error) {
        console.error("Erro ao buscar turmas:", error);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  // 2. Busca as Tarefas da Turma Ativa
  useEffect(() => {
    async function fetchTarefas() {
      if (!turmaAtiva) {
        setTarefas([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const qA = query(collection(db, 'tarefas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('turmaId', '==', turmaAtiva)
        );
        const snapA = await getDocs(qA);
        const tarefasData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        
        setTarefas(tarefasData.sort((a, b) => b.dataCriacao?.toMillis() - a.dataCriacao?.toMillis()));
      } catch (error) {
        console.error("Erro ao buscar tarefas:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTarefas();
  }, [turmaAtiva, escolaSelecionada]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!novaTarefa.titulo || !turmaAtiva) return;

    try {
      setSalvando(true);
      
      // Converte a string de data do input para Firebase Timestamp
      const prazoFinal = novaTarefa.dataFim ? Timestamp.fromDate(new Date(novaTarefa.dataFim)) : null;

      const tarefaData = {
        nomeTarefa: novaTarefa.titulo.trim(),
        enunciado: novaTarefa.enunciado.trim(),
        dataFim: prazoFinal, // Campo essencial para Comunicação e Pendências
        turmaId: turmaAtiva,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'tarefas'), tarefaData);
      setTarefas([{ id: docRef.id, ...tarefaData, dataCriacao: Timestamp.now() }, ...tarefas]);
      setNovaTarefa({ titulo: '', enunciado: '', dataFim: '' });
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao(id) {
    if (!tituloEdicao.trim()) return;
    try {
      const prazoFinal = dataFimEdicao ? Timestamp.fromDate(new Date(dataFimEdicao)) : null;
      
      await updateDoc(doc(db, 'tarefas', id), { 
        nomeTarefa: tituloEdicao.trim(),
        enunciado: enunciadoEdicao.trim(),
        dataFim: prazoFinal
      });
      
      setTarefas(tarefas.map(t => t.id === id ? { 
        ...t, 
        nomeTarefa: tituloEdicao.trim(), 
        enunciado: enunciadoEdicao.trim(),
        dataFim: prazoFinal
      } : t));
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar:", error);
    }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Mover a tarefa "${nome}" para a lixeira?`)) return;
    try {
      await updateDoc(doc(db, 'tarefas', id), { status: 'lixeira' });
      setTarefas(tarefas.filter(t => t.id !== id));
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  }

  const formatarDataLocal = (ts) => {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Converte Timestamp para formato de input datetime-local (yyyy-MM-ddThh:mm)
  const tsToInput = (ts) => {
    if (!ts || !ts.toDate) return "";
    const d = ts.toDate();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const tarefasFiltradas = tarefas.filter(t => {
    const nomeSeguro = t.nomeTarefa || t.titulo || '';
    return nomeSeguro.toLowerCase().includes(busca.toLowerCase());
  });

  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      
      <div className="mb-6">
        <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Tarefas' }]} />
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 mt-3 tracking-tight">
          <FileText className="text-orange-500" size={22} /> Gestão de Tarefas
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Criação */}
        <div className="lg:col-span-1">
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
            
            <div className="mb-6 pb-4 border-b border-gray-100">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Turma Ativa</label>
              <select 
                className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-700 transition-colors cursor-pointer"
                value={turmaAtiva} onChange={e => setTurmaAtiva(e.target.value)}
              >
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>

            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Cadastrar Nova Tarefa</h2>
            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título da Tarefa</label>
                <input
                  type="text" required placeholder="Ex: Atividade M01..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium"
                  value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})}
                />
              </div>

              {/* CAMPO DE PRAZO FINAL ADICIONADO */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Prazo de Entrega (Data e Hora)</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium"
                  value={novaTarefa.dataFim} onChange={e => setNovaTarefa({...novaTarefa, dataFim: e.target.value})}
                />
                <p className="text-[9px] text-gray-400 mt-1 ml-1 leading-tight">Define o tom das mensagens de cobrança automática.</p>
              </div>
              
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Instruções do Enunciado</label>
                <textarea
                  placeholder="Instruções para a IA e para o aluno..." rows="3"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium resize-none"
                  value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})}
                />
              </div>

              <button disabled={salvando || !turmaAtiva} className="w-full bg-orange-500 text-white font-black py-4 rounded-xl hover:bg-orange-600 transition-all shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                <Plus size={20}/> {salvando ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Tarefas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Lista de Tarefas: <strong className="text-blue-600">{getNomeTurmaAtiva()}</strong>
            </h2>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
            <input 
              type="text" placeholder="Procurar tarefa..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm"
              value={busca} onChange={e => setBusca(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="p-10 text-center animate-pulse font-bold text-gray-400">Sincronizando tarefas...</div>
          ) : tarefasFiltradas.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">Nenhuma tarefa ativa nesta turma.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tarefasFiltradas.map(tarefa => {
                const nomeSeguro = tarefa.nomeTarefa || tarefa.titulo || 'Tarefa sem nome';
                
                return (
                <div key={tarefa.id} className={`bg-white p-5 rounded-2xl border transition-all group ${editandoId === tarefa.id ? 'border-blue-400 shadow-md ring-2 ring-blue-50' : 'border-gray-200 shadow-sm hover:border-orange-200'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-orange-50 text-orange-500 p-2.5 rounded-xl">
                      <FileText size={22}/>
                    </div>
                    {editandoId !== tarefa.id && (
                      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(tarefa.id); setTituloEdicao(nomeSeguro); setEnunciadoEdicao(tarefa.enunciado || ''); setDataFimEdicao(tsToInput(tarefa.dataFim)); }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={18}/>
                        </button>
                        <button 
                          onClick={() => handleLixeira(tarefa.id, nomeSeguro)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    )}
                  </div>

                  {editandoId === tarefa.id ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Título</label>
                        <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold outline-none" value={tituloEdicao} onChange={e => setTituloEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Novo Prazo</label>
                        <input type="datetime-local" className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold outline-none" value={dataFimEdicao} onChange={e => setDataFimEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Enunciado</label>
                        <textarea className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm outline-none resize-none" value={enunciadoEdicao} onChange={e => setEnunciadoEdicao(e.target.value)} rows="3"/>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSalvarEdicao(tarefa.id)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-1 shadow-sm"><Check size={16}/> Confirmar</button>
                        <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-500 py-2.5 rounded-lg font-bold flex items-center justify-center gap-1"><X size={16}/> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-black text-gray-800 text-lg leading-tight truncate pr-4">{nomeSeguro}</h3>
                        
                        {/* RELÓGIO VISUAL DA TAREFA */}
                        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                          <CalendarClock size={14} className={tarefa.dataFim ? "text-blue-500" : "text-gray-300"} />
                          <span className="text-[10px] font-bold text-gray-600">
                            {tarefa.dataFim ? formatarDataLocal(tarefa.dataFim) : "Sem prazo"}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-500 text-sm line-clamp-2 font-medium italic mt-2">
                        {tarefa.enunciado || "Sem enunciado definido."}
                      </p>
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
