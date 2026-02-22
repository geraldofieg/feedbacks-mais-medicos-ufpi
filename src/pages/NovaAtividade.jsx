import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Save } from 'lucide-react';

export default function NovaAtividade() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  const [alunosList, setAlunosList] = useState([]);

  // Novos campos separados!
  const [modulo, setModulo] = useState('');
  const [tarefa, setTarefa] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState('');
  const [enunciado, setEnunciado] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');

  // Busca a lista de alunos
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
    
    // Trava de segurança para garantir que tudo foi selecionado
    if (!alunoSelecionado || !modulo || !tarefa) {
      setMensagem('Por favor, selecione o aluno, o módulo e a tarefa.');
      return;
    }

    setLoading(true);
    setMensagem('');

    try {
      await addDoc(collection(db, 'atividades'), {
        modulo,
        tarefa, // <-- Agora a tarefa tem sua própria gaveta no banco de dados!
        aluno: alunoSelecionado,
        enunciado,
        resposta,
        feedbackSugerido: feedback,
        status: 'pendente',
        dataCriacao: serverTimestamp()
      });

      setMensagem('Atividade cadastrada com sucesso!');
      
      // Limpa os campos para o próximo cadastro
      setModulo(''); setTarefa(''); setAlunoSelecionado(''); setEnunciado(''); setResposta(''); setFeedback('');
      
      setTimeout(() => navigate('/'), 2000);
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setMensagem('Erro ao salvar atividade. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Nova Atividade</h2>
        </div>

        {mensagem && (
          <div className={`p-4 rounded-lg mb-6 text-center font-bold ${mensagem.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {mensagem}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
          
          {/* O segredo do Mapa de Entregas: 3 menus de seleção padronizados! */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Módulo</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={modulo} onChange={e => setModulo(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Módulo 1">Módulo 1</option>
                <option value="Módulo 2">Módulo 2</option>
                <option value="Módulo 3">Módulo 3</option>
                <option value="Módulo 4">Módulo 4</option>
                <option value="Módulo 5">Módulo 5</option>
                <option value="Módulo 6">Módulo 6</option>
                <option value="Módulo 7">Módulo 7</option>
                <option value="Módulo 8">Módulo 8</option>
                <option value="Módulo 9">Módulo 9</option>
                <option value="Módulo 10">Módulo 10</option>
                <option value="Módulo 11">Módulo 11</option>
                <option value="Módulo 12">Módulo 12</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Tarefa</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={tarefa} onChange={e => setTarefa(e.target.value)}>
                <option value="">Selecione...</option>
                <option value="Fórum">Fórum</option>
                <option value="Atividade Avaliativa">Atividade Avaliativa</option>
                <option value="Caso Clínico">Caso Clínico</option>
                <option value="Portfólio">Portfólio</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Aluno</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={alunoSelecionado} onChange={e => setAlunoSelecionado(e.target.value)}>
                <option value="">Selecione...</option>
                {alunosList.map(a => (
                  <option key={a.id} value={a.nome}>{a.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Enunciado da Atividade</label>
            <textarea required rows="3" placeholder="Cole aqui a pergunta ou caso clínico..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={enunciado} onChange={e => setEnunciado(e.target.value)}></textarea>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Resposta do Aluno</label>
            <textarea required rows="4" placeholder="Cole aqui o que o aluno respondeu..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={resposta} onChange={e => setResposta(e.target.value)}></textarea>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Feedback Sugerido (Rascunho)</label>
            <textarea required rows="4" placeholder="Cole aqui a sugestão inicial de feedback..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={feedback} onChange={e => setFeedback(e.target.value)}></textarea>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg">
              <Save size={24} />
              {loading ? 'Salvando...' : 'Salvar Atividade'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
