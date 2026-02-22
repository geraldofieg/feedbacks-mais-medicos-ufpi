import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Clock, CheckCircle, ChevronRight, CheckCheck, AlertCircle } from 'lucide-react';

export default function ListaAtividades() {
  const { status } = useParams();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'atividades'), where('status', '==', status));

    const unsub = onSnapshot(q, (snap) => {
      let lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // ORDENAÇÃO INTELIGENTE:
      // Se for a tela de Aprovados, coloca os que "Faltam Postar" (postado: false) no topo.
      // E os que já foram postados vão para o final da lista.
      lista.sort((a, b) => {
        if (status === 'aprovado') {
          if (a.postado === b.postado) return (b.dataCriacao?.seconds || 0) - (a.dataCriacao?.seconds || 0);
          return a.postado ? 1 : -1; // Joga os postados (true) pro fundo
        }
        return (b.dataCriacao?.seconds || 0) - (a.dataCriacao?.seconds || 0);
      });
      
      setAtividades(lista);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsub();
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 capitalize">
            {status === 'pendente' ? 'Aguardando Revisão' : 'Histórico de Aprovados'}
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-blue-600 font-medium">Buscando informações...</div>
        ) : atividades.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-gray-200 text-gray-500">
            Nenhuma atividade {status === 'pendente' ? 'pendente' : 'aprovada'} encontrada.
          </div>
        ) : (
          <div className="grid gap-4">
            {atividades.map((atv) => {
              // Lógica de Cores da Lista
              const isPendente = status === 'pendente';
              const isPostado = atv.postado === true;

              let corBorda = isPendente ? 'border-yellow-200' : isPostado ? 'border-gray-200' : 'border-green-300 shadow-md';
              let corFundoIcone = isPendente ? 'bg-yellow-50 text-yellow-600' : isPostado ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-600';
              let icone = isPendente ? <Clock size={24} /> : isPostado ? <CheckCheck size={24} /> : <CheckCircle size={24} />;
              let opacidade = isPostado ? 'opacity-70' : 'opacity-100';

              return (
                <Link 
                  key={atv.id} 
                  to={`/revisar/${atv.id}`} 
                  className={`bg-white p-5 rounded-2xl border flex justify-between items-center active:scale-95 transition-all group ${corBorda} ${opacidade}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${corFundoIcone}`}>
                      {icone}
                    </div>
                    <div>
                      <h3 className={`font-bold ${isPostado ? 'text-gray-500' : 'text-gray-900'}`}>{atv.aluno}</h3>
                      <p className="text-sm text-gray-500 font-medium">{atv.modulo} • {atv.tarefa}</p>
                      
                      {/* Selo visual para o Geraldo saber o que falta */}
                      {!isPendente && !isPostado && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded mt-1">
                          <AlertCircle size={12} /> Falta colar no site
                        </span>
                      )}
                      {!isPendente && isPostado && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 mt-1">
                          <CheckCheck size={12} /> Finalizado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${isPendente ? 'bg-blue-50 text-blue-600' : 'text-gray-400 group-hover:bg-gray-50 group-hover:text-blue-500'}`}>
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
