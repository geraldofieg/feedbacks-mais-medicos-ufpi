import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Clock, CheckCircle, ChevronRight } from 'lucide-react';

export default function ListaAtividades() {
  const { status } = useParams(); // Pega 'pendente' ou 'aprovado' da URL
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'atividades'),
      where('status', '==', status),
      orderBy('dataCriacao', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setAtividades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
            Atividades {status === 'pendente' ? 'Aguardando Revisão' : 'Aprovadas'}
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando...</div>
        ) : atividades.length === 0 ? (
          <div className="bg-white p-10 rounded-xl text-center border border-dashed border-gray-300 text-gray-500">
            Nenhuma atividade encontrada neste status.
          </div>
        ) : (
          <div className="grid gap-4">
            {atividades.map((atv) => (
              <Link 
                key={atv.id} 
                to={status === 'pendente' ? `/revisar/${atv.id}` : '#'} 
                className={`bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center hover:shadow-md transition-shadow ${status === 'aprovado' ? 'cursor-default' : ''}`}
              >
                <div className="flex items-center gap-4">
                  {status === 'pendente' ? <Clock className="text-yellow-500" /> : <CheckCircle className="text-green-500" />}
                  <div>
                    <h3 className="font-bold text-gray-800">{atv.aluno}</h3>
                    <p className="text-sm text-gray-500">{atv.modulo} • {atv.tarefa}</p>
                  </div>
                </div>
                {status === 'pendente' && (
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                    Revisar <ChevronRight size={18} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
