import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Clock, CheckCircle, ChevronRight, CheckCheck, Send } from 'lucide-react';

export default function ListaAtividades() {
  const { status } = useParams(); // Pode vir: 'pendente', 'falta-postar' ou 'finalizados'
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Títulos dinâmicos dependendo da página
  const titulos = {
    'pendente': 'Aguardando Revisão',
    'falta-postar': 'Falta Postar no Site',
    'finalizados': 'Histórico Finalizado'
  };

  useEffect(() => {
    // O banco só conhece dois status principais: 'pendente' e 'aprovado'
    const statusBanco = status === 'pendente' ? 'pendente' : 'aprovado';
    const q = query(collection(db, 'atividades'), where('status', '==', statusBanco));

    const unsub = onSnapshot(q, (snap) => {
      let lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filtra na memória para dividir a caixa dos Aprovados em duas telas diferentes
      if (status === 'falta-postar') {
        lista = lista.filter(atv => !atv.postado); // Mostra só o que falta o Geraldo colar
      } else if (status === 'finalizados') {
        lista = lista.filter(atv => atv.postado === true); // Mostra só o 100% pronto
      }
      
      // Ordena pelas mais recentes
      lista.sort((a, b) => (b.dataCriacao?.seconds || 0) - (a.dataCriacao?.seconds || 0));
      
      setAtividades(lista);
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });

    return () => unsub();
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 capitalize">
            {titulos[status]}
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-blue-600 font-medium">Buscando informações...</div>
        ) : atividades.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-gray-200 text-gray-500">
            Nenhuma atividade nesta etapa do funil.
          </div>
        ) : (
          <div className="grid gap-4">
            {atividades.map((atv) => {
              // Estilo das caixinhas de acordo com a etapa
              let corBorda = status === 'pendente' ? 'border-yellow-200' : status === 'falta-postar' ? 'border-blue-300 shadow-md' : 'border-gray-200 opacity-80';
              let corIcone = status === 'pendente' ? 'bg-yellow-50 text-yellow-600' : status === 'falta-postar' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600';
              let icone = status === 'pendente' ? <Clock size={24} /> : status === 'falta-postar' ? <Send size={24} /> : <CheckCheck size={24} />;

              return (
                <Link key={atv.id} to={`/revisar/${atv.id}`} className={`bg-white p-5 rounded-2xl border flex justify-between items-center active:scale-95 transition-all group ${corBorda}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${corIcone}`}>{icone}</div>
                    <div>
                      <h3 className={`font-bold ${status === 'finalizados' ? 'text-gray-500' : 'text-gray-900'}`}>{atv.aluno}</h3>
                      <p className="text-sm text-gray-500 font-medium">{atv.modulo} • {atv.tarefa}</p>
                    </div>
                  </div>
                  <div className="p-2 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500"><ChevronRight size={20} /></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
