import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, RefreshCw, Users, GraduationCap, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { Link } from 'react-router-dom';

export default function Lixeira() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  
  const [lixeira, setLixeira] = useState({ turmas: [], alunos: [], tarefas: [] });
  const [abaAtiva, setAbaAtiva] = useState('tarefas'); // 'tarefas', 'alunos', 'turmas'
  const [loading, setLoading] = useState(true);
  const [restaurandoId, setRestaurandoId] = useState(null);
  const [sucessoMsg, setSucessoMsg] = useState('');

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    async function fetchLixeira() {
      if (!currentUser || !escolaSelecionada?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Consultas baseadas no nível de acesso
        const baseQueryTurmas = isAdmin 
          ? [where('instituicaoId', '==', escolaSelecionada.id), where('status', '==', 'lixeira')]
          : [where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid), where('status', '==', 'lixeira')];
          
        const baseQueryAlunos = isAdmin 
          ? [where('instituicaoId', '==', escolaSelecionada.id), where('status', '==', 'lixeira')]
          : [where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid), where('status', '==', 'lixeira')];

        const baseQueryTarefas = isAdmin 
          ? [where('instituicaoId', '==', escolaSelecionada.id), where('status', '==', 'lixeira')]
          : [where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid), where('status', '==', 'lixeira')];

        const [snapTurmas, snapAlunos, snapTarefas] = await Promise.all([
          getDocs(query(collection(db, 'turmas'), ...baseQueryTurmas)),
          getDocs(query(collection(db, 'alunos'), ...baseQueryAlunos)),
          getDocs(query(collection(db, 'tarefas'), ...baseQueryTarefas))
        ]);

        setLixeira({
          turmas: snapTurmas.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'turma' })),
          alunos: snapAlunos.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'aluno' })),
          tarefas: snapTarefas.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'tarefa' }))
        });

      } catch (error) {
        console.error("Erro ao buscar lixeira:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLixeira();
  }, [currentUser, escolaSelecionada, isAdmin]);

  const handleRestaurar = async (id, colecao, nomeItem) => {
    setRestaurandoId(id);
    try {
      // O status de alunos e turmas é 'ativo', de tarefas é 'ativa' (mantendo a consistência do seu banco)
      const novoStatus = colecao === 'tarefas' ? 'ativa' : 'ativo';
      await updateDoc(doc(db, colecao, id), { status: novoStatus });
      
      // Remove da lista local da lixeira
      setLixeira(prev => ({
        ...prev,
        [colecao]: prev[colecao].filter(item => item.id !== id)
      }));

      setSucessoMsg(`"${nomeItem}" restaurado com sucesso!`);
      setTimeout(() => setSucessoMsg(''), 3000);
    } catch (error) {
      console.error("Erro ao restaurar:", error);
      alert("Houve um erro ao restaurar o item.");
    } finally {
      setRestaurandoId(null);
    }
  };

  if (!escolaSelecionada?.id) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Lixeira de Recuperação' }]} />
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-12 rounded-3xl text-center max-w-2xl mx-auto mt-10 shadow-sm">
          <Trash2 className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Instituição não selecionada</h2>
          <p className="text-blue-600 mb-8 font-medium text-lg">Para acessar a lixeira, selecione a sua instituição de trabalho.</p>
          <Link to="/" className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-black py-4 px-10 rounded-xl hover:bg-blue-700 transition-all shadow-lg">Ir para o Centro de Comando</Link>
        </div>
      </div>
    );
  }

  const itensAtuais = lixeira[abaAtiva] || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      <Breadcrumb items={[{ label: `Lixeira (${escolaSelecionada.nome})` }]} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-8">
        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3 tracking-tight">
          <div className="bg-gray-200 text-gray-600 p-2.5 rounded-xl shadow-sm"><Trash2 size={26} /></div>
          Lixeira de Recuperação
        </h1>
      </div>

      {/* MENSAGEM DE SUCESSO FLUTUANTE */}
      {sucessoMsg && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-300 shadow-sm">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="text-sm font-bold">{sucessoMsg}</span>
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex overflow-x-auto bg-gray-100 p-1.5 rounded-2xl mb-6 shadow-inner hide-scrollbar">
        <button 
          onClick={() => setAbaAtiva('tarefas')} 
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-black transition-all ${abaAtiva === 'tarefas' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText size={18} /> Tarefas <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md text-[10px] ml-1">{lixeira.tarefas.length}</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('alunos')} 
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-black transition-all ${abaAtiva === 'alunos' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Users size={18} /> Alunos <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md text-[10px] ml-1">{lixeira.alunos.length}</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('turmas')} 
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-black transition-all ${abaAtiva === 'turmas' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <GraduationCap size={18} /> Turmas <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md text-[10px] ml-1">{lixeira.turmas.length}</span>
        </button>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      {loading ? (
        <div className="p-20 text-center animate-pulse flex flex-col items-center gap-3">
          <RefreshCw className="text-gray-300 animate-spin" size={40} />
          <p className="font-bold text-gray-400">Vasculhando a lixeira...</p>
        </div>
      ) : itensAtuais.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
          <div className="bg-green-50 text-green-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h3 className="text-2xl font-black text-gray-800 mb-2">Tudo limpo por aqui!</h3>
          <p className="text-gray-500 font-medium text-lg">Não há nenhum item excluído nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-orange-500 bg-orange-50 p-3 rounded-xl border border-orange-100 mb-4">
            <AlertCircle size={16} className="shrink-0"/>
            Restaurar um item fará com que ele volte a aparecer nos painéis e relatórios originais.
          </div>

          {itensAtuais.map(item => (
            <div key={item.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 transition-colors group">
              <div className="flex items-start gap-4">
                <div className="bg-gray-100 text-gray-500 p-3 rounded-xl shrink-0 mt-0.5">
                  {abaAtiva === 'tarefas' && <FileText size={24}/>}
                  {abaAtiva === 'alunos' && <Users size={24}/>}
                  {abaAtiva === 'turmas' && <GraduationCap size={24}/>}
                </div>
                <div>
                  <h3 className="font-black text-gray-800 text-lg leading-tight mb-1">
                    {item.nomeTarefa || item.titulo || item.nome}
                  </h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    ID do Registro: {item.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => handleRestaurar(item.id, abaAtiva, item.nomeTarefa || item.titulo || item.nome)}
                disabled={restaurandoId === item.id}
                className="shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-3 px-6 rounded-xl transition-all border border-blue-200 hover:border-blue-600 disabled:opacity-50"
              >
                <RefreshCw size={18} className={restaurandoId === item.id ? "animate-spin" : ""} />
                {restaurandoId === item.id ? 'Restaurando...' : 'Restaurar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
