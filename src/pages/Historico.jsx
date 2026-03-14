import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCheck, ChevronRight, CalendarDays, ArchiveRestore } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Historico() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [listaHistorico, setListaHistorico] = useState([]);

  // Identifica o perfil para aplicar a regra de acesso às turmas
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    async function fetchHistorico() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoading(true);
      try {
        // 1. Busca as turmas permitidas
        const turmasRef = collection(db, 'turmas');
        const qTurmas = isAdmin
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
          
        const snapTurmas = await getDocs(qTurmas);
        const turmasIds = snapTurmas.docs.map(t => t.id);

        if (turmasIds.length === 0) {
          setListaHistorico([]);
          setLoading(false);
          return;
        }

        // 2. Dicionários de Nomes
        const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapTarefas = await getDocs(qTarefas);
        const mapaTarefas = {};
        snapTarefas.docs.forEach(d => { mapaTarefas[d.id] = d.data().nomeTarefa || d.data().titulo; });

        const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAlunos = await getDocs(qAlunos);
        const mapaAlunos = {};
        snapAlunos.docs.forEach(d => { mapaAlunos[d.id] = d.data().nome; });

        // 3. Busca Atividades e aplica o Filtro Inteligente (Matemática do Dashboard)
        const qAtividades = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAtividades = await getDocs(qAtividades);
        
        const historico = [];
        
        snapAtividades.docs.forEach(doc => {
          const ativ = doc.data();
          
          if (turmasIds.includes(ativ.turmaId)) {
            // REGRA ESTRITA: Só entra no histórico se já foi oficialmente postado/finalizado.
            const jaPostado = ativ.postado === true || ativ.enviado === true || ativ.status === 'finalizado' || ativ.status === 'postado';

            if (jaPostado) {
              // Decide qual data usar para ordenação e exibição (Preferência para a data final)
              const dataExibicao = ativ.dataPostagem || ativ.dataAprovacao || ativ.dataCriacao;

              historico.push({
                id: doc.id,
                tarefaId: ativ.tarefaId,
                nomeAluno: mapaAlunos[ativ.alunoId] || 'Aluno Removido',
                nomeTarefa: mapaTarefas[ativ.tarefaId] || 'Tarefa Removida',
                dataConclusao: dataExibicao,
                isPostado: jaPostado
              });
            }
          }
        });

        // Ordena da mais recente para a mais antiga
        historico.sort((a, b) => {
          const tempoA = a.dataConclusao?.toMillis ? a.dataConclusao.toMillis() : 0;
          const tempoB = b.dataConclusao?.toMillis ? b.dataConclusao.toMillis() : 0;
          return tempoB - tempoA; // Ordem decrescente
        });

        setListaHistorico(historico);
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchHistorico();
  }, [currentUser, userProfile, escolaSelecionada, isAdmin]);

  const formatarData = (ts) => {
    if (!ts) return "";
    try {
      let d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-8 border-b border-gray-200 pb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-green-600 transition-colors p-2 -ml-2 bg-white rounded-xl shadow-sm border border-gray-200">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
            <ArchiveRestore className="text-green-600" /> Histórico Finalizado
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Registro permanente de todas as atividades lançadas no portal oficial.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold">A carregar o histórico...</p>
        </div>
      ) : listaHistorico.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
          <div className="bg-white text-gray-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
            <CheckCheck size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-700 mb-2">Gaveta Vazia</h2>
          <p className="text-gray-500 font-medium">Nenhuma atividade concluída registrada nesta instituição até o momento.</p>
          <Link to="/" className="inline-block mt-6 bg-white text-gray-700 font-bold px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-100 transition-all shadow-sm">
            Voltar ao Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {listaHistorico.map((item) => (
            <Link 
              key={item.id} 
              to={`/revisar/${item.tarefaId}`} 
              className="flex items-center gap-4 p-4 md:p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-green-400 transition-all group"
            >
              <div className="bg-green-50 text-green-600 p-3.5 rounded-xl group-hover:bg-green-600 group-hover:text-white transition-colors shrink-0">
                <CheckCheck size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-gray-800 text-base uppercase tracking-wide truncate group-hover:text-green-700 transition-colors">
                  {item.nomeAluno}
                </h3>
                <p className="text-sm font-bold text-gray-500 truncate mt-0.5">
                  {item.nomeTarefa}
                </p>
                
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                    <CalendarDays size={12} />
                    {formatarData(item.dataConclusao)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-100 px-2 py-1 rounded-md uppercase tracking-widest">
                    Lançado Oficialmente
                  </span>
                </div>
              </div>

              <div className="text-gray-300 group-hover:text-green-600 transition-colors shrink-0">
                <ChevronRight size={24} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
