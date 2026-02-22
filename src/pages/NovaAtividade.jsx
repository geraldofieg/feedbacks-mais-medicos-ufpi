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
  const [modulosList, setModulosList] = useState([]);
  const [tarefasList, setTarefasList] = useState([]);

  const [modulo, setModulo] = useState('');
  const [tarefa, setTarefa] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState('');
  const [enunciado, setEnunciado] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const unsubAlunos = onSnapshot(query(collection(db, 'alunos'), orderBy('nome', 'asc')), (snap) => setAlunosList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    const unsubModulos = onSnapshot(query(collection(db, 'modulos'), orderBy('nome', 'asc')), (snap) => setModulosList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    const unsubTarefas = onSnapshot(query(collection(db, 'tarefas'), orderBy('nome', 'asc')), (snap) => setTarefasList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    return () => { unsubAlunos(); unsubModulos(); unsubTarefas(); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!alunoSelecionado || !modulo || !tarefa) { setMensagem('Preencha o módulo, a tarefa e o aluno.'); return; }
    
    setLoading(true); setMensagem('');
    try {
      await addDoc(collection(db, 'atividades'), { modulo, tarefa, aluno: alunoSelecionado, enunciado, resposta, feedbackSugerido: feedback, status: 'pendente', dataCriacao: serverTimestamp() });
      setMensagem('Atividade cadastrada com sucesso!');
      setModulo(''); setTarefa(''); setAlunoSelecionado(''); setEnunciado(''); setResposta(''); setFeedback('');
      setTimeout(() => navigate('/'), 2000);
    } catch (error) { setMensagem('Erro ao salvar atividade.'); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Nova Atividade</h2>
        </div>
        
        {mensagem && <div className={`p-4 rounded-lg mb-6 text-center font-bold ${mensagem.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{mensagem}</div>}

        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Módulo</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={modulo} onChange={e => setModulo(e.target.value)}>
                <option value="">Selecione...</option>
                {modulosList.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Tarefa</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={tarefa} onChange={e => setTarefa(e.target.value)}>
                <option value="">Selecione...</option>
                {tarefasList.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Aluno</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={alunoSelecionado} onChange={e => setAlunoSelecionado(e.target.value)}>
                <option value="">Selecione...</option>
                {alunosList.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Enunciado da Atividade</label><textarea required rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={enunciado} onChange={e => setEnunciado(e.target.value)}></textarea></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Resposta do Aluno</label><textarea required rows="4" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={resposta} onChange={e => setResposta(e.target.value)}></textarea></div>
          <div><label className="block text-sm font-bold text-gray-700 mb-2">Feedback Sugerido</label><textarea required rows="4" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" value={feedback} onChange={e => setFeedback(e.target.value)}></textarea></div>
          <div className="pt-6 border-t border-gray-100 flex justify-end"><button type="submit" disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg"><Save size={24} /> {loading ? 'Salvando...' : 'Salvar Atividade'}</button></div>
        </form>
      </div>
    </div>
  );
}
