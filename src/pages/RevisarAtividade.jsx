import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, User, Copy, 
  Send, Sparkles, GraduationCap, Search, RefreshCw, CheckCheck, Eraser,
  Lock, Settings, CalendarDays, RotateCcw, Trash2, MousePointer2, Paperclip, FileUp, FileCheck
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); 
  const { currentUser, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [atividadesMap, setAtividadesMap] = useState({});
  
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState(location.state?.alunoId || '');
  
  const [novaResposta, setNovaResposta] = useState('');
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [notaAluno, setNotaAluno] = useState(''); 
  
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [arquivoUrl, setArquivoUrl] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const isPremium = userProfile?.plano === 'premium' || isAdmin;
  const isTier2 = userProfile?.plano === 'intermediario';
  const isTier1 = !isPremium && !isTier2;

  const respostaEstaVazia = novaResposta.trim().length === 0 && !arquivoUrl;

  useEffect(() => {
    if (location.state?.alunoId) {
      setAlunoSelecionadoId(location.state.alunoId);
    }
  }, [location.state?.alunoId]);

  useEffect(() => {
    async function buscarDadosDaEstacao() {
      setLoading(true);
      try {
        const snapTarefa = await getDoc(doc(db, 'tarefas', id));
        if (!snapTarefa.exists()) return navigate('/');
        setTarefa({ id: snapTarefa.id, ...snapTarefa.data() });

        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', snapTarefa.data().turmaId));
        const snapAlunos = await getDocs(qAlunos);
        const listaAlunos = snapAlunos.docs.map(d => ({ 
          id: d.id, ...d.data() 
        })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome));
        setAlunos(listaAlunos);

        const qAtividades = query(collection(db, 'atividades'), where('tarefaId', '==', id));
        const snapAtividades = await getDocs(qAtividades);
        const mapa = {};
        snapAtividades.docs.forEach(d => { mapa[d.data().alunoId] = { id: d.id, ...d.data() }; });
        setAtividadesMap(mapa);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    }
    buscarDadosDaEstacao();
  }, [id, navigate]);

  const alunoAtual = alunoSelecionadoId ? alunos.find(a => a.id === alunoSelecionadoId) : null;
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  useEffect(() => {
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
    setArquivoUrl(atividadeAtual?.arquivoUrl || '');
    setNomeArquivo(atividadeAtual?.nomeArquivo || '');
  }, [alunoSelecionadoId, atividadeAtual]);

  async function handleUploadArquivo(e) {
    const file = e.target.files[0];
    if (!file || !alunoAtual) return;
    setUploading(true);
    const storageRef = ref(storage, `atividades/${currentUser.uid}/${alunoAtual.id}_${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed', null, (error) => { console.error(error); setUploading(false); }, 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setArquivoUrl(url);
        setNomeArquivo(file.name);
        setUploading(false);
        alert("Arquivo anexado!");
      }
    );
  }

  async function handleGerarIA() {
    if (isTier1) {
      if (window.confirm("🔒 Deseja conhecer o Plano Premium para usar IA?")) navigate('/planos');
      return;
    }
    if (!userProfile?.promptPersonalizado) {
      if (window.confirm("Configure suas instruções de correção antes.")) navigate('/configuracoes');
      return;
    }
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const promptCompleto = `Aja como um preceptor médico. Estilo: ${userProfile?.promptPersonalizado}. QUESTÃO: ${tarefa?.enunciado}. RESPOSTA: "${novaResposta}". Gere um feedback pedagógico direto.`;
      const result = await model.generateContent(promptCompleto);
      setFeedbackEditado(result.response.text());
    } catch (e) { console.error(e); }
    finally { setGerandoIA(false); }
  }

  // FUNÇÃO SINCRONIZADA: Salva campos da V1 e da V3 simultaneamente
  async function handleSalvarRascunho() {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        // 1. Campos da V3
        resposta: novaResposta.trim(),
        arquivoUrl: arquivoUrl,
        nomeArquivo: nomeArquivo,
        feedbackFinal: feedbackEditado.trim(), 
        feedbackSugerido: atividadeAtual?.feedbackSugerido || (isPremium || isTier2 ? feedbackEditado.trim() : ''),
        nota: notaAluno.trim() || null, 
        status: atividadeAtual?.status === 'aprovado' ? 'aprovado' : 'pendente',
        nomeAluno: alunoAtual.nome, 
        nomeTarefa: tarefa.nomeTarefa,

        // 2. Campos da V1 (Backward Compatibility)
        aluno: alunoAtual.nome,
        tarefa: tarefa.nomeTarefa,
        modulo: tarefa.nomeTarefa,

        // 3. Inteligência de Funil: Se rascunho, dataAprovacao deve ser null para a V1
        dataAprovacao: atividadeAtual?.status === 'aprovado' ? atividadeAtual.dataAprovacao : null, 
        
        revisadoPor: userProfile?.nome || currentUser?.email || 'Professor'
      };

      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } }));
      } else {
        const novaAtiv = { alunoId: alunoAtual.id, turmaId: tarefa.turmaId, instituicaoId: tarefa.instituicaoId, tarefaId: tarefa.id, dataCriacao: serverTimestamp(), postado: false, ...payload };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      alert("Rascunho salvo com sucesso!");
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  async function handleAprovar(copiarAoAprovar = false) {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        feedbackFinal: feedbackEditado.trim(), 
        status: 'aprovado', 
        dataAprovacao: serverTimestamp(),
        // Tradução para V1
        aluno: alunoAtual.nome,
        tarefa: tarefa.nomeTarefa,
        modulo: tarefa.nomeTarefa,
        revisadoPor: userProfile?.nome || currentUser?.email || 'Professor'
      };
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } }));
      if (copiarAoAprovar) { navigator.clipboard.writeText(feedbackEditado.trim()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
      alert("Feedback Aprovado e visível na V1!");
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: serverTimestamp() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true } }));
      alert("Tarefa Finalizada!");
    } catch (error) { console.error(error); } finally { setMarcandoPostado(false); }
  }

  async function handleDevolverRevisao() {
    if (!window.confirm("Deseja devolver esta atividade para a fase de revisão?")) return;
    setSalvando(true);
    try {
        // Limpa a data de aprovação para a V1 entender que voltou para a revisão
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), { status: 'pendente', postado: false, dataAprovacao: null });
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], status: 'pendente', postado: false, dataAprovacao: null } }));
    } catch (e) { console.error(e); } finally { setSalvando(false); }
  }

  async function handleExcluirAtividade() {
    if (!window.confirm("ATENÇÃO: Você vai excluir a resposta do aluno. Continuar?")) return;
    setSalvando(true);
    try {
        await deleteDoc(doc(db, 'atividades', atividadeAtual.id));
        setAtividadesMap(prev => { const newMap = { ...prev }; delete newMap[alunoAtual.id]; return newMap; });
        setNovaResposta(''); setFeedbackEditado(''); setNotaAluno(''); setArquivoUrl('');
    } catch (e) { console.error(e); } finally { setSalvando(false); }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 self-start md:self-auto">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft size={20} /></Link>
             <div>
               <h2 className="text-lg font-black text-slate-900 truncate max-w-[250px]">{tarefa?.nomeTarefa}</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Estação de Trabalho</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-2xl w-full md:w-[450px]">
            <Search size={16} className="text-blue-500" />
            <select 
              className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer text-xs md:text-sm"
              value={alunoSelecionadoId}
              onChange={(e) => setAlunoSelecionadoId(e.target.value)}
            >
              <option value="">Buscar Aluno na Lista...</option>
              {alunos.map(a => {
                const registro = atividadesMap[a.id];
                let icone = '🔴'; 
                
                if (registro) {
                  if (registro.postado) {
                    icone = '✅';
                  } else if (registro.status === 'aprovado') {
                    icone = '🟡';
                  } else {
                    const temConteudo = (registro.resposta && registro.resposta.trim() !== '') || registro.arquivoUrl;
                    icone = temConteudo ? '🟡' : '🔴';
                  }
                }
                return <option key={a.id} value={a.id}>{icone} {a.nome}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 md:mt-10">
        {!alunoAtual ? (
          <div className="bg-white p-12 md:p-24 rounded-[48px] border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center">
             <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-xl shadow-blue-600/20 mb-4">
                  <MousePointer2 size={32} />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Primeiro Passo</h3>
                <p className="text-slate-500 font-medium text-lg mt-2 max-w-sm">Para iniciar uma correção, selecione um aluno no menu de busca acima.</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-center">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center">
                   <span className="text-3xl mb-3">🔴</span>
                   <h4 className="font-black text-slate-700 text-sm uppercase mb-1">Aguardando</h4>
                   <p className="text-[11px] text-slate-500 font-bold leading-tight">Sem resposta cadastrada.</p>
                </div>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex flex-col items-center">
                   <span className="text-3xl mb-3">🟡</span>
                   <h4 className="font-black text-amber-700 text-sm uppercase mb-1">Em Revisão</h4>
                   <p className="text-[11px] text-amber-600 font-bold leading-tight">Já existe um rascunho de resposta aqui.</p>
                </div>
                <div className="bg-green-50 p-6 rounded-3xl border border-green-100 flex flex-col items-center">
                   <span className="text-3xl mb-3">✅</span>
                   <h4 className="font-black text-green-700 text-sm uppercase mb-1">Lançado</h4>
                   <p className="text-[11px] text-green-600 font-bold leading-tight">Trabalho finalizado.</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 mb-6">
                <div className="flex items-center justify-between relative px-4 md:px-12">
                   <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-10 rounded-full"></div>
                   <div className={`absolute left-10 top-1/2 -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded-full transition-all duration-500 ${
                     atividadeAtual?.postado ? 'w-[calc(100%-5rem)] bg-green-500' : (atividadeAtual?.status === 'aprovado' ? 'w-1/2 bg-amber-400' : 'w-0')
                   }`}></div>
                   <div className={`flex flex-col items-center gap-2 bg-white px-3 ${novaResposta || arquivoUrl ? 'text-blue-600' : 'text-slate-400'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${novaResposta || arquivoUrl ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 text-slate-400 border-2 border-slate-200'}`}>1</div>
                      <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">Resposta</span>
                   </div>
                   <div className={`flex flex-col items-center gap-2 bg-white px-3 ${atividadeAtual?.status === 'aprovado' ? 'text-amber-500' : 'text-slate-400'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${atividadeAtual?.status === 'aprovado' ? (atividadeAtual?.postado ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-amber-400 text-white shadow-lg shadow-amber-400/30') : 'bg-slate-100 text-slate-400 border-2 border-slate-200'}`}>2</div>
                      <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">Feedback</span>
                   </div>
                   <div className={`flex flex-col items-center gap-2 bg-white px-3 ${atividadeAtual?.postado ? 'text-green-600' : 'text-slate-400'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${atividadeAtual?.postado ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-100 text-slate-400 border-2 border-slate-200'}`}>3</div>
                      <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">Oficial</span>
                   </div>
                </div>
              </div>

              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-10 space-y-12">
                  <section>
                    <h4 className="text-xs font-black text-slate-900 uppercase mb-4">1. Enunciado</h4>
                    <div className="bg-slate-50 p-6 md:p-8 rounded-2xl text-slate-700 leading-relaxed font-medium text-lg">
                      {tarefa?.enunciado || "Sem enunciado."}
                    </div>
                  </section>
                  
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase flex-1">2. Resposta do Aluno</h4>
                      <div className="flex items-center gap-4">
                        {arquivoUrl ? (
                          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
                            <FileCheck size={14}/>
                            <span className="text-[10px] font-black uppercase truncate max-w-[100px]">{nomeArquivo}</span>
                            <button onClick={() => { setArquivoUrl(''); setNomeArquivo(''); }} className="hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                        ) : (
                          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-all ${uploading ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                            {uploading ? <RefreshCw size={14} className="animate-spin"/> : <FileUp size={14}/>}
                            <span className="text-[10px] font-black uppercase">{uploading ? 'Subindo...' : 'Anexar PDF'}</span>
                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.rtf,.txt" onChange={handleUploadArquivo} disabled={uploading}/>
                          </label>
                        )}
                        <button onClick={() => { setNovaResposta(''); setArquivoUrl(''); setNomeArquivo(''); }} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"><Eraser size={14}/> Limpar</button>
                      </div>
                    </div>
                    <textarea rows="14" placeholder="Cole a resposta aqui..." className="w-full p-6 md:p-8 rounded-[24px] border-2 border-slate-100 bg-white text-slate-800 font-medium focus:border-blue-500 outline-none text-lg" value={novaResposta} onChange={(e) => setNovaResposta(e.target.value)}/>
                  </section>
              </div>
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-black flex items-center gap-3 mb-6"><CheckCircle className="text-green-400" size={24}/>Avaliação</h3>
                  <button onClick={handleGerarIA} disabled={gerandoIA || respostaEstaVazia} className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-blue-600 mb-4 flex items-center justify-center gap-3">
                    {gerandoIA ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>} Gerar Feedback IA
                  </button>
                </div>
                <div className="space-y-6">
                  <textarea rows="10" placeholder="Feedback aparecerá aqui..." className="w-full bg-slate-800 rounded-2xl p-5 text-sm text-slate-100 outline-none resize-none" value={feedbackEditado} onChange={e => setFeedbackEditado(e.target.value)}/>
                  <input type="text" placeholder="Nota" className="bg-slate-800 p-4 rounded-2xl font-black text-white w-full outline-none" value={notaAluno} onChange={e => setNotaAluno(e.target.value)}/>
                  
                  {atividadeAtual?.postado ? (
                      <div className="w-full bg-green-500/20 text-green-400 py-4 rounded-2xl text-xs font-black flex justify-center items-center gap-2"><CheckCheck size={18}/> LANÇADO OFICIALMENTE</div>
                  ) : atividadeAtual?.status === 'aprovado' ? (
                        <div className="pt-2 border-t border-slate-800 space-y-3">
                          <button onClick={() => handleAprovar(true)} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2"><Copy size={18}/> {copiado ? 'Copiado!' : '1. Copiar Feedback'}</button>
                          <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 shadow-xl"><Send size={18}/> 2. Confirmar Lançamento</button>
                        </div>
                  ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={handleSalvarRascunho} disabled={salvando || !feedbackEditado} className="bg-slate-800 py-3.5 rounded-2xl text-xs font-black border border-slate-700">💾 Rascunho</button>
                          <button onClick={() => handleAprovar(true)} disabled={salvando || !feedbackEditado} className="bg-blue-600 py-3.5 rounded-2xl text-xs font-black">🚀 Aprovar</button>
                        </div>
                  )}

                  {atividadeAtual && (
                    <div className="mt-8 border-t border-slate-800 pt-8 space-y-3">
                        <button onClick={handleDevolverRevisao} disabled={salvando} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-amber-500 py-2 hover:bg-amber-500/10 rounded-lg"><RotateCcw size={14}/> Devolver p/ Revisão</button>
                        <button onClick={handleExcluirAtividade} disabled={salvando} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-red-500 py-2 hover:bg-red-500/10 rounded-lg"><Trash2 size={14}/> Excluir Resposta</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
