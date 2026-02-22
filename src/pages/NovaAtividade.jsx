import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Save } from 'lucide-react';

export default function NovaAtividade() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  // Aqui o sistema vai guardar a lista de alunos que ele puxar do banco
  const [alunosList, setAlunosList] = useState([]);

  // Campos do formulário
  const [modulo, setModulo] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState('');
  const [enunciado, setEnunciado] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');

  // Toda vez que a tela abrir, ele busca os alunos cadastrados no banco em ordem alfabética
  useEffect(() => {
    const q = query(collection(db, 'alunos'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, nome: doc.data().nome });
      });
      setAlunosList(lista);
    });
    return () => unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    
    // Pequena trava de segurança para não deixar salvar sem aluno
    if (!alunoSelecionado) {
      setMensagem('Por favor, selecione um aluno.');
      return;
    }

    setLoading(true);
    setMensagem('');

    try {
      await addDoc(collection(db, 'atividades'), {
        modulo,
        aluno: alunoSelecionado, // Agora salva o nome escolhido na lista
        enunciado,
        resposta,
        feedbackSugerido: feedback,
        status: 'pendente',
        dataCriacao: serverTimestamp()
      });

      setMensagem('Atividade cadastrada com sucesso!');
      
      // Limpa os campos para o próximo cadastro
      setModulo(''); setAlunoSelecionado(''); setEnunciado(''); setResposta(''); setFeedback('');
      
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

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Módulo / Tarefa</label>
              <input required type="text" placeholder="Ex: Módulo 6 - Fórum" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={modulo} onChange={e => setModulo(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Aluno</label>
              {/* Aqui o campo de digitar vira uma caixa de seleção com os alunos do banco */}
              <select 
                required 
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                value={alunoSelecionado} 
                onChange={e => setAlunoSelecionado(e.target.value)}
              >
                <option value="">-- Escolha um aluno --</option>
                {alunosList.map(a => (
                  <option key={a.id} value={a.nome}>{a.nome}</option>
                ))}
              </select>
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
