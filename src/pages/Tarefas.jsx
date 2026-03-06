import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Trash2, Search, X, BookOpen, AlertCircle, Pencil, Check } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  
  const location = useLocation();
  const turmaVindaDoDashboard = location.state?.turmaIdSelecionada || '';

  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  const [turmaSelecionada, setTurmaSelecionada] = useState(turmaVindaDoDashboard);

  // Controle do Modal de Criação
  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nomeTarefa, setNomeTarefa] = useState('');
  const [enunciado, setEnunciado] = useState('');

  // Controle de Edição (Inline)
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');

  // 1. Carrega as Turmas
  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada) return;
      try {
        const qTurmas = query(collection(db, 'turmas'), where('instituicao', '==', escolaSelecionada), where('professorUid', '==', currentUser.uid));
        const turmasSnap = await getDocs(qTurmas);
        const turmasData = turmasSnap.docs.map(t => ({ id: t.id, ...t.data() }));
        
        // Filtramos para só exibir turmas que não estão na lixeira
        const turmasAtivas = turmasData.filter(t => t.status !== 'lixeira');
        setTurmas(turmasAtivas);

        if (turmasAtivas.length > 0 && !turmaVindaDoDashboard) {
          setTurmaSelecionada(turmasAtivas[0].id);
        }
      } catch (error) {
        console.error("Erro ao buscar turmas:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada, turmaVindaDoDashboard]);

  // 2. Carrega as Tarefas (Ocultando a Lixeira)
  useEffect(() => {
    async function fetchTarefas() {
      if (!turmaSelecionada) return;
      try {
        const qTarefas = query(
          collection(db, 'tarefas'), 
          where('instituicao', '==', escolaSelecionada),
          where('turmaId', '==', turmaSelecionada)
        );
        const tarefasSnap = await getDocs(qTarefas);
        const tarefasData = tarefasSnap.docs.map(t => ({ id: t.id, ...t.data() }));
        
        // A MÁGICA DA LIXEIRA: Filtra tarefas ativas
        const tarefasAtivas = tarefasData.filter(t => t.status !== 'lixeira');
        
        setTarefas(tarefasAtivas.sort((a, b) => b.dataCriacao?.toMillis() - a.dataCriacao?.toMillis()));
      } catch (error) {
        console.error("Erro ao buscar tarefas:", error);
      }
    }
    fetchTarefas();
  }, [turmaSelecionada, escolaSelecionada]);

  // Criação
  async function handleSalvarTarefa(e) {
    e.preventDefault();
    if (!nomeTarefa.trim() || !turmaSelecionada) return;

    try {
      setSalvando(true);
      const novaTarefaObj = {
        nomeTarefa: nomeTarefa.trim(),
        enunciado: enunciado.trim(),
        turmaId: turmaSelecionada,
        instituicao: escolaSelecionada,
        professorUid: currentUser.uid,
        status: 'ativa', // Importante para a lixeira funcionar
        dataCriacao: serverTimestamp()
      };
      
      const tarefaRef = await addDoc(collection(db, 'tarefas'), novaTarefaObj);
      setTarefas([{ id: tarefaRef.id, ...novaTarefaObj }, ...tarefas]);
      
      setNomeTarefa('');
      setEnunciado('');
      setShowModal(false);
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
      alert("Falha ao criar a tarefa.");
    } finally {
      setSalvando(false);
    }
  }

  // Edição
  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    try {
      await updateDoc(doc(db, 'tarefas', id), { 
        nomeTarefa: nomeEdicao.trim(),
        enunciado: enunciadoEdicao.trim()
      });
      
      setTarefas(tarefas.map(t => t.id === id ? { ...t, nomeTarefa: nomeEdicao.trim(), enunciado: enunciadoEdicao.trim() } : t));
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar tarefa:", error);
      alert("Erro ao alterar os dados da tarefa.");
    }
  }

  // Soft Delete (Mover para Lixeira)
  async function handleLixeira(id, nome) {
    if (!window.confirm(`Tem certeza que deseja enviar a tarefa "${nome}" para a lixeira?`)) return;
    try {
      await updateDoc(doc(db, 'tarefas', id), { status: 'lixeira' });
      setTarefas(tarefas.filter(t => t.id !== id));
    } catch (error) {
      console.error("Erro ao enviar para lixeira:", error);
    }
  }

  const tarefasFiltradas = tarefas.filter(t => t.nomeTarefa.toLowerCase().includes(busca.toLowerCase()));
  const getNomeTurmaSelecionada = () => turmas.find(t => t.id === turmaSelecionada)?.nome || 'Turma';

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium animate-pulse">A aceder ao banco de dados...</div>;

  // ==========================================
  // ESTADO VAZIO EDUCATIVO (Não tem turmas ativas)
  // ==========================================
  if (turmas.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Tarefas' }]} />
        <div className="text-center mt-12">
          <div className="bg-orange-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-orange-500 w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 mb-4">Atenção!</h2>
          <p className="text-gray-600 text-lg mb-8 max-w-lg mx-auto">
            Para criar uma <strong>Tarefa</strong>, é necessário ter pelo menos uma turma cadastrada para associá-la.
          </p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-lg transform hover:-translate-y-1">
            <Plus size={20} /> Criar a Minha Primeira Turma
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // TELA PRINCIPAL
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* BREADCRUMB CORRIGIDO */}
      <Breadcrumb items={[
        { label: 'Turmas', path: '/turmas' },
        { label: `Tarefas (${getNomeTurmaSelecionada()})` }
      ]} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-orange-100 text-orange-700 p-3 rounded-xl shadow-sm shrink-0">
            <FileText size={28} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Gestão de Tarefas</h1>
            
            {/* SELETOR DE TURMA */}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-gray-500 text-sm font-medium">Turma:</span>
              <select 
                className="bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 py-1 px-2 font-bold cursor-pointer max-w-[200px] truncate"
                value={turmaSelecionada}
                onChange={(e) => setTurmaSelecionada(e.target.value)}
              >
                {turmas.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="w-full md:w-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
        >
          <Plus size={20} /> Nova Tarefa
        </button>
      </div>

      {tarefas.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input 
            type="text" placeholder="Procurar tarefa..." 
            className="w-full bg-transparent border-none focus:ring-0 text-gray-700 font-medium placeholder-gray-400"
            value={busca} onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      )}

      {tarefas.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <FileText className="text-gray-300 w-16 h-16 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-700 mb-2">Nenhuma tarefa criada</h3>
          <p className="text-gray-500 mb-6">Esta turma ainda não possui avaliações ou atividades cadastradas.</p>
          <button onClick={() => setShowModal(true)} className="bg-white border border-gray-200 text-blue-600 font-bold py-2.5 px-6 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            Criar a Primeira Tarefa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tarefasFiltradas.map(tarefa => (
            <div key={tarefa.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col">
              
              {/* BOTÕES DE AÇÃO (Lápis e Lixeira) */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={() => { setEditandoId(tarefa.id); setNomeEdicao(tarefa.nomeTarefa); setEnunciadoEdicao(tarefa.enunciado || ''); }} 
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar Tarefa"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => handleLixeira(tarefa.id, tarefa.nomeTarefa)} 
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Mover para Lixeira"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              {editandoId === tarefa.id ? (
                // MODO DE EDIÇÃO INLINE
                <div className="flex-1 mt-8 mb-4 flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={nomeEdicao} 
                    onChange={(e) => setNomeEdicao(e.target.value)} 
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" 
                    placeholder="Nome da Tarefa"
                    autoFocus 
                  />
                  <textarea 
                    value={enunciadoEdicao} 
                    onChange={(e) => setEnunciadoEdicao(e.target.value)} 
                    className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 resize-none" 
                    rows="3"
                    placeholder="Enunciado (Opcional)"
                  />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleSalvarEdicao(tarefa.id)} className="flex-1 bg-green-500 text-white py-1.5 rounded-lg hover:bg-green-600 shadow-sm flex items-center justify-center gap-1 text-sm font-bold"><Check size={16}/> Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-200 text-gray-600 py-1.5 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-1 text-sm font-bold"><X size={16}/> Cancelar</button>
                  </div>
                </div>
              ) : (
                // MODO DE VISUALIZAÇÃO
                <div className="flex-1">
                  <div className="bg-orange-50 text-orange-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 mb-2 pr-12">{tarefa.nomeTarefa}</h3>
                  <p className="text-gray-500 text-sm line-clamp-3 mb-4">{tarefa.enunciado || 'Sem enunciado cadastrado.'}</p>
                </div>
              )}
              
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-auto">
                <span className="text-xs font-bold text-gray-400 uppercase">Módulo Base</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><FileText className="text-blue-600"/> Nova Tarefa</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSalvarTarefa} className="p-6 space-y-5">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2 mb-2">
                <BookOpen className="text-blue-500 mt-0.5" size={16}/>
                <p className="text-xs text-blue-800 font-medium">A tarefa será criada na turma: <strong>{getNomeTurmaSelecionada()}</strong></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Nome / Título da Tarefa</label>
                <input 
                  type="text" required autoFocus placeholder="Ex: Fórum 01, Desafio Final..." 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-colors font-medium" 
                  value={nomeTarefa} onChange={(e) => setNomeTarefa(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Enunciado / Instruções (Opcional)</label>
                <textarea 
                  rows="4" placeholder="Descreva o que o aluno deve fazer..." 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-colors font-medium resize-none" 
                  value={enunciado} onChange={(e) => setEnunciado(e.target.value)} 
                />
              </div>

              <div className="pt-2">
                <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-black py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:opacity-50">
                  {salvando ? 'A gravar...' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
