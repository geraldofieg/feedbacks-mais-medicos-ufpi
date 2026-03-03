-import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where, getDocs, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { ArrowLeft, Save, UploadCloud, CheckCircle } from 'lucide-react';

export default function NovaAtividade() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  
  const [alunosList, setAlunosList] = useState([]);
  const [modulosList, setModulosList] = useState([]);
  const [tarefasList, setTarefasList] = useState([]); // Mantido para o Dicionário de Enunciados

  const [modulo, setModulo] = useState('');
  const [tarefa, setTarefa] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState('');
  
  const [enunciado, setEnunciado] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');

  const [arquivoEnunciado, setArquivoEnunciado] = useState(null);
  const [arquivoResposta, setArquivoResposta] = useState(null);
  
  const [urlEnunciadoExistente, setUrlEnunciadoExistente] = useState(null);
  const [autofillAviso, setAutofillAviso] = useState(false);

  useEffect(() => {
    const unsubAlunos = onSnapshot(query(collection(db, 'alunos'), orderBy('nome', 'asc')), (snap) => setAlunosList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    const unsubModulos = onSnapshot(query(collection(db, 'modulos'), orderBy('nome', 'asc')), (snap) => setModulosList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); // Ajustado para pegar o array tarefas
    const unsubTarefas = onSnapshot(query(collection(db, 'tarefas'), orderBy('nome', 'asc')), (snap) => setTarefasList(snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }))));
    return () => { unsubAlunos(); unsubModulos(); unsubTarefas(); };
  }, []);

  useEffect(() => {
    async function buscarEnunciadoAnterior() {
      if (modulo && tarefa) {
        // Primeiro, tentar buscar o enunciado padrão salvo no Dicionário de Tarefas
        const tarefaObj = tarefasList.find(t => t.nome === tarefa);

        if (tarefaObj) {
          const tarefaRef = doc(db, 'tarefas', tarefaObj.id);
          const tarefaSnap = await getDoc(tarefaRef);

          if (tarefaSnap.exists()) {
            const dadosTarefa = tarefaSnap.data();
            if (dadosTarefa.enunciadoPadrao || dadosTarefa.urlEnunciadoPadrao) {
              if (dadosTarefa.enunciadoPadrao) setEnunciado(dadosTarefa.enunciadoPadrao);
              if (dadosTarefa.urlEnunciadoPadrao) setUrlEnunciadoExistente(dadosTarefa.urlEnunciadoPadrao);

              setAutofillAviso(true);
              setTimeout(() => setAutofillAviso(false), 5000);
              return; // Achou na tarefa, não precisa buscar nas atividades
            }
          }
        }

        // Fallback: se não achar na tarefa, busca da última atividade
        const q = query(collection(db, 'atividades'), where('modulo', '==', modulo), where('tarefa', '==', tarefa), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const dadosAnteriores = snap.docs[0].data();
          if (dadosAnteriores.enunciado) setEnunciado(dadosAnteriores.enunciado);
          if (dadosAnteriores.urlEnunciado) setUrlEnunciadoExistente(dadosAnteriores.urlEnunciado);
          
          if (dadosAnteriores.enunciado || dadosAnteriores.urlEnunciado) {
            setAutofillAviso(true);
            setTimeout(() => setAutofillAviso(false), 5000);
          }
        } else {
          setEnunciado('');
          setUrlEnunciadoExistente(null);
        }
      }
    }
    buscarEnunciadoAnterior();
  }, [modulo, tarefa, tarefasList]);

  const uploadArquivo = async (arquivo, pasta) => {
    if (!arquivo) return null;
    const arquivoRef = ref(storage, `${pasta}/${Date.now()}_${arquivo.name}`);
    await uploadBytes(arquivoRef, arquivo);
    const url = await getDownloadURL(arquivoRef);
    return url;
  };

  async function handleSalvarEnunciado() {
    if (loading) return;
    if (!modulo || !tarefa) {
      setMensagem('Preencha o módulo e a tarefa para salvar o enunciado.');
      return;
    }

    setLoading(true);
    setMensagem('Salvando enunciado na tarefa...');

    try {
      let urlEnunciadoFinal = urlEnunciadoExistente;
      if (arquivoEnunciado && arquivoEnunciado.length > 0) {
        urlEnunciadoFinal = await uploadArquivo(arquivoEnunciado[0], 'enunciados');
      }

      // CIRURGIA DE PROTEÇÃO: Se a tarefa não existir no Dicionário antigo, ele cria na hora!
      const tarefaObj = tarefasList.find(t => t.nome === tarefa);
      
      if (!tarefaObj) {
        await addDoc(collection(db, 'tarefas'), {
          nome: tarefa,
          enunciadoPadrao: enunciado || '',
          urlEnunciadoPadrao: urlEnunciadoFinal || null
        });
      } else {
        const tarefaRef = doc(db, 'tarefas', tarefaObj.id);
        await updateDoc(tarefaRef, {
          enunciadoPadrao: enunciado || '',
          urlEnunciadoPadrao: urlEnunciadoFinal || null
        });
      }

      setMensagem('Enunciado salvo na tarefa com sucesso!');
      setTimeout(() => setMensagem(''), 3000);
    } catch (error) {
      console.error(error);
      setMensagem('Erro ao salvar enunciado.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return; 
    if (!alunoSelecionado || !modulo || !tarefa) { setMensagem('Preencha o módulo, a tarefa e o aluno.'); return; }
    
    setLoading(true); 
    setMensagem('Salvando atividade...');
    
    try {
      let urlEnunciadoFinal = urlEnunciadoExistente;
      if (arquivoEnunciado) {
        urlEnunciadoFinal = await uploadArquivo(arquivoEnunciado, 'enunciados');
      }

      const urlResposta = await uploadArquivo(arquivoResposta, 'respostas');

      await addDoc(collection(db, 'atividades'), { 
        modulo, 
        tarefa, 
        aluno: alunoSelecionado, 
        enunciado: enunciado || '', 
        urlEnunciado: urlEnunciadoFinal || null, 
        resposta: resposta || '', 
        urlResposta: urlResposta || null,  
        feedbackSugerido: feedback, 
        status: 'pendente', 
        dataCriacao: serverTimestamp() 
      });

      setMensagem('Atividade cadastrada com sucesso!');
      setTimeout(() => navigate('/'), 2000);
    } catch (error) { 
      console.error(error);
      setMensagem('Erro ao salvar atividade.'); 
    } finally {
      setLoading(false); 
    }
  }

  // --- LÓGICA DA CASCATA INTELIGENTE ---
  const moduloSelecionadoObj = modulosList.find(m => m.nome === modulo);
  const tarefasDisponiveis = moduloSelecionadoObj ? (moduloSelecionadoObj.tarefas || []) : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800">Cadastrar Nova Atividade</h2>
        </div>
        
        {mensagem && (
          <div className={`p-4 rounded-lg mb-6 text-center font-bold ${mensagem.includes('sucesso') ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800 animate-pulse'}`}>
            {mensagem}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Módulo *</label>
              <select required className="w-full p-3 border border-gray-300 rounded-lg bg-white" value={modulo} onChange={e => {
                  setModulo(e.target.value);
                  setTarefa(''); // Reseta a tarefa se mudar de módulo
                }}>
                <option value="">Selecione...</option>
                {modulosList.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tarefa *</label>
              <select required disabled={!modulo} className="w-full p-3 border border-gray-300 rounded-lg bg-white disabled:opacity-50 disabled:bg-gray-100" value={tarefa} onChange={e => setTarefa(e.target.value)}>
                <option value="">{modulo ? "Selecione a tarefa..." : "Escolha o módulo primeiro"}</option>
                {tarefasDisponiveis.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
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

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-bold text-gray-800">1. Enunciado da Atividade</h3>
              {autofillAviso && (
                <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1 animate-pulse">
                  <CheckCircle size={14} /> Recuperado automaticamente!
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Texto do Enunciado</label>
              <textarea rows="6" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap" value={enunciado} onChange={e => setEnunciado(e.target.value)} placeholder="Digite o enunciado aqui..."></textarea>
            </div>

            <div className={`p-4 rounded-lg border flex flex-col sm:flex-row items-center gap-4 ${urlEnunciadoExistente && !arquivoEnunciado ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
              <UploadCloud className={urlEnunciadoExistente && !arquivoEnunciado ? 'text-green-500' : 'text-blue-500'} size={32} />
              <div className="flex-1 w-full">
                <label className={`block text-sm font-bold mb-1 ${urlEnunciadoExistente && !arquivoEnunciado ? 'text-green-900' : 'text-blue-900'}`}>
                  {urlEnunciadoExistente && !arquivoEnunciado ? '✅ Arquivo já vinculado' : 'Anexar Arquivo do Enunciado'}
                </label>
                <input type="file" accept=".pdf, image/*" onChange={e => setArquivoEnunciado(e.target.files)} className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2">2. Resposta do Aluno</h3>
            <div>
              <textarea rows="6" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap" value={resposta} onChange={e => setResposta(e.target.value)} placeholder="Cole o que o aluno escreveu..."></textarea>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-center gap-4">
              <UploadCloud className="text-gray-500" size={32} />
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-gray-700 mb-1">Anexar Arquivo do Aluno (Se houver)</label>
                <input type="file" accept=".pdf, image/*" onChange={e => setArquivoResposta(e.target.files)} className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-gray-600 file:text-white hover:file:bg-gray-700" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4">3. Feedback Base</h3>
            <textarea required rows="6" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Escreva o feedback sugerido..."></textarea>
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-4">
            <button type="button" onClick={handleSalvarEnunciado} disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors disabled:opacity-50 text-base">
              Salvar enunciado da tarefa
            </button>
            <button type="submit" disabled={loading} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 text-lg">
              <Save size={24} /> {loading ? 'Salvando...' : 'Salvar Atividade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
