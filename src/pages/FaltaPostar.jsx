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

  // LEITURA DE CRACHÁ (Segurança Clean Code)
  const isAdmin = userProfile?.role === 'admin';
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

        // Divide o array de turmas em pedaços de no máximo 30 para o operador 'in' do Firestore
        const maxItemsPerQuery = 30;
        const turmasChunks = [];
        for (let i = 0; i < turmasIds.length; i += maxItemsPerQuery) {
          turmasChunks.push(turmasIds.slice(i, i + maxItemsPerQuery));
        }

        let pendenciasTemporarias = [];

        // 2. Busca atividades com status='aprovado' para essas turmas
        for (const chunk of turmasChunks) {
          // 🔥 CORREÇÃO: Tiramos a trava where('postado', '==', false) daqui. 
          // O Firebase ignora documentos onde o campo não existe. Vamos filtrar no JS igual ao Dashboard.
          const qPendencias = query(
            collection(db, 'atividades'),
            where('turmaId', 'in', chunk),
            where('status', '==', 'aprovado')
          );

          const snapPendencias = await getDocs(qPendencias);

          snapPendencias.docs.forEach(d => {
            const data = d.data();
            // 🔥 LÓGICA DE DEDUPLICAÇÃO DO DASHBOARD: Se NÃO foi postado (seja false ou campo inexistente), entra na lista.
            if (!data.postado && data.status !== 'lixeira') {
               pendenciasTemporarias.push({ id: d.id, ...data });
            }
          });
        }

        // 3. Ordenação decrescente pela data de aprovação (mais recentes primeiro)
        pendenciasTemporarias.sort((a, b) => {
          const timeA = a.dataAprovacao?.toMillis ? a.dataAprovacao.toMillis() : 0;
          const timeB = b.dataAprovacao?.toMillis ? b.dataAprovacao.toMillis() : 0;
          return timeB - timeA;
        });

        setListaPendencias(pendenciasTemporarias);
      } catch (error) {
        console.error("Erro ao buscar pendências Aguardando Postar:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchFaltaPostar();
  }, [currentUser, escolaSelecionada, isAdmin]);

  // Função utilitária para formatar a data na tela
  const formatarData = (timestamp) => {
    if (!timestamp) return 'Sem data';
    // Verifica se é timestamp do Firestore
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Se for o plano Intermediário (Tier 2), a Patrícia não deve ter acesso a essa tela (só o Admin avalia e posta)
  if (isTier2) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-10 shadow-sm border border-red-100">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Send size={32} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">Acesso Restrito</h2>
          <p className="text-gray-500 font-medium mb-8">O lançamento oficial no sistema da faculdade é realizado exclusivamente pela gestão do programa.</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-all">
            <ArrowLeft size={18}/> Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      
      {/* CABEÇALHO */}
      <div className="flex items-center gap-4 mb-8 border-b border-gray-200 pb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-800 flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><Send size={24}/></div>
            Aguardando Postar
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Feedbacks aprovados que precisam ser copiados para o sistema da instituição.</p>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center gap-3 animate-pulse">
          <Send className="text-blue-200" size={48}/>
          <p className="text-blue-500 font-bold">Localizando pendências...</p>
        </div>
      ) : listaPendencias.length === 0 ? (
        <div className="bg-blue-50 border-2 border-dashed border-blue-200 rounded-3xl p-12 text-center">
          <CheckCircle2 size={48} className="text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-blue-800 mb-2">Tudo em dia!</h3>
          <p className="text-blue-600 font-medium">Nenhum feedback aguardando para ser postado no sistema.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 text-blue-800 text-sm font-bold p-4 rounded-xl border border-blue-100 mb-6">
            Você tem {listaPendencias.length} {listaPendencias.length === 1 ? 'atividade pronta' : 'atividades prontas'} para colar no sistema oficial.
          </div>

          <div className="grid grid-cols-1 gap-4">
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
        </div>
      )}
    </div>
  );
}
