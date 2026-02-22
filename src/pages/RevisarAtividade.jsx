import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User } from 'lucide-react';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [atividade, setAtividade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function buscarAtividade() {
      try {
        const docRef = doc(db, 'atividades', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const dados = docSnap.data();
          setAtividade({ id: docSnap.id, ...dados });
          setFeedbackEditado(dados.feedbackSugerido || '');
        } else {
          console.log("Atividade não encontrada!");
        }
      } catch (error) {
        console.error("Erro ao buscar:", error);
      } finally {
        setLoading(false);
      }
    }
    buscarAtividade();
  }, [id]);

  async function handleAprovar() {
    setSalvando(true);
    try {
      const docRef = doc(db, 'atividades', id);
      await updateDoc(docRef, {
        feedbackFinal: feedbackEditado,
        status: 'aprovado',
        dataAprovacao: new Date()
      });
      navigate('/lista/aprovado');
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      alert("Erro ao salvar a aprovação.");
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
        <p className="text-gray-600 font-bold">Carregando atividade...</p>
      </div>
    );
  }

  if (!atividade) return <div className="text-center p-10">Atividade não encontrada</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600"><ArrowLeft size={24} /></Link>
            <h2 className="text-2xl font-black text-gray-800">Revisão de Feedback</h2>
          </div>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold border border-yellow-200 uppercase">
            {atividade.status}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600"><User size={24} /></div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{atividade.aluno}</h3>
                  <p className="text-sm font-bold text-gray-500">{atividade.modulo} • {atividade.tarefa}</p>
                </div>
              </div>

              {/* Seção 1: Enunciado */}
              <div className="mt-4">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">1. Enunciado</h4>
                {atividade.enunciado && <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">{atividade.enunciado}</p>}
                
                {atividade.urlEnunciado && (
                  <a href={atividade.urlEnunciado} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-blue-100 transition-colors border border-blue-200">
                    <FileText size={20} /> Ver Arquivo do Enunciado <ExternalLink size={16} className="ml-1 opacity-50" />
                  </a>
                )}
                {!atividade.enunciado && !atividade.urlEnunciado && <p className="text-gray-400 italic text-sm">Sem enunciado.</p>}
              </div>

              {/* Seção 2: Resposta */}
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">2. Resposta do Aluno</h4>
                {atividade.resposta && <p className="text-gray-800 bg-green-50 p-4 rounded-xl text-sm border border-green-100 font-medium">{atividade.resposta}</p>}

                {atividade.urlResposta && (
                  <a href={atividade.urlResposta} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-green-100 transition-colors border border-green-200">
                    <FileText size={20} /> Ver Arquivo da Resposta <ExternalLink size={16} className="ml-1 opacity-50" />
                  </a>
                )}
                {!atividade.resposta && !atividade.urlResposta && <p className="text-gray-400 italic text-sm">Sem resposta em texto.</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-blue-600 p-6 rounded-2xl shadow-md text-white sticky top-6">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-blue-500 pb-2"><CheckCircle size={20} />3. Aprovar Feedback</h3>
              <label className="block text-sm font-bold text-blue-100 mb-2">Pode editar antes de aprovar:</label>
              <textarea rows="8" className="w-full p-4 rounded-xl text-gray-800 focus:ring-4 focus:ring-blue-400 outline-none resize-none font-medium mb-4 shadow-inner" value={feedbackEditado} onChange={(e) => setFeedbackEditado(e.target.value)}></textarea>
              <button onClick={handleAprovar} disabled={salvando} className="w-full bg-white text-blue-700 font-black text-lg py-4 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2">
                {salvando ? 'Aprovando...' : 'Aprovar e Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
