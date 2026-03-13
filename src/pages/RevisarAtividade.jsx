import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, User, Copy, 
  Send, Sparkles, GraduationCap, Search, RefreshCw, CheckCheck, Eraser
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [atividadesMap, setAtividadesMap] = useState({});
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState('');
  
  const [novaResposta, setNovaResposta] = useState('');
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [notaAluno, setNotaAluno] = useState(''); 
  
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 
  const isPremium = userProfile?.plano === 'premium' || isAdmin;

  const respostaEstaVazia = novaResposta.trim().length === 0;

  useEffect(() => {
    async function buscarDadosDaEstacao() {
      setLoading(true);
      try {
        const snapTarefa = await getDoc(doc(db, 'tarefas', id));
        if (!snapTarefa.exists()) return navigate('/');
        setTarefa({ id: snapTarefa.id, ...snapTarefa.data() });

        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', snapTarefa.data().turmaId));
        const snapAlunos = await getDocs(qAlunos);
        const listaAlunos = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome));
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
  }, [alunoSelecionadoId, atividadeAtual]);

  async function handleGerarIA() {
    if (respostaEstaVazia) return;
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        tools: [{ googleSearch: {} }] 
      });

      const promptCompleto = `
        Aja como um preceptor médico. Estilo: ${userProfile?.promptPersonalizado || 'Direto e técnico.'}
        QUESTÃO: ${tarefa?.enunciado}
        RESPOSTA: "${novaResposta}"
        Gere um feedback direto ao aluno.
      `;

      const result = await model.generateContent(promptCompleto);
      setFeedbackEditado(result.response.text());
    } catch (e) { 
      console.error("ERRO API:", e);
      alert("Erro na IA: " + e.message); 
    } finally { setGerandoIA(false); }
  }

  async function handleAprovar() {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        feedbackFinal: feedbackEditado.trim(), 
        feedbackSugerido: atividadeAtual?.feedbackSugerido || (isPremium ? feedbackEditado.trim() : ''),
        nota: notaAluno.trim() || null, 
        status: 'aprovado', 
        dataAprovacao: serverTimestamp() 
      };
      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } }));
      } else {
        const novaAtiv = { alunoId: alunoAtual.id, turmaId: tarefa.turmaId, tarefaId: tarefa.id, dataCriacao: serverTimestamp(), postado: false, ...payload };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      alert("Salvo com sucesso!");
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

  if (loading) return <div className="p-20 text-center animate-pulse">Carregando...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 self-start md:self-auto">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><ArrowLeft size={20} /></Link>
             <div>
               <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none truncate max-w-[200px] md:max-w-none">{tarefa?.nomeTarefa}</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Estação de Trabalho</p>
             </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-2xl w-full md:w-[450px]">
            <Search size={16} className="text-blue-500" />
            <select className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer text-sm" value={alunoSelecionadoId} onChange={(e) => setAlunoSelecionadoId(e.target.value)}>
              <option value="">Buscar Aluno...</option>
              {alunos.map(a => {
                const registro = atividadesMap[a.id];
                let icone = registro?.postado ? '✅' : registro ? '🟡' : '🔴';
                return <option key={a.id} value={a.id}>{icone} {a.nome}</option>;
              })}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {!alunoAtual ? (
          <div className="bg-white p-12 rounded-[48px] border-2 border-dashed border-slate-200 text-center">
             <h3 className="text-2xl font-black text-slate-800 mb-4">Selecione um aluno na busca acima</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-10 space-y-12">
                  <section>
                    <h4 className="text-xs font-black text-slate-900 uppercase mb-4 flex items-center gap-2"><span className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center">1</span> Enunciado</h4>
                    <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 leading-relaxed font-medium">{tarefa?.enunciado}</div>
                  </section>
                  <section>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-black text-slate-900 uppercase flex items-center gap-2"><span className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center">2</span> Resposta do Aluno</h4>
                      {novaResposta && <button onClick={() => setNovaResposta('')} className="text-[10px] font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"><Eraser size={14}/> LIMPAR</button>}
                    </div>
                    <textarea rows="14" placeholder="Cole a resposta aqui..." className="w-full p-6 rounded-[24px] border-2 border-slate-100 bg-white text-slate-800 font-medium focus:border-blue-500 outline-none" value={novaResposta} onChange={(e) => setNovaResposta(e.target.value)} />
                  </section>
              </div>
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl border border-slate-800">
                <div className="mb-6">
                  <h3 className="text-lg font-black flex items-center gap-3 mb-6"><CheckCircle className="text-green-400" size={24}/>Avaliação</h3>
                  {isPremium && (
                    <button onClick={handleGerarIA} disabled={gerandoIA || respostaEstaVazia} className={`w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-all ${gerandoIA ? 'bg-slate-800 text-indigo-300' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-90 disabled:opacity-30'}`}>
                      {gerandoIA ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                      {gerandoIA ? 'Escrevendo...' : 'Gerar Feedback IA'}
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2 px-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">Texto do Feedback</label>
                      {feedbackEditado && <button onClick={() => setFeedbackEditado('')} className="text-[10px] font-bold text-slate-400 hover:text-red-400 flex items-center gap-1"><Eraser size={12}/> LIMPAR</button>}
                    </div>
                    <textarea rows="10" className="w-full bg-slate-800 border-none rounded-2xl p-5 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none" value={feedbackEditado} onChange={e => setFeedbackEditado(e.target.value)} />
                  </div>

                  <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <GraduationCap className="text-blue-400" size={20}/><div className="flex-1"><label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Nota</label><input type="text" className="bg-transparent border-none outline-none font-black text-white w-full text-base" value={notaAluno} onChange={e => setNotaAluno(e.target.value)} /></div>
                  </div>

                  <button onClick={handleAprovar} disabled={salvando || !feedbackEditado} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-3xl transition-all flex justify-center items-center gap-3 text-lg">
                    {salvando ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>} Salvar Revisão
                  </button>

                  {atividadeAtual?.status === 'aprovado' && (
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <button onClick={() => { navigator.clipboard.writeText(feedbackEditado); setCopiado(true); setTimeout(()=>setCopiado(false), 2000); }} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2">
                        <Copy size={18}/> {copiado ? 'Copiado!' : '1. Copiar Feedback'}
                      </button>
                      {atividadeAtual.postado ? (
                         <div className="w-full bg-green-500/20 border border-green-500/30 text-green-400 py-4 rounded-2xl text-xs font-black flex justify-center items-center gap-2"><CheckCheck size={18}/> LANÇADO</div>
                      ) : (
                        <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2"><Send size={18}/> 2. Confirmar Lançamento</button>
                      )}
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
