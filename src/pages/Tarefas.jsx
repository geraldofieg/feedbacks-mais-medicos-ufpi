import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, AlertCircle, BookOpen, Calendar, ChevronRight } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para nova tarefa
  const [novaTarefa, setNovaTarefa] = useState({
    titulo: '',
    turmaId: location.state?.turmaIdSelecionada || '',
    tipo: 'Prática'
  });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        // Busca Turmas da Instituição pelo ID
        const qT = query(collection(db, 'turmas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);

        // Busca Tarefas da Instituição pelo ID
        const qA = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapA = await getDocs(qA);
        const tarefasData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTarefas(tarefasData);
      } catch (error) {
        console.error("Erro ao buscar tarefas:", error);
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
        ...novaTarefa,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'tarefas'), tarefaData);
      setTarefas([{ id: docRef.id, ...tarefaData }, ...tarefas]);
      setNovaTarefa({ ...novaTarefa, titulo: '' });
      alert("Tarefa criada com sucesso!");
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
    } finally {
      setSalvando(false);
    }
  }

  if (loading) return <div className="p-10 text-center animate-pulse font-bold text-gray-400">Carregando tarefas...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Tarefas' }]} />

      <div className="flex items-center gap-3 mb-8">
        <div className="bg-orange-100 text-orange-600 p-3 rounded-xl shadow-sm">
          <FileText size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800">Tarefas e Avaliações</h1>
          <p className="text-gray-500 text-sm font-medium">{escolaSelecionada?.nome}</p>
        </div>
      </div>

      {turmas.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
          <AlertCircle className="mx-auto text-amber-500 mb-4" size={48} />
          <h2 className="text-lg font-black text-amber-800 mb-2">Atenção: Nenhuma Turma Encontrada</h2>
          <p className="text-amber-700 mb-6">Você precisa cadastrar pelo menos uma turma antes de criar tarefas.</p>
          <button onClick={() => window.location.href='/turmas'} className="bg-amber-600 text-white font-bold py-2 px-6 rounded-lg">Ir para Turmas</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-4">Criar Nova Tarefa</h2>
              <form onSubmit={handleCriar} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 ml-1">TÍTULO DA ATIVIDADE</label>
                  <input
                    type="text" required placeholder="Ex: Prova Mensal, Relatório..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium"
                    value={novaTarefa.titulo} onChange={e => setNovaTarefa({...novaTarefa, titulo: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 ml-1">TURMA DESTINADA</label>
                  <select 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-orange-500 outline-none font-medium"
                    value={novaTarefa.turmaId} onChange={e => setNovaTarefa({...novaTarefa, turmaId: e.target.value})}
                  >
                    <option value="">Selecionar Turma</option>
                    {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <button disabled={salvando} className="w-full bg-orange-500 text-white font-black py-4 rounded-xl hover:bg-orange-600 transition-all shadow-md flex items-center justify-center gap-2">
                  <Plus size={20}/> {salvando ? 'Salvando...' : 'Criar Tarefa'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase px-2">Lista de Atividades</h2>
            {tarefas.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-gray-400 font-medium">Nenhuma tarefa cadastrada nesta instituição.</p>
              </div>
            ) : (
              tarefas.map(tarefa => (
                <div key={tarefa.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="bg-orange-50 text-orange-500 p-3 rounded-xl group-hover:scale-110 transition-transform">
                      <FileText size={24}/>
                    </div>
                    <div>
                      <h3 className="font-black text-gray-800 text-lg">{tarefa.titulo}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          <BookOpen size={12}/> {turmas.find(t => t.id === tarefa.turmaId)?.nome}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                          <Calendar size={12}/> {tarefa.tipo}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-orange-500 transition-colors" size={24}/>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
