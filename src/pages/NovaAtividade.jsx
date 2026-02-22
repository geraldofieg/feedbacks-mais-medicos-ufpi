import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Save } from 'lucide-react';

export default function NovaAtividade() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Campos do formulário
  const [modulo, setModulo] = useState('');
  const [aluno, setAluno] = useState('');
  const [enunciado, setEnunciado] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMensagem('');

    try {
      // Aqui é onde a mágica acontece: salvando no Firebase!
      await addDoc(collection(db, 'atividades'), {
        modulo,
        aluno,
        enunciado,
        resposta,
        feedbackSugerido: feedback,
        status: 'pendente', // Fica pendente para a Patrícia aprovar depois
        dataCriacao: serverTimestamp()
      });

      setMensagem('Atividade cadastrada com sucesso!');
      
      // Limpa o formulário para a próxima
      setModulo(''); setAluno(''); setEnunciado(''); setResposta(''); setFeedback('');
      
      // Espera 2 segundos e volta pro painel
      setTimeout(() => navigate('/'), 2000);
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setMensagem('Erro ao salvar atividade. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Cabeçalho da página */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Nova Atividade</h2>
        </div>

        {mensagem && (
          <div className={`p-4 rounded-lg mb-6 text-center font-medium ${mensagem.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {mensagem}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Módulo / Tarefa</label>
              <input required type="text" placeholder="Ex: Módulo 1 - Caso Clínico" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={modulo} onChange={e => setModulo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Aluno</label>
              <input required type="text" placeholder="Nome completo" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={aluno} onChange={e => setAluno(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enunciado da Atividade</label>
            <textarea required rows="3" placeholder="Cole aqui a pergunta ou caso clínico..." className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={enunciado} onChange={e => setEnunciado(e.target.value)}></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resposta do Aluno</label>
            <textarea required rows="4" placeholder="Cole aqui o que o aluno respondeu..." className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={resposta} onChange={e => setResposta(e.target.value)}></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Sugerido (Rascunho)</label>
            <textarea required rows="4" placeholder="Cole aqui a sugestão inicial de feedback..." className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={feedback} onChange={e => setFeedback(e.target.value)}></textarea>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button type="submit" disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 ml-auto">
              <Save size={20} />
              {loading ? 'Salvando...' : 'Salvar Atividade'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
