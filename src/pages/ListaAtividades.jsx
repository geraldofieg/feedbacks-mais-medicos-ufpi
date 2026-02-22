import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Clock, CheckCircle, ChevronRight } from 'lucide-react';

export default function ListaAtividades() {
  const { status } = useParams();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca as atividades filtradas pelo status (pendente ou aprovado)
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
            {status === 'pendente' ? 'Aguardando Revisão' : 'Histórico de Aprovados'}
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500 font-medium">Buscando informações...</div>
        ) : atividades.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl text-center border-2 border-dashed border-gray-200 text-gray-500">
            Nenhuma atividade {status === 'pendente' ? 'pendente' : 'aprovada'} encontrada.
          </div>
        ) : (
          <div className="grid gap-4">
            {atividades.map((atv) => (
              <Link 
                key={atv.id} 
                to={status === 'pendente' ? `/revisar/${atv.id}` : '#'} 
                className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center active:scale-95 transition-all ${status === 'aprovado' ? 'cursor-default' : 'hover:border-blue-300'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${status === 'pendente' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>
                    {status === 'pendente' ? <Clock size={24} /> : <CheckCircle size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{atv.aluno}</h3>
                    <p className="text-sm text-gray-500 font-medium">{atv.modulo}
                      
