import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, FileText, User, Copy, 
  Send, Sparkles, GraduationCap, Search, RefreshCw, AlertCircle
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

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 
  const isPremium = userProfile?.plano === 'premium' || isAdmin;

  // Verificador se o campo de resposta tem conteúdo
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
        const listaAlunos = snapAlunos.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.status !== 'lixeira')
          .sort((a, b) => a.nome.localeCompare(b.nome));
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
        Aja como um preceptor médico experiente. Estilo: ${userProfile?.promptPersonalizado || 'Direto e técnico.'}
        CONTEXTO: ${tarefa?.enunciado || 'Verificar correção gramatical e técnica.'}
        RESPOSTA DO ALUNO: "${novaResposta}"
        Analise a resposta e gere um feedback direto para o aluno.
      `;

      const result = await model.generateContent(promptCompleto);
      setFeedbackEditado(result.response.text());
    } catch (e) { 
      if (e.message?.includes('429')) alert("Limite do Google atingido. Aguarde 60s.");
      else alert("Instabilidade na IA. Tente novamente.");
    }
    finally { setGerandoIA(false); }
  }

  async function handleAprovar() {
    if (salvando || !alunoAtual) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        feedbackSugerido: atividadeAtual?.feedbackSugerido || (isPremium ? feedbackEditado.trim() : ''),
        feedbackFinal: feedbackEditado.trim(), 
        nota: notaAluno.trim() || null, 
        status: 'aprovado', 
        postado: false, 
        dataAprovacao: serverTimestamp() 
      };

      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } }));
      } else {
        const novaAtiv = { alunoId: alunoAtual.id, turmaId: tarefa.turmaId, instituicaoId: tarefa.instituicaoId, tarefaId: tarefa.id, dataCriacao: serverTimestamp(), ...payload };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      alert("Avaliação Salva!");
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  if (loading) return <div className="p-20 text-center font-black text-slate-400 animate-pulse">Carregando Estação...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      {/* BARRA DE BUSCA SUPERIOR FIXA */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft size={24} /></Link>
             <div>
               <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">{tarefa.nomeTarefa}</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Painel de Avaliação</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 px-5 py-2.5 rounded-2xl w-full md:w-[450px] focus-within:border-blue-500 transition-all">
            <Search size={18} className="text-blue-500" />
            <select 
              className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer text-sm"
              value={alunoSelecionadoId}
              onChange={(e) => setAlunoSelecionadoId(e.target.value)}
            >
              <option value="">Buscar Aluno na Lista...</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>
                  {atividadesMap[a.id]?.status === 'aprovado' ? '✅' : '🔴'} {a.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10">
        {!alunoAtual ? (
          <div className="bg-white p-32 rounded-[48px] text-center border-2 border-dashed border-slate-200">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <User className="text-slate-200" size={48} />
             </div>
             <h3 className="text-2xl font-black text-slate-300">Selecione o aluno para avaliar</h3>
          </div>
        ) : (
          /* O GRID PRINCIPAL COM ALINHAMENTO AO TOPO PARA O STICKY FUNCIONAR */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* COLUNA DA ESQUERDA: DOCUMENTAÇÃO (ROLA NATURALMENTE) */}
            <div className="lg:col-span-8 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-10 space-y-12">
                  
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-blue-100">1</div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Enunciado da Questão</h4>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-slate-700 leading-relaxed font-medium text-lg">
                      {tarefa.enunciado || <span className="text-slate-400 italic">Cadastre o enunciado na tela de tarefas.</span>}
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-blue-100">2</div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Resposta do Aluno</h4>
                    </div>
                    <textarea
                      rows="16"
                      placeholder="Cole aqui o texto enviado pelo aluno..."
                      className="w-full p-8 rounded-[32px] border-2 border-slate-100 bg-white text-slate-800 font-medium focus:border-blue-500 focus:bg-white outline-none transition-all leading-relaxed shadow-inner text-lg"
                      value={novaResposta}
                      onChange={(e) => setNovaResposta(e.target.value)}
                    />
                  </section>
                </div>
              </div>
            </div>

            {/* COLUNA DA DIREITA: MESA DE AVALIAÇÃO (FICA PRESA NA TELA) */}
            <div className="lg:col-span-4 sticky top-28 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl border border-slate-800">
                
                <div className="mb-8">
                  <h3 className="text-xl font-black flex items-center gap-3 mb-6">
                    <CheckCircle className="text-green-400" size={28}/>
                    Avaliação
                  </h3>
                  
                  {isPremium && (
                    <button 
                      onClick={handleGerarIA} 
                      disabled={gerandoIA || respostaEstaVazia}
                      className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 mb-6 ${
                        gerandoIA 
                        ? 'bg-slate-800 text-indigo-300' 
                        : respostaEstaVazia 
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50 grayscale' 
                          : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 shadow-indigo-500/20'
                      }`}
                    >
                      {gerandoIA ? <RefreshCw className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                      {gerandoIA ? 'Gerando...' : 'Gerar Feedback com IA'}
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="relative">
                    <textarea
                      rows="10"
                      placeholder="O texto do feedback aparecerá aqui..."
                      className="w-full bg-slate-800 border-none rounded-3xl p-6 text-base font-medium text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed placeholder:text-slate-600"
                      value={feedbackEditado}
                      onChange={e => setFeedbackEditado(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3 bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <GraduationCap className="text-blue-400" size={24}/>
                    <div className="flex-1">
                       <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Nota Final</label>
                       <input 
                        type="text" placeholder="Ex: 10.0" 
                        className="bg-transparent border-none outline-none font-black text-white w-full text-lg"
                        value={notaAluno} onChange={e => setNotaAluno(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleAprovar} 
                    disabled={salvando || !feedbackEditado}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-3xl shadow-xl transition-all flex justify-center items-center gap-3 text-xl active:scale-95 disabled:opacity-50"
                  >
                    {salvando ? <RefreshCw className="animate-spin" size={28}/> : <CheckCircle size={28}/>}
                    Salvar Avaliação
                  </button>

                  {feedbackEditado && (
                    <button 
                      onClick={() => { navigator.clipboard.writeText(feedbackEditado); setCopiado(true); setTimeout(()=>setCopiado(false), 2000); }}
                      className="w-full bg-slate-800 text-slate-300 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 hover:bg-slate-700 transition-colors"
                    >
                      <Copy size={18}/> {copiado ? 'Copiado!' : 'Copiar Feedback'}
                    </button>
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
