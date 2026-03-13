import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, User, Copy, 
  Send, Sparkles, GraduationCap, Search, RefreshCw, CheckCheck
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
      
      // Ajuste mágico: usando o modelo 1.5-flash-latest para liberar a cota
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash-latest", 
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
      console.error("ERRO COMPLETO DA API:", e);
      alert("A API recusou o pedido. Erro: " + e.message); 
    }
    finally { setGerandoIA(false); }
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
        const novaAtiv = { alunoId: alunoAtual.id, turmaId: tarefa.turmaId, instituicaoId: tarefa.instituicaoId, tarefaId: tarefa.id, dataCriacao: serverTimestamp(), postado: false, ...payload };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      alert("Avaliação salva internamente!");
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: serverTimestamp() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true } }));
      alert("Status atualizado para FINALIZADO.");
    } catch (error) { console.error(error); } finally { setMarcandoPostado(false); }
  }

  if (loading) return <div className="p-20 text-center font-black text-slate-400 animate-pulse text-xl">Iniciando estação...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 self-start md:self-auto">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft size={20} /></Link>
             <div>
               <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none truncate max-w-[250px] md:max-w-none">{tarefa?.nomeTarefa}</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Estação de Trabalho</p>
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
                  if (registro.postado) icone = '✅'; 
                  else icone = '🟡';
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
             <h3 className="text-2xl font-black text-slate-800 mb-8">Status das Atividades</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center text-center">
                   <span className="text-3xl mb-3">🔴</span>
                   <h4 className="font-black text-slate-700 text-sm uppercase mb-1">Aguardando</h4>
                   <p className="text-[11px] text-slate-500 font-bold leading-tight">Você ainda não trouxe a resposta do aluno para esta plataforma.</p>
                </div>
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex flex-col items-center text-center shadow-sm">
                   <span className="text-3xl mb-3">🟡</span>
                   <h4 className="font-black text-amber-700 text-sm uppercase mb-1">Em Revisão</h4>
                   <p className="text-[11px] text-amber-600 font-bold leading-tight">
                     A resposta já está aqui, mas ainda não foi aprovado o feedback sugerido pela IA e a atividade não foi marcada como lançada no sistema oficial.
                   </p>
                </div>
                <div className="bg-green-50 p-6 rounded-3xl border border-green-100 flex flex-col items-center text-center shadow-sm">
                   <span className="text-3xl mb-3">✅</span>
                   <h4 className="font-black text-green-700 text-sm uppercase mb-1">Lançado</h4>
                   <p className="text-[11px] text-green-600 font-bold leading-tight">
                     Trabalho concluído! O feedback e/ou a nota já foi (foram) lançada(os) para o portal da sua instituição.
                   </p>
                </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-200 p-6 md:p-10 space-y-12">
                  <section>
                    <div className="flex items-center gap-3 mb-4"><div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black">1</div><h4 className="text-xs font-black text-slate-900 uppercase">Enunciado</h4></div>
                    <div className="bg-slate-50 p-6 md:p-8 rounded-2xl text-slate-700 leading-relaxed font-medium text-base md:text-lg">{tarefa?.enunciado || "Sem enunciado."}</div>
                  </section>
                  <section>
                    <div className="flex items-center gap-3 mb-4"><div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black">2</div><h4 className="text-xs font-black text-slate-900 uppercase">Resposta do Aluno</h4></div>
                    <textarea rows="14" placeholder="Cole a resposta aqui..." className="w-full p-6 md:p-8 rounded-[24px] border-2 border-slate-100 bg-white text-slate-800 font-medium focus:border-blue-500 outline-none text-base md:text-lg" value={novaResposta} onChange={(e) => setNovaResposta(e.target.value)}/>
                  </section>
              </div>
            </div>

            <div className="lg:col-span-4 lg:sticky lg:top-24">
              <div className="bg-slate-900 rounded-[32px] p-6 md:p-8 text-white shadow-2xl border border-slate-800">
                <div className="mb-6">
                  <h3 className="text-lg md:text-xl font-black flex items-center gap-3 mb-6"><CheckCircle className="text-green-400" size={24}/>Avaliação</h3>
                  {isPremium && (
                    <button onClick={handleGerarIA} disabled={gerandoIA || respostaEstaVazia} className={`w-full py-4 rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 mb-6 ${gerandoIA ? 'bg-slate-800 text-indigo-300' : respostaEstaVazia ? 'bg-slate-800 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/20'}`}>
                      {gerandoIA ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                      {gerandoIA ? 'Escrevendo...' : 'Gerar Feedback IA'}
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <textarea rows="10" placeholder="O feedback aparecerá aqui..." className="w-full bg-slate-800 border-none rounded-2xl p-5 text-sm font-medium text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed" value={feedbackEditado} onChange={e => setFeedbackEditado(e.target.value)}/>
                  <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <GraduationCap className="text-blue-400" size={20}/><div className="flex-1"><label className="block text-[9px] font-black text-slate-500 uppercase mb-0.5">Nota</label><input type="text" placeholder="Ex: 10.0" className="bg-transparent border-none outline-none font-black text-white w-full text-base" value={notaAluno} onChange={e => setNotaAluno(e.target.value)}/></div>
                  </div>

                  <button onClick={handleAprovar} disabled={salvando || !feedbackEditado} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-3xl shadow-xl transition-all flex justify-center items-center gap-3 text-lg">
                    {salvando ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                    Salvar Revisão
                  </button>

                  {atividadeAtual?.status === 'aprovado' && (
                    <div className="pt-4 border-t border-slate-800 space-y-4">
                      <button onClick={() => { navigator.clipboard.writeText(feedbackEditado); setCopiado(true); setTimeout(()=>setCopiado(false), 2000); }} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 hover:bg-slate-100 transition-colors">
                        <Copy size={18}/> {copiado ? 'Copiado para o seu Sistema!' : '1. Copiar Feedback'}
                      </button>

                      {atividadeAtual.postado ? (
                         <div className="w-full bg-green-500/20 border border-green-500/30 text-green-400 py-4 rounded-2xl text-xs font-black flex justify-center items-center gap-2">
                            <CheckCheck size={18}/> LANÇADO OFICIALMENTE
                         </div>
                      ) : (
                        <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 shadow-xl">
                          <Send size={18}/> 2. Confirmar Lançamento Oficial
                        </button>
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
