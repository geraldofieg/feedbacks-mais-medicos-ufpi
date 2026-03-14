import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Send, ChevronRight, CalendarDays } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function FaltaPostar() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [listaPendencias, setListaPendencias] = useState([]);

  // LEITURA DE CRACHÁ
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const isTier2 = userProfile?.plano === 'intermediario';

  useEffect(() => {
    async function fetchFaltaPostar() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoading(true);
      try {
        // 1. Busca todas as turmas que esse usuário tem acesso na Instituição
        const turmasRef = collection(db, 'turmas');
        const qTurmas = isAdmin
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
          
        const snapTurmas = await getDocs(qTurmas);
        const turmasIds = snapTurmas.docs.map(t => t.id);

        if (turmasIds.length === 0) {
          setListaPendencias([]);
          setLoading(false);
          return;
        }

        // 2. Busca Tarefas e Alunos para cruzar os nomes (Dicionários)
        const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapTarefas = await getDocs(qTarefas);
        const mapaTarefas = {};
        snapTarefas.docs.forEach(d => { mapaTarefas[d.id] = d.data().nomeTarefa || d.data().titulo; });

        const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAlunos = await getDocs(qAlunos);
        const mapaAlunos = {};
        snapAlunos.docs.forEach(d => { mapaAlunos[d.id] = d.data().nome; });

        // 3. Busca as Atividades "Falta Postar" com a Nova Matemática (V3)
        const qAtividades = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAtividades = await getDocs(qAtividades);
        
        const pendencias = [];
        
        snapAtividades.docs.forEach(doc => {
          const ativ = doc.data();
          if (turmasIds.includes(ativ.turmaId)) {
            // LÓGICA ESPELHADA DO DASHBOARD
            const jaPostado = ativ.postado === true || ativ.enviado === true || ativ.status === 'finalizado' || ativ.status === 'postado';
            const jaAprovado = ativ.status === 'aprovado' || ativ.status === 'revisado';

            // Só entra na lista se estiver aprovado E não tiver sido postado
            if (!jaPostado && jaAprovado) {
              pendencias.push({
                id: doc.id,
                tarefaId: ativ.tarefaId,
                alunoId: ativ.alunoId, 
                // AJUSTE: Fallback triplo para garantir que o nome apareça (Fim do bug do ".")
                nomeAluno: mapaAlunos[ativ.alunoId] || ativ.nomeAluno || 'Aluno Removido',
                nomeTarefa: mapaTarefas[ativ.tarefaId] || ativ.nomeTarefa || 'Tarefa Removida',
                dataAprovacao: ativ.dataAprovacao || ativ.dataCriacao
              });
            }
          }
        });

        // AJUSTE: Ordena da mais NOVA para a mais ANTIGA (O que foi aprovado por último, aparece primeiro no topo)
        pendencias.sort((a, b) => {
          const tempoA = a.dataAprovacao?.toMillis ? a.dataAprovacao.toMillis() : 0;
          const tempoB = b.dataAprovacao?.toMillis ? b.dataAprovacao.toMillis() : 0;
          return tempoB - tempoA; 
        });

        setListaPendencias(pendencias);
      } catch (error) {
        console.error("Erro ao buscar lista:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFaltaPostar();
  }, [currentUser, userProfile, escolaSelecionada, isAdmin]);

  // BLINDAGEM DA PATRÍCIA (Tier 2)
  if (isTier2 && !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-3xl p-12 shadow-sm max-w-2xl mx-auto">
          <Send className="mx-auto text-blue-400 mb-4" size={56} />
          <h2 className="text-2xl font-black text-blue-800 mb-2">Acesso Restrito</h2>
          <p className="text-blue-600 font-medium mb-6">Como Revisor(a), você não precisa se preocupar com as postagens. O administrador do sistema cuidará do lançamento oficial por você!</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-3 px-8 rounded-xl shadow-lg hover:bg-blue-700 transition-all">
            <ArrowLeft size={18}/> Voltar ao Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const formatarData = (ts) => {
    if (!ts) return "";
    try {
      let d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ""; }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-blue-600 transition-colors p-2 -ml-2">
          <ArrowLeft size={28} />
        </button>
        <h1 className="text-2xl font-black text-gray-800 tracking-tight">Falta Postar No Site</h1>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold">Buscando pendências...</p>
        </div>
      ) : listaPendencias.length === 0 ? (
        <div className="bg-green-50 border-2 border-dashed border-green-200 rounded-3xl p-12 text-center">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Send size={40} />
          </div>
          <h2 className="text-2xl font-black text-green-800 mb-2">Tudo zerado!</h2>
          <p className="text-green-700 font-medium">Nenhum feedback aguardando lançamento no portal oficial.</p>
          <Link to="/" className="inline-block mt-6 bg-white text-green-700 font-bold px-6 py-3 rounded-xl border border-green-200 hover:bg-green-100 transition-all shadow-sm">
            Voltar ao Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listaPendencias.map((item) => (
            <Link 
              key={item.id} 
              to={`/revisar/${item.tarefaId}`} 
              state={{ alunoId: item.alunoId }}
              className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-400 transition-all group"
            >
              <div className="bg-blue-50 text-blue-600 p-4 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                <Send size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-gray-800 text-base md:text-lg uppercase tracking-wide truncate group-hover:text-blue-700 transition-colors">
                  {item.nomeAluno}
                </h3>
                <p className="text-sm font-bold text-gray-500 truncate mt-0.5">
                  {item.nomeTarefa}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-gray-400 bg-gray-50 inline-flex px-2 py-1 rounded-lg border border-gray-100">
                  <CalendarDays size={14} />
                  <span>Aprovado em: {formatarData(item.dataAprovacao)}</span>
                </div>
              </div>

              <div className="text-gray-300 group-hover:text-blue-600 transition-colors shrink-0">
                <ChevronRight size={24} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
