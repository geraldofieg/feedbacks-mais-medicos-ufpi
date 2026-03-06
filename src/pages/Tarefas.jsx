import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Check, X } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Estados para Criação
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '',
    enunciado: '',
    turmaId: location.state?.turmaIdSelecionada || ''
  });
  const [salvando, setSalvando] = useState(false);

  // Estados para Edição Inline
  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);

        const qA = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapA = await getDocs(qA);
        const tarefasData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTarefas(tarefasData);
        
        if (turmasData.length > 0 && !novaTarefa.turmaId) {
          setNovaTarefa(prev => ({ ...prev, turmaId: turmasData[0].id }));
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentUser, escolaSelecionada]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!novaTarefa.titulo || !novaTarefa.turmaId) return;

    try {
      setSalvando(true);
      const tarefaData = {
        nomeTarefa: novaTarefa.titulo.trim(),
        enunciado: novaTarefa.enunciado.trim(),
        turmaId: novaTarefa.turmaId,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'tarefas'), tarefaData);
      setTarefas([{ id: docRef.id, ...tarefaData }, ...tarefas]);
      setNovaTarefa({ ...novaTarefa, titulo: '', enunciado: '' });
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao(id) {
    if (!tituloEdicao.trim()) return;
    try {
      await updateDoc(doc(db, 'tarefas', id), { 
        nomeTarefa: tituloEdicao.trim(),
        enunciado: enunciadoEdicao.trim()
      });
      setTarefas(tarefas.map(t => t.id === id ? { ...t, nomeTarefa: tituloEdicao.trim(), enunciado: enunciadoEdicao.trim() } : t));
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

  // A CORREÇÃO ANTI-CRASH ESTÁ AQUI: Tolera dados antigos sem quebrar a tela
  const tarefasFiltradas = tarefas.filter(t => {
    const nomeSeguro = t.nomeTarefa || t.titulo || '';
    return nomeSeguro.toLowerCase().includes(busca.toLowerCase());
  });

  if (loading) return <div className="p-10 text-center animate-pulse font-bold text-gray-400">Carregando tarefas...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb unificado */}
      <Breadcrumb items={[{ label: `Tarefas (${escolaSelecionada?.nome})` }]} />
      
      <div className="flex items-center gap-3 mb-8 mt-4">
        <div className="bg-orange-100 text-orange-600 p-3 rounded-xl shadow-sm">
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Gestão de Tarefas</h1>
          <p className="text-gray-500 text-sm font-medium">Configure as atividades para as suas turmas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Criação (Lateral no Desktop) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Cadastrar Nova Tarefa</h2>
            <form onSubmit={handleCriar} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Título da Tarefa</label>
                <input
                  type="text" required placeholder="Ex: Desafio 01, Fórum..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium transition-all"
                  value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})}
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Enunciado / Instruções</label>
                <textarea
                  placeholder="O que o aluno deve fazer?" rows="3"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium resize-none transition-all"
                  value={novaTarefa.enunciado} onChange={e => setNovaTarefa({...novaTarefa, enunciado: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Turma Destinada</label>
                <select 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-700"
                  value={novaTarefa.turmaId} onChange={e => setNovaTarefa({...novaTarefa, turmaId: e.target.value})}
                >
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <button disabled={salvando} className="w-full bg-orange-500 text-white font-black py-4 rounded-xl hover:bg-orange-600 transition-all shadow-md flex items-center justify-center gap-2 mt-2">
                <Plus size={20}/> {salvando ? 'Salvando...' : 'Criar Tarefa'}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Tarefas (Principal) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Minhas Tarefas Criadas</h2>
            <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">{tarefas.length}</span>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
            <input 
              type="text" placeholder="Procurar tarefa pelo nome..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm"
              value={busca} onChange={e => setBusca(e.target.value)}
            />
          </div>

          {tarefasFiltradas.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">Nenhuma tarefa encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {tarefasFiltradas.map(tarefa => {
                // Outra proteção contra dados velhos
                const nomeSeguro = tarefa.nomeTarefa || tarefa.titulo || 'Tarefa sem nome';
                
                return (
                <div key={tarefa.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-orange-50 text-orange-500 p-2.5 rounded-xl">
                      <FileText size={22}/>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditandoId(tarefa.id); setTituloEdicao(nomeSeguro); setEnunciadoEdicao(tarefa.enunciado || ''); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar Tarefa"
                      >
                        <Pencil size={18}/>
                      </button>
                      <button 
                        onClick={() => handleLixeira(tarefa.id, nomeSeguro)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Apagar Tarefa"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>

                  {editandoId === tarefa.id ? (
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <input 
                        className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 font-bold outline-none" 
                        value={tituloEdicao} onChange={e => setTituloEdicao(e.target.value)}
                      />
                      <textarea 
                        className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm outline-none resize-none" 
                        value={enunciadoEdicao} onChange={e => setEnunciadoEdicao(e.target.value)} rows="3"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleSalvarEdicao(tarefa.id)} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1"><Check size={16}/> Salvar</button>
                        <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-500 py-2 rounded-lg font-bold flex items-center justify-center gap-1"><X size={16}/> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-black text-gray-800 text-lg leading-tight mb-1">{nomeSeguro}</h3>
                      <p className="text-gray-500 text-sm line-clamp-2 mb-4 font-medium italic">
                        {tarefa.enunciado || "Sem enunciado definido."}
                      </p>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded">
                           {turmas.find(t => t.id === tarefa.turmaId)?.nome || 'Turma Removida'}
                         </span>
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
