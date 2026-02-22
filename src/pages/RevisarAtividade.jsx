import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [atividade, setAtividade] = useState(null);
  const [feedbackFinal, setFeedbackFinal] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregarAtividade() {
      const docRef = doc(db, 'atividades', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setAtividade(docSnap.data());
        setFeedbackFinal(docSnap.data().feedbackSugerido || '');
      }
      setLoading(false);
    }
    carregarAtividade();
  }, [id]);

  async function handleAprovar() {
    setSalvando(true);
    try {
      const docRef = doc(db, 'atividades', id);
      await updateDoc(docRef, {
        feedbackFinal: feedbackFinal,
        status: 'aprovado'
      });
      navigate('/'); 
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      setSalvando(false);
    }
  }

  if (loading) return <div className="p-8 text-center mt-10">Buscando atividade...</div>;
  if (!atividade) return <div className="p-8 text-center text-red-500 mt-10">Atividade não encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Revisão de Feedback</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-1">Dados do Aluno</h3>
              <p className="font-medium text-gray-900 text-lg">{atividade.aluno}</p>
              {/* Mostrando o Módulo e a Tarefa juntos */}
              <p className="text-sm text-gray-600">
                {atividade.modulo} {atividade.tarefa ? `- ${atividade.tarefa}` : ''}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Enunciado</h3>
              <p className="text-gray-700 whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">{atividade.enunciado}</p>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-2">Resposta do Aluno</h3>
              <p className="text-gray-700 whitespace-pre-wrap text-sm bg-blue-50 p-3 rounded border border-blue-100">{atividade.resposta}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h3 className="text-sm font-bold text-blue-600 uppercase mb-1">Feedback Final</h3>
            <p className="text-xs text-gray-500 mb-4">Revise, edite se necessário e aprove.</p>
            
            <textarea 
              className="w-full flex-grow p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 whitespace-pre-wrap min-h-[300px]"
              value={feedbackFinal}
              onChange={(e) => setFeedbackFinal(e.target.value)}
            ></textarea>

            <div className="pt-4 mt-4 border-t border-gray-100">
              <button 
                onClick={handleAprovar}
                disabled={salvando}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle size={24} />
                {salvando ? 'Aprovando...' : 'Aprovar e Finalizar'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
