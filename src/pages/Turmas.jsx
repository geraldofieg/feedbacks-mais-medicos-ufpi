import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, BookOpen, ArrowRight, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Turmas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [nomeNovaTurma, setNomeNovaTurma] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada) return;
      
      try {
        // A TRAVA DE SEGURANÇA: Busca só as turmas desta escola E deste professor
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
        
        // Ordena da mais nova para a mais antiga (em memória, para não exigir índice no Firebase)
        turmasData.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0));
        
        setTurmas(turmasData);
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
    if (!nomeNovaTurma.trim()) return;

    try {
      setSalvando(true);
      const novaTurma = {
        nome: nomeNovaTurma,
        instituicao: escolaSelecionada,
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'turmas'), novaTurma);
      
      // Atualiza a tela imediatamente com a turma nova
      setTurmas([{ id: docRef.id, ...novaTurma, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]);
      setNomeNovaTurma(''); // Limpa o campo
    } catch (error) {
      console.error("Erro ao criar turma:", error);
      alert("Erro ao criar turma. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 text-blue-700 p-3 rounded-xl">
          <GraduationCap size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800">Minhas Turmas</h1>
          <p className="text-gray-500 text-sm font-medium">Gerencie os agrupamentos de alunos em: <strong className="text-gray-700">{escolaSelecionada}</strong></p>
        </div>
      </div>

      {/* FORMULÁRIO DE NOVA TURMA */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Cadastrar Nova Turma</h2>
        <form onSubmit={handleCriarTurma} className="flex gap-4 items-start">
          <div className="flex-1">
            <input
              type="text"
              required
              placeholder="Ex: Turma de Odontologia 2026, Turma 12 Mais Médicos..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
              value={nomeNovaTurma}
              onChange={(e) => setNomeNovaTurma(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
          >
            {salvando ? 'Salvando...' : <><Plus size={20} /> Criar Turma</>}
          </button>
        </form>
      </div>

      {/* LISTA DE TURMAS */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 font-medium">Buscando suas turmas...</div>
      ) : turmas.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-700">Nenhuma turma encontrada</h3>
          <p className="text-gray-500 mt-1">Você ainda não cadastrou nenhuma turma nesta instituição.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {turmas.map(turma => (
            <div key={turma.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-6 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg">
                  <BookOpen size={24} />
                </div>
                <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-1 rounded-full tracking-wider">
                  Ativa
                </span>
              </div>
              
              <h3 className="text-xl font-black text-gray-800 mb-2 leading-tight">{turma.nome}</h3>
              <p className="text-gray-400 text-xs font-medium mb-6">
                Criada em: {turma.dataCriacao ? new Date(turma.dataCriacao.toMillis()).toLocaleDateString('pt-BR') : 'Agora mesmo'}
              </p>
              
              <div className="mt-auto pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                <Link to={`/alunos`} className="bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-bold py-2.5 px-3 rounded-xl text-xs text-center transition-colors flex items-center justify-center gap-1.5 border border-gray-200">
                  <Users size={14}/> Alunos
                </Link>
                {/* O botão abaixo preparará o terreno para a Fase 3 (Tarefas) */}
                <button className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold py-2.5 px-3 rounded-xl text-xs text-center transition-colors flex items-center justify-center gap-1.5">
                  Tarefas <ArrowRight size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
