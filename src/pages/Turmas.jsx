import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, Plus, ArrowRight, Pencil, Trash2, X, Check, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Turmas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [novaTurma, setNovaTurma] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const q = query(
          collection(db, 'turmas'),
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const turmasAtivas = turmasData.filter(t => t.status !== 'lixeira');
        setTurmas(turmasAtivas.sort((a, b) => b.dataCriacao?.toMillis() - a.dataCriacao?.toMillis()));
      } catch (error) {
        console.error("Erro ao buscar turmas:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada]);

  async function handleCriarTurma(e) {
    e.preventDefault();
    if (!novaTurma.trim()) return;

    try {
      setSalvando(true);
      const novaTurmaObj = {
        nome: novaTurma.trim(),
        instituicaoId: escolaSelecionada.id,
        instituicaoNome: escolaSelecionada.nome, 
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'turmas'), novaTurmaObj);
      setTurmas([{ id: docRef.id, ...novaTurmaObj }, ...turmas]);
      setNovaTurma('');
    } catch (error) {
      console.error("Erro ao criar turma:", error);
      alert("Erro ao criar a turma.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    try {
      await updateDoc(doc(db, 'turmas', id), { nome: nomeEdicao.trim() });
      setTurmas(turmas.map(t => t.id === id ? { ...t, nome: nomeEdicao.trim() } : t));
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar turma:", error);
    }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Tem certeza que deseja enviar a turma "${nome}" para a lixeira?\n\nAlunos e tarefas vinculados deixarão de aparecer nos relatórios principais.`)) return;
    
    try {
      await updateDoc(doc(db, 'turmas', id), { status: 'lixeira' });
      setTurmas(turmas.filter(t => t.id !== id));
    } catch (error) {
      console.error("Erro ao enviar para lixeira:", error);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8">
      <Breadcrumb items={[{ label: 'Turmas' }]} />

      <div className="flex items-center gap-3 mb-8 mt-3">
        <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm">
          <BookOpen size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800 leading-tight">Minhas Turmas</h1>
          <p className="text-gray-500 text-sm font-medium mt-0.5">
            Gerencie os agrupamentos em: <strong className="text-gray-700">{escolaSelecionada?.nome}</strong>
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* BLOCO 1: Lista de Turmas */}
        <div className="w-full lg:w-2/3 order-1">
          {loading ? (
             <div className="text-gray-400 font-medium animate-pulse text-center py-10">Carregando suas turmas...</div>
          ) : turmas.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center">
              <BookOpen className="text-gray-300 w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-black text-gray-700 mb-2">Nenhuma turma criada</h3>
              <p className="text-gray-500 mb-6 text-sm">Utilize o formulário abaixo para criar o seu primeiro agrupamento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {turmas.map(turma => (
                <div key={turma.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all overflow-hidden flex flex-col group">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><BookOpen size={20}/></div>
                      
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(turma.id); setNomeEdicao(turma.nome); }} 
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar Nome"
                        >
                          <Pencil size={18}/>
                        </button>
                        <button 
                          onClick={() => handleLixeira(turma.id, turma.nome)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Mover para Lixeira"
                        >
                          <Trash2 size={18}/>
                        </button>
                      </div>
                    </div>
                    
                    {editandoId === turma.id ? (
                      <div className="flex items-center gap-2 mb-1 mt-2">
                        <input 
                          type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} 
                          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" autoFocus 
                        />
                        <button onClick={() => handleSalvarEdicao(turma.id)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                        <button onClick={() => setEditandoId(null)} className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                      </div>
                    ) : (
                      <h3 className="font-black text-gray-800 text-xl mb-1 truncate">{turma.nome}</h3>
                    )}
                    <p className="text-xs text-gray-400 font-medium">Turma Ativa</p>
                  </div>
                  
                  {/* O ERRO FOI CORRIGIDO AQUI NO LINK DE TAREFAS */}
                  <div className="bg-gray-50 border-t border-gray-100 p-3 grid grid-cols-2 gap-2">
                    <Link to="/alunos" className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors">
                      <Users size={16}/> Alunos
                    </Link>
                    <Link to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors">
                      <FileText size={16}/> Tarefas <ArrowRight size={14}/>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOCO 2: Formulário de Criação */}
        <div className="w-full lg:w-1/3 order-2">
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 sticky top-24">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={16}/> Cadastrar Turma
            </h2>
            <form onSubmit={handleCriarTurma} className="flex flex-col gap-3">
              <input
                type="text" required placeholder="Ex: Turma de Odonto..."
                className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium outline-none"
                value={novaTurma} onChange={(e) => setNovaTurma(e.target.value)}
              />
              <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex justify-center items-center gap-2">
                {salvando ? 'Salvando...' : 'Criar Turma'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
