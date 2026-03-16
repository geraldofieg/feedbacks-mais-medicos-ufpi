import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Clock, ChevronRight, CalendarDays, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function AguardandoRevisao() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [listaPendencias, setListaPendencias] = useState([]);

  useEffect(() => {
    async function fetchAguardandoRevisao() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoading(true);
      try {
        const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
        
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

        // 1. Puxa as tarefas da V3 para checagem
        const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapTarefas = await getDocs(qTarefas);
        const tarefasPorId = {};
        const tarefasPorNomeLimpo = {}; 
        
        snapTarefas.docs.forEach(d => { 
          const data = d.data();
          tarefasPorId[d.id] = true; 
          
          const nomeOriginal = data.nomeTarefa || data.titulo || '';
          const nomeLimpo = nomeOriginal.toLowerCase().replace(/[\s-]/g, '');
          if (nomeLimpo) tarefasPorNomeLimpo[nomeLimpo] = d.id;
        });

        const qAlunos = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAlunos = await getDocs(qAlunos);
        const mapaAlunos = {};
        snapAlunos.docs.forEach(d => { mapaAlunos[d.id] = d.data().nome; });

        const qAtividades = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAtividades = await getDocs(qAtividades);
        const pendencias = [];
        
        // 🔥 O DESFRAGMENTADOR ANTICLONES (V3)
        const mapaDocsValidos = {};
        
        for (const docSnap of snapAtividades.docs) {
          const ativ = docSnap.data();
          if (!turmasIds.includes(ativ.turmaId)) continue;

          const nomeOriginalTarefa = ativ.nomeTarefa || ativ.tarefa || ativ.modulo || 'Tarefa Importada';
          const nomeLimpoAtividade = nomeOriginalTarefa.toLowerCase().replace(/[\s-]/g, '');
          
          // Chave única para caçar clones do mesmo aluno na mesma tarefa
          const chaveUnica = `${nomeLimpoAtividade}_${ativ.alunoId}`;
          
          const timeAtual = ativ.dataModificacao?.toMillis() || ativ.dataAprovacao?.toMillis() || ativ.dataCriacao?.toMillis() || 0;

          if (!mapaDocsValidos[chaveUnica] || timeAtual > mapaDocsValidos[chaveUnica].time) {
            mapaDocsValidos[chaveUnica] = { snap: docSnap, ativ: ativ, time: timeAtual, nomeLimpo: nomeLimpoAtividade, nomeOriginal: nomeOriginalTarefa };
          }
        }

        // 2. Agora processamos APENAS os sobreviventes da desfragmentação
        for (const item of Object.values(mapaDocsValidos)) {
          const ativ = item.ativ;
          const docSnap = item.snap;
          const nomeLimpoAtividade = item.nomeLimpo;
          const nomeOriginalTarefa = item.nomeOriginal;

          const jaPostado = ativ.postado === true || ativ.enviado === true || ativ.status === 'finalizado' || ativ.status === 'postado';
          const jaAprovado = ativ.status === 'aprovado' || ativ.status === 'revisado';
          
          const temResposta = (ativ.resposta && String(ativ.resposta).trim() !== '') || !!ativ.arquivoUrl;

          if (!jaPostado && !jaAprovado && temResposta) {
            let idVerdadeiro = ativ.tarefaId;
            
            // SE A TAREFA ESTÁ COM LINK QUEBRADO OU HERANÇA DA V1:
            if (!idVerdadeiro || !tarefasPorId[idVerdadeiro]) {
                if (tarefasPorNomeLimpo[nomeLimpoAtividade]) {
                    idVerdadeiro = tarefasPorNomeLimpo[nomeLimpoAtividade];
                    updateDoc(doc(db, 'atividades', docSnap.id), { tarefaId: idVerdadeiro }).catch(e => console.log('Erro silencioso DB', e));
                } else {
                    const novaTarefa = {
                        nomeTarefa: nomeOriginalTarefa,
                        titulo: nomeOriginalTarefa,
                        instituicaoId: escolaSelecionada.id,
                        turmaId: ativ.turmaId,
                        tipo: 'entrega',
                        enunciado: 'Tarefa migrada/gerada automaticamente do cronograma V1.',
                        dataCriacao: new Date() 
                    };
                    const docRef = await addDoc(collection(db, 'tarefas'), novaTarefa);
                    idVerdadeiro = docRef.id;
                    tarefasPorId[idVerdadeiro] = true;
                    tarefasPorNomeLimpo[nomeLimpoAtividade] = idVerdadeiro;
                    
                    updateDoc(doc(db, 'atividades', docSnap.id), { tarefaId: idVerdadeiro }).catch(e => console.log('Erro silencioso DB', e));
                }
            }

            pendencias.push({
              id: docSnap.id,
              tarefaId: idVerdadeiro, 
              alunoId: ativ.alunoId,
              nomeAluno: mapaAlunos[ativ.alunoId] || ativ.nomeAluno || ativ.aluno || 'Aluno Removido',
              nomeTarefa: nomeOriginalTarefa,
              dataCriacao: ativ.dataCriacao
            });
          }
        }

        pendencias.sort((a, b) => {
          const tempoA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
          const tempoB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
          return tempoB - tempoA;
        });
        
        setListaPendencias(pendencias);
      } catch (error) {
        console.error("Erro ao buscar pendências:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAguardandoRevisao();
  }, [currentUser, userProfile, escolaSelecionada]);

  const formatarData = (ts) => {
    if (!ts) return "";
    try {
      let d = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return ""; }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-yellow-600 transition-colors p-2 -ml-2">
          <ArrowLeft size={28} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Aguardando Revisão</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Trabalhos com resposta colada aguardando a sua revisão e aprovação.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold">Inspecionando banco e sincronizando tarefas...</p>
        </div>
      ) : listaPendencias.length === 0 ? (
        <div className="bg-green-50 border-2 border-dashed border-green-200 rounded-3xl p-12 text-center shadow-sm">
          <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-green-800 mb-2">Caixa Vazia!</h2>
          <p className="text-green-700 font-medium">Você não tem nenhum rascunho ou revisão pendente no momento.</p>
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
              className="flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-yellow-400 transition-all group"
            >
              <div className="bg-yellow-50 text-yellow-600 p-4 rounded-xl group-hover:bg-yellow-500 group-hover:text-white transition-colors shrink-0">
                <Clock size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-gray-800 text-base md:text-lg uppercase tracking-wide truncate group-hover:text-yellow-700 transition-colors">
                  {item.nomeAluno}
                </h3>
                <p className="text-sm font-bold text-gray-500 truncate mt-0.5">
                  {item.nomeTarefa}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-yellow-700 bg-yellow-50 inline-flex px-2 py-1 rounded-lg border border-yellow-100">
                  <CalendarDays size={14} />
                  <span>Gerado em: {formatarData(item.dataCriacao)}</span>
                </div>
              </div>

              <div className="text-gray-300 group-hover:text-yellow-500 transition-colors shrink-0">
                <ChevronRight size={24} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
