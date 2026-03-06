import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, Plus, ArrowRight, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Turmas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novaTurma, setNovaTurma] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada) return;
      try {
        const q = query(
          collection(db, 'turmas'),
          where('instituicao', '==', escolaSelecionada),
          where('professorUid', '==', currentUser.uid)
        );
        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTurmas(turmasData.sort((a, b) => b.dataCriacao?.toMillis() - a.dataCriacao?.toMillis()));
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
        instituicao: escolaSelecionada,
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* BREADCRUMB INSERIDO AQUI */}
      <Breadcrumb items={[{ label: 'Turmas' }]} />

      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 text-blue-700 p-3 rounded-xl shadow-sm">
          <GraduationCapIcon />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800 leading-tight">Minhas Turmas</h1>
          <p className="text-gray-500 text-sm font-medium mt-0.5">
            Gerencie os agrupamentos de alunos em: <strong className="text-gray-700">{escolaSelecionada}</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Formulário de Criação */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-24">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Cadastrar Nova Turma</h2>
            <form onSubmit={handleCriarTurma} className="flex flex-col gap-3">
              <input
                type="text" required placeholder="Ex: Turma de Odonto..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                value={novaTurma} onChange={(e) => setNovaTurma(e.target.value)}
              />
              <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md flex justify-center items-center gap-2">
                {salvando ? 'Salvando...' : <><Plus size={18}/> Criar Turma</>}
              </button>
            </form>
          </div>
        </div>

        {/* Lista de Turmas */}
        <div className="lg:col-span-2">
          {loading ? (
             <div className="text-gray-400 font-medium animate-pulse text-center py-10">Carregando suas turmas...</div>
          ) : turmas.length === 0 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <BookOpen className="text-gray-300 w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-black text-gray-700 mb-2">Nenhuma turma criada</h3>
              <p className="text-gray-500 mb-6">Utilize o formulário ao lado para criar o seu primeiro agrupamento de alunos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {turmas.map(turma => (
                <div key={turma.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><BookOpen size={20}/></div>
                      <span className="bg-green-50 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider">Ativa</span>
                    </div>
                    <h3 className="font-black text-gray-800 text-xl mb-1">{turma.nome}</h3>
                    <p className="text-xs text-gray-400 font-medium">Criada recentemente</p>
                  </div>
                  
                  <div className="bg-gray-50 border-t border-gray-100 p-3 grid grid-cols-2 gap-2">
                    <Link to="/alunos" className="flex items-center justify-center gap-1.5 text-sm font-bold text-gray-600 hover:text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors">
                      <Users size={16}/> Alunos
                    </Link>
                    {/* AQUI ESTÁ A CORREÇÃO: Passando o state do ID da turma */}
                    <Link to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="flex items-center justify-center gap-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50 py-2 rounded-lg transition-colors">
                      Tarefas <ArrowRight size={16}/>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Subcomponente de ícone para não poluir o import
function GraduationCapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.42 10.922a2 2 0 0 0-.019-3.838L12.83 4.347a2 2 0 0 0-1.66 0L2.6 7.08a2 2 0 0 0 0 3.832l8.57 2.733a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
  )
}
