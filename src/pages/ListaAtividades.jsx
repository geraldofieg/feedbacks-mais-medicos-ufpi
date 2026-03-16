import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Clock, CheckCircle, ChevronRight, CheckCheck, Send, CalendarDays } from 'lucide-react';

export default function ListaAtividades() {
  const { status } = useParams();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Padronizado para bater com o Dashboard
  const titulos = {
    'pendente': 'Aguardando Revisão',
    'aprovado': 'Falta Postar no Site',
    'finalizado': 'Histórico Finalizado'
  };

  useEffect(() => {
    const fetchAtividades = async () => {
      setLoading(true);

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);

      const q = query(
        collection(db, 'atividades'),
        where('dataCriacao', '>=', dataLimite)
      );

      try {
        const snap = await getDocs(q);
        let lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // LÓGICA DE FUNIL BLINDADO COM INTELIGÊNCIA V3
        lista = lista.filter(atv => {
          const isFinalizado = !!atv.dataPostagem || atv.postado === true || atv.status === 'postado';
          const isAprovado = !!atv.dataAprovacao || atv.status === 'aprovado';
          
          // 🔥 CIRURGIA V1: Verifica se tem texto na resposta OU se tem um arquivo anexado
          const temRespostaReal = (atv.resposta && String(atv.resposta).trim() !== '') || !!atv.arquivoUrl;

          if (status === 'finalizado' || status === 'finalizados') {
            return isFinalizado;
          } else if (status === 'aprovado' || status === 'falta-postar') {
            return !isFinalizado && isAprovado;
          } else if (status === 'pendente') {
            // SÓ MOSTRA NA LISTA SE TIVER RESPOSTA (Elimina os fantasmas com "ponto")
            return !isFinalizado && !isAprovado && temRespostaReal;
          }
          return false;
        });

        lista.sort((a, b) => {
          const tempoA = a.dataPostagem?.seconds || a.dataAprovacao?.seconds || a.dataCriacao?.seconds || 0;
          const tempoB = b.dataPostagem?.seconds || b.dataAprovacao?.seconds || b.dataCriacao?.seconds || 0;
          return tempoB - tempoA;
        });

        setAtividades(lista);
      } catch (error) {
        console.error("Erro ao buscar lista:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAtividades();
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">
            {titulos[status] || 'Lista de Atividades'}
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-blue-600 font-black animate-pulse">
            Sincronizando registros...
          </div>
        ) : atividades.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-gray-200 text-gray-500 font-bold">
            Nenhuma atividade nesta etapa do funil.
          </div>
        ) : (
          <div className="grid gap-4">
            {atividades.map((atv) => {
              const isFinal = !!atv.dataPostagem || atv.postado === true || atv.status === 'postado';
              const isAprov = !!atv.dataAprovacao || atv.status === 'aprovado';

              let corBorda = isFinal ? 'border-gray-200 opacity-80' : isAprov ? 'border-blue-300 shadow-md' : 'border-yellow-200';
              let corIcone = isFinal ? 'bg-green-50 text-green-600' : isAprov ? 'bg-blue-50 text-blue-600' : 'bg-yellow-50 text-yellow-600';
              let icone = isFinal ? <CheckCheck size={24} /> : isAprov ? <Send size={24} /> : <Clock size={24} />;

              const formatarData = (firebaseData) => {
                if (!firebaseData) return null;
                const d = firebaseData.toDate ? firebaseData.toDate() : new Date(firebaseData.seconds * 1000);
                return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
              };

              const dataFmt = isFinal ? formatarData(atv.dataPostagem) : formatarData(atv.dataAprovacao);

              return (
                <Link key={atv.id} to={`/revisar/${atv.id}`} className={`bg-white p-5 rounded-2xl border flex justify-between items-center active:scale-95 transition-all group ${corBorda}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${corIcone}`}>{icone}</div>
                    <div>
                      {/* AJUSTE DE OURO: Tenta ler 'aluno' (V1) ou 'nomeAluno' (V3) para matar o bug do ponto */}
                      <h3 className={`font-bold ${isFinal ? 'text-gray-500' : 'text-gray-900'}`}>
                        {atv.aluno || atv.nomeAluno || 'Aluno Identificado'}
                      </h3>
                      <p className="text-sm text-gray-500 font-medium mb-2">{atv.modulo} • {atv.tarefa || atv.nomeTarefa}</p>
                      
                      {dataFmt && (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${isFinal ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                          <CalendarDays size={12} /> {isFinal ? 'Postado em:' : 'Aprovado em:'} {dataFmt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500">
                    <ChevronRight size={20} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
