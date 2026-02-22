import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { ArrowLeft, Save, UploadCloud } from 'lucide-react';

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
  
  // Textos
  const [enunciado, setEnunciado] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');

  // Arquivos
  const [arquivoEnunciado, setArquivoEnunciado] = useState(null);
  const [arquivoResposta, setArquivoResposta] = useState(null);

  useEffect(() => {
    const unsubAlunos = onSnapshot(query(collection(db, 'alunos'), orderBy('nome', 'asc')), (snap) => setAlunosList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    const unsubModulos = onSnapshot(query(collection(db, 'modulos'), orderBy('nome', 'asc')), (snap) => setModulosList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    const unsubTarefas = onSnapshot(query(collection(db, 'tarefas'), orderBy('nome', 'asc')), (snap) => setTarefasList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    return () => { unsubAlunos(); unsubModulos(); unsubTarefas(); };
  }, []);

  // Função mágica que sobe o arquivo para o Firebase e devolve o link
  const uploadArquivo = async (arquivo, pasta) => {
    if (!arquivo) return null;
    const arquivoRef = ref(storage, `${pasta}/${Date.now()}_${arquivo.name}`);
    await uploadBytes(arquivoRef, arquivo);
    const url = await getDownloadURL(arquivoRef);
    return url;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!alunoSelecionado || !modulo || !tarefa) { 
      setMensagem('Preencha o módulo, a tarefa e o aluno.'); 
      return; 
    }
    
    setLoading(true); 
    setMensagem('Fazendo upload e salvando (isso pode levar alguns segundos)...');
    
    try {
      // 1. Sobe os arquivos (se existirem)
      const urlEnunciado = await uploadArquivo(arquivoEnunciado, 'enunciados');
      const urlResposta = await uploadArquivo(arquivoResposta, 'respostas');

      // 2. Salva tudo no banco de dados
      await addDoc(collection(db, 'atividades'), { 
        modulo, 
        tarefa, 
        aluno: alunoSelecionado, 
        enunciado: enunciado || '', // Se for só imagem, o texto pode ir vazio
        urlEnunciado, // Salva o link do PDF/Imagem do enunciado
        resposta: resposta || '', 
        urlResposta,  // Salva o link do PDF/Imagem da resposta
        feedbackSugerido: feedback, 
        status: 'pendente', 
        dataCriacao: serverTimestamp() 
      });

      setMensagem('Atividade cadastrada com sucesso!');
      setTimeout(() => navigate('/'), 2000);
    } catch (error) { 
      console.error(error);
      setMensagem('Erro ao salvar atividade. Verifique os arquivos.'); 
      setLoading(false);
    } 
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Nova Atividade</h2>
        </div>
        
        {mensagem && (
          <div className={`p-4 rounded-lg mb-6 text-center font-bold ${mensagem.includes('sucesso') ? 'bg-green-100 text-green-800' : mensagem.includes('upload') ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-red-100 text-red-800'}`}>
            {mensagem}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 space-y-8">
          
          {/* Filtros Superiores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Módulo *</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg bg-white" value={modulo} onChange={e => setModulo(e.target.value)}>
                <option value="">Selecione...</option>
                {modulosList.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tarefa *</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg bg-white" value={tarefa} onChange={e => setTarefa(e.target.value)}>
                <option value="">Selecione...</option>
                {tarefasList.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Aluno *</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg bg-white" value={alunoSelecionado} onChange={e => setAlunoSelecionado(e.target.value)}>
                <option value="">Selecione...</option>
                {alunosList.map(a => <option key={a.id} value={a.nome}>{a.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Seção do Enunciado */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">1. Enunciado da Atividade</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Texto do Enunciado (Opcional se enviar arquivo)</label>
              <textarea rows="3" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={enunciado} onChange={e => setEnunciado(e.target.value)} placeholder="Digite o enunciado aqui..."></textarea>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col sm:flex-row items-center gap-4">
              <UploadCloud className="text-blue-500" size={32} />
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-blue-900 mb-1">Anexar Arquivo (PDF ou Imagem)</label>
                <input type="file" accept=".pdf, image/*" onChange={e => setArquivoEnunciado(e.target.files[0])} className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
              </div>
            </div>
          </div>

          {/* Seção da Resposta do Aluno */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">2. Resposta do Aluno</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Texto da Resposta (Opcional se enviar arquivo)</label>
              <textarea rows="4" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Cole o que o aluno escreveu..."></textarea>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex flex-col sm:flex-row items-center gap-4">
              <UploadCloud className="text-green-500" size={32} />
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-green-900 mb-1">Anexar Arquivo do Aluno (PDF ou Imagem)</label>
                <input type="file" accept=".pdf, image/*" onChange={e => setArquivoResposta(e.target.files[0])} className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700" />
              </div>
            </div>
          </div>

          {/* Feedback Sugerido */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">3. Feedback Base</h3>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sua sugestão de feedback para aprovação *</label>
            <textarea required rows="4" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Escreva o feedback sugerido..."></textarea>
          </div>

          {/* Botão Salvar */}
          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button type="submit" disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg">
              <Save size={24} /> {loading ? 'Enviando arquivos e salvando...' : 'Salvar Atividade Completa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
