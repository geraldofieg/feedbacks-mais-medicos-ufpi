import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
// 🔥 CIRURGIA V1: Importado o deleteField do firestore
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, User, Copy, 
  Send, Sparkles, GraduationCap, Search, RefreshCw, CheckCheck, Eraser,
  Lock, Settings, CalendarDays, RotateCcw, Trash2, MousePointer2, Paperclip, FileUp, FileCheck, ExternalLink
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
  const [salvoFeedback, setSalvoFeedback] = useState(false);
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

  // 🔥 NOVO: Estado para o prompt ser sincronizado em tempo real entre abas
  const [promptVivo, setPromptVivo] = useState(userProfile?.promptPersonalizado || localStorage.getItem('@SaaS_PromptVivo') || '');
  
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
      } catch (error) { 
        console.error(error);
      } 
      finally { setLoading(false); }
    }
    buscarDadosDaEstacao();
  }, [id, navigate]);

  // 🔥 NOVO: Monitor de Sincronização do Prompt
  useEffect(() => {
    if (userProfile?.promptPersonalizado) {
      setPromptVivo(userProfile.promptPersonalizado);
      localStorage.setItem('@SaaS_PromptVivo', userProfile.promptPersonalizado);
    }

    const sincronizarPrompt = (e) => {
      if (e.key === '@SaaS_PromptVivo' && e.newValue) {
        setPromptVivo(e.newValue);
      }
    };

    window.addEventListener('storage', sincronizarPrompt);
    return () => window.removeEventListener('storage', sincronizarPrompt);
  }, [userProfile]);

  const alunoAtual = alunoSelecionadoId ? alunos.find(a => a.id === alunoSelecionadoId) : null;
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  useEffect(() => {
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
    setArquivoUrl(atividadeAtual?.arquivoUrl || '');
    setNomeArquivo(atividadeAtual?.nomeArquivo || '');
  }, [alunoSelecionadoId, atividadeAtual]);

  // 🔥 CAÇADOR DE LINKS NO ENUNCIADO
  const renderizarComLinks = (texto) => {
    if (!texto) return "Sem enunciado.";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const partes = texto.split(urlRegex);

    return partes.map((parte, i) => {
      if (parte.match(urlRegex)) {
        return (
          <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline break-all">
            {parte}
          </a>
        );
      }
      return parte;
    });
  };

  // 🔥 RADAR DE LINKS NA RESPOSTA
  const extrairLinksDaResposta = (texto) => {
    if (!texto) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return texto.match(urlRegex) || [];
  };
  const linksNaResposta = extrairLinksDaResposta(novaResposta);

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
      }
    );
  }

  async function handleGerarIA() {
    if (isTier1) {
      if (window.confirm("🔒 Deseja conhecer o Plano Premium para usar IA?")) navigate('/planos');
      return;
    }
    if (!promptVivo) {
      if (window.confirm("Configure suas instruções de correção antes.")) navigate('/configuracoes');
      return;
    }
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
      
      const promptCompleto = `Aja como um preceptor médico.
      Estilo: ${promptVivo}. QUESTÃO: ${tarefa?.enunciado}. RESPOSTA: "${novaResposta}". Gere um feedback pedagógico direto.`;
      const result = await model.generateContent(promptCompleto);
      setFeedbackEditado(result.response.text());
    } catch (e) { 
      console.error(e);
      alert("Erro ao conectar com a IA da Google. Tenta novamente.");
    }
    finally { setGerandoIA(false); }
  }

  async function handleSalvarRascunho() {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        arquivoUrl: arquivoUrl,
        nomeArquivo: nomeArquivo,
        feedbackFinal: feedbackEditado.trim(), 
        feedbackSugerido: atividadeAtual?.feedbackSugerido || (isPremium || isTier2 ? feedbackEditado.trim() : ''),
        nota: notaAluno.trim() || null, 
        status: atividadeAtual?.status === 'aprovado' ? 'aprovado' : 'pendente',
        nomeAluno: alunoAtual.nome, 
        nomeTarefa: tarefa.nomeTarefa,
        aluno: alunoAtual.nome,
        tarefa: tarefa.nomeTarefa,
        modulo: tarefa.nomeTarefa,
        revisadoPor: userProfile?.nome || currentUser?.email || 'Professor'
      };

      if (atividadeAtual?.status === 'aprovado') {
          payload.dataAprovacao = atividadeAtual.dataAprovacao;
      } else {
          if (atividadeAtual) {
              payload.dataAprovacao = deleteField();
          }
      }

      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload, dataAprovacao: null } }));
      } else {
        const novaAtiv = { alunoId: alunoAtual.id, turmaId: tarefa.turmaId, instituicaoId: tarefa.instituicaoId, tarefaId: tarefa.id, dataCriacao: serverTimestamp(), postado: false, ...payload };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      
      setSalvoFeedback(true);
      setTimeout(() => setSalvoFeedback(false), 2000);
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
        aluno: alunoAtual.nome,
        tarefa: tarefa.nomeTarefa,
        modulo: tarefa.nomeTarefa,
        revisadoPor: userProfile?.nome || currentUser?.email || 'Professor'
      };
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } }));
      if (copiarAoAprovar) { 
        navigator.clipboard.writeText(feedbackEditado.trim()); 
        setCopiado(true); 
        setTimeout(() => setCopiado(false), 2000);
      }
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: serverTimestamp() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true } }));
    } catch (error) { console.error(error); } finally { setMarcandoPostado(false); }
  }

  async function handleDevolverRevisao() {
    if (!window.confirm("Deseja devolver esta atividade para a fase de revisão?")) return;
    setSalvando(true);
    try {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), { status: 'pendente', postado: false, dataAprovacao: deleteField() });
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

  // 🔥 LÓGICA DA BARRA DE EVOLUÇÃO (STEPPER)
  const isStep1Done = !!(novaResposta || arquivoUrl);
  const isStep2Done = atividadeAtual?.status === 'aprovado' || atividadeAtual?.postado;
  const isStep3Done = atividadeAtual?.postado;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 self-start md:self-auto">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft size={20} /></Link>
    
             <div>
               <h2 className="text-lg font-black text-slate-900 line-clamp-2 leading-tight max-w-[280px] sm:max-w-full">{tarefa?.nomeTarefa}</h2>
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
        
        {/* 🔥 NOVA BARRA DE EVOLUÇÃO (SEMPRE VISÍVEL) */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-center justify-between relative px-4 md:px-12">
            <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-slate-100 -z-10 rounded-full"></div>
            
            {/* Linha de progresso preenchida */}
            <div className={`absolute left-10 top-1/2 -translate-y-1/2 h-1 transition-all duration-500 -z-10 rounded-full ${
              isStep2Done ? 'w-[calc(100%-5rem)] bg-green-500' : (isStep1Done ? 'w-1/2 bg-green-500' : 'w-0')
            }`}></div>

            {/* Passo 1: Resposta do Aluno */}
            <div className={`flex flex-col items-center gap-2 bg-white px-3 ${!alunoAtual ? 'text-slate-400' : (isStep1Done ? 'text-green-600' : 'text-blue-600')}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${!alunoAtual ? 'bg-slate-100 text-slate-400 border-2 border-slate-200' : (isStep1Done ? 'bg-green-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg ring-4 ring-blue-50')}`}>
                {isStep1Done ? '✓' : '1'}
              </div>
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">1. Resposta do Aluno</span>
            </div>

            {/* Passo 2: Área de Feedback */}
            <div className={`flex flex-col items-center gap-2 bg-white px-3 ${!isStep1Done ? 'text-slate-400' : (isStep2Done ? 'text-green-600' : 'text-amber-500')}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${!isStep1Done ? 'bg-slate-100 text-slate-400 border-2 border-slate-200' : (isStep2Done ? 'bg-green-500 text-white shadow-lg' : 'bg-amber-400 text-white shadow-lg ring-4 ring-amber-50')}`}>
                {isStep2Done ? '✓' : '2'}
              </div>
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">2. Área de Feedback</span>
            </div>

            {/* Passo 3: Pronto para Postar */}
            <div className={`flex flex-col items-center gap-2 bg-white px-3 ${!isStep2Done ? 'text-slate-400' : (isStep3Done ? 'text-green-600' : 'text-blue-600')}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-colors ${!isStep2Done ? 'bg-slate-100 text-slate-400 border-2 border-slate-200' : (isStep3Done ? 'bg-green-500 text-white shadow-lg' : 'bg-blue-500 text-white shadow-lg ring-4 ring-blue-50')}`}>
                {isStep3Done ? '✓' : '3'}
              </div>
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest text-center leading-tight">3. Pronto p/ Postar</span>
            </div>
          </div>
        </div>

        {!alunoAtual ? (
          /* 🔥 NOVO EMPTY STATE EDUCATIVO */
          <div className="bg-white p-12 md:p-24 rounded-[48px] border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center">
            <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4">
                <MousePointer2 size={32} />
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-4">A esteira de revisão está vazia</h3>
              <div className="text-slate-600 max-w-md text-left space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm text-lg font-medium">
                <p><strong className="text-blue-600">1.</strong> Selecione um aluno pendente ao lado.</p>
                <p><strong className="text-amber-500">2.</strong> Cole a resposta dele aqui no sistema.</p>
                <p><strong className="text-green-600">3.</strong> Avalie e aprove para movê-lo para a lista final.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-10 space-y-12">
                  <section>
                    <h4 className="text-xs font-black text-slate-900 uppercase mb-4">1. Enunciado</h4>
                    <div className="bg-slate-50 p-6 md:p-8 rounded-2xl text-slate-700 leading-relaxed font-medium text-lg whitespace-pre-wrap">
                      {renderizarComLinks(tarefa?.enunciado)}
                    </div>
                  </section>
                  
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase flex-1">2. Resposta do Aluno</h4>
                      <div className="flex items-center gap-4">
                        {arquivoUrl ? (
                          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200 shadow-sm">
                            <a href={arquivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline cursor-pointer" title="Clique para visualizar/baixar o arquivo">
                              <FileCheck size={14}/>
                              <span className="text-[10px] font-black uppercase truncate max-w-[100px]">{nomeArquivo || "Arquivo Anexado"}</span>
                            </a>
                            <button onClick={() => { setArquivoUrl(''); setNomeArquivo(''); }} className="hover:text-red-500 ml-1 border-l border-green-200 pl-2" title="Remover anexo"><Trash2 size={14}/></button>
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
                    
                    {linksNaResposta.length > 0 && (
                      <div className="mt-4 p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-3 shadow-inner">
                        <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2">
                          <ExternalLink size={14} /> Links detectados na resposta do aluno:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {linksNaResposta.map((link, idx) => (
                            <a key={idx} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 bg-white px-4 py-2 rounded-xl border border-indigo-200 shadow-sm transition-all truncate max-w-full">
                              Abrir Link {linksNaResposta.length > 1 ? idx + 1 : ''} <ArrowLeft size={14} className="rotate-180"/>
                            </a>
                          ))}
                        </div>
                         <p className="text-[9px] text-indigo-400 font-bold italic">Nota: Caixas de texto não permitem cliques diretos. Use os botões acima para abrir os arquivos do aluno.</p>
                      </div>
                    )}
                  </section>
              </div>
            </div>

             <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-black flex items-center gap-3 mb-6"><CheckCircle className="text-green-400" size={24}/>Avaliação</h3>
                  <button onClick={handleGerarIA} disabled={gerandoIA || respostaEstaVazia} className="w-full py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-blue-600 mb-4 flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform">
                    {gerandoIA ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>} Gerar Feedback IA
                  </button>
                </div>
                <div className="space-y-6">
                  <textarea rows="10" placeholder="Feedback aparecerá aqui..." className="w-full bg-slate-800 rounded-2xl p-5 text-sm text-slate-100 outline-none resize-none focus:ring-2 focus:ring-indigo-500 transition-all" value={feedbackEditado} onChange={e => setFeedbackEditado(e.target.value)}/>
    
                   <input type="text" placeholder="Nota" className="bg-slate-800 p-4 rounded-2xl font-black text-white w-full outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={notaAluno} onChange={e => setNotaAluno(e.target.value)}/>
                  
                  {atividadeAtual?.postado ? (
                      <div className="w-full bg-green-500/20 text-green-400 py-4 rounded-2xl text-xs font-black flex justify-center items-center gap-2 border border-green-500/30"><CheckCheck size={18}/> LANÇADO OFICIALMENTE</div>
                  ) : atividadeAtual?.status === 'aprovado' ? (
                        <div className="pt-2 border-t border-slate-800 space-y-3">
                          <button onClick={() => handleAprovar(true)} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 hover:bg-slate-100 transition-colors"><Copy size={18}/> {copiado ? 'Copiado!' : '1. Copiar Feedback'}</button>
                      
                          {/* 🔥 BOTÃO FINAL CORRIGIDO */}
                          <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 shadow-xl hover:bg-indigo-700 transition-colors"><Send size={18}/> 2. Marcar Oficial (Move p/ Histórico)</button>
                        </div>
                  ) : (
                        <div className="grid grid-cols-2 gap-3">
     
                           {/* 🔥 BOTÃO RASCUNHO CORRIGIDO */}
                           <button onClick={handleSalvarRascunho} disabled={salvando || (!feedbackEditado && !novaResposta && !arquivoUrl)} className="bg-slate-800 py-3.5 rounded-2xl text-xs font-black border border-slate-700 hover:bg-slate-700 transition-colors leading-tight px-2">
                              {salvoFeedback ? '✅ Salvo!' : '💾 Salvar (Mantém na Revisão)'}
                           </button>

                          {/* 🔥 BOTÃO APROVAR CORRIGIDO */}
                          <button onClick={() => handleAprovar(true)} disabled={salvando || !feedbackEditado} className="bg-blue-600 py-3.5 rounded-2xl text-xs font-black hover:bg-blue-700 transition-colors leading-tight px-2">🚀 Aprovar (Move p/ Postar)</button>
                        </div>
                  )}

                  {atividadeAtual && (
                    <div className="mt-8 border-t border-slate-800 pt-8 space-y-3">
                       <button onClick={handleDevolverRevisao} disabled={salvando} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-amber-500 py-2 hover:bg-amber-500/10 rounded-lg transition-colors"><RotateCcw size={14}/> Devolver p/ Revisão</button>
                        <button onClick={handleExcluirAtividade} disabled={salvando} className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-red-500 py-2 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14}/> Excluir Resposta</button>
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
