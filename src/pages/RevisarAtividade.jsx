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

  // BUSCA DADOS (TAREFA + ALUNOS + ATIVIDADES)
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

  // SINCRONIZA CAMPOS AO MUDAR ALUNO
  useEffect(() => {
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
  }, [alunoSelecionadoId, atividadeAtual]);

  // MOTOR IA GEMINI 3.1
  async function handleGerarIA() {
    if (!novaResposta.trim()) return alert("Cole a resposta do aluno primeiro!");
    setGerandoIA(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        tools: [{ googleSearch: {} }] 
      });

      const promptCompleto = `
        Aja como um preceptor médico. Estilo: ${userProfile?.promptPersonalizado || 'Técnico e cordial.'}
        QUESTÃO: ${tarefa?.enunciado || 'Verificar resposta do aluno.'}
        RESPOSTA DO ALUNO: ${novaResposta}
        Analise a resposta, valide protocolos atuais e escreva o feedback DIRETAMENTE ao aluno.
      `;

      const result = await model.generateContent(promptCompleto);
      setFeedbackEditado(result.response.text());
    } catch (e) { alert("Erro na IA."); }
    finally { setGerandoIA(false); }
  }

  // SALVAMENTO (PAYLOAD ORIGINAL PRESERVADO)
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
        const novaAtiv = {
          alunoId: alunoAtual.id,
          turmaId: tarefa.turmaId,
          instituicaoId: tarefa.instituicaoId,
          tarefaId: tarefa.id,
          dataCriacao: serverTimestamp(),
          ...payload
        };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { id: docRef.id, ...novaAtiv } }));
      }
      alert("Avaliação Concluída!");
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  if (loading) return <div className="p-20 text-center font-black text-slate-400 animate-pulse">Preparando mesa de correção...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* HEADER DE BUSCA (MIRA A LASER) */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
             <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><ArrowLeft size={24} /></Link>
             <div>
               <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">{tarefa.nomeTarefa}</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Estação de Correção</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 px-5 py-2.5 rounded-2xl w-full md:w-[450px] focus-within:border-blue-500 transition-all">
            <Search size={18} className="text-blue-500" />
            <select 
              className="bg-transparent font-black text-slate-700 outline-none w-full cursor-pointer text-sm"
              value={alunoSelecionadoId}
              onChange={(e) => setAlunoSelecionadoId(e.target.value)}
            >
              <option value="">Selecione um aluno da turma...</option>
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
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <User className="text-slate-200" size={40} />
             </div>
             <h3 className="text-2xl font-black text-slate-300">Aguardando seleção do aluno</h3>
             <p className="text-slate-400 font-medium mt-2">Use a busca acima para abrir a ficha de avaliação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
            
            {/* COLUNA DO DOCUMENTO (ENUNCIADO + RESPOSTA) */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-10 space-y-12">
                  
                  {/* SEÇÃO 1: ENUNCIADO */}
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-blue-100">1</div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Enunciado / Questão</h4>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 text-slate-700 leading-relaxed font-medium text-lg">
                      {tarefa.enunciado || <span className="text-slate-400 italic">Nenhum enunciado cadastrado para esta tarefa.</span>}
                    </div>
                  </section>

                  {/* SEÇÃO 2: RESPOSTA DO ALUNO */}
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-lg shadow-blue-100">2</div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Resposta do Aluno</h4>
                    </div>
                    <textarea
                      rows="14"
                      placeholder="Cole aqui a resposta enviada pelo aluno..."
                      className="w-full p-8 rounded-[32px] border-2 border-slate-100 bg-white text-slate-800 font-medium focus:border-blue-500 focus:bg-white outline-none transition-all leading-relaxed shadow-inner text-lg"
                      value={novaResposta}
                      onChange={(e) => setNovaResposta(e.target.value)}
                    />
                  </section>

                </div>
              </div>
            </div>

            {/* COLUNA DO FEEDBACK (ESTILO PAINEL V1) */}
            <div className="lg:col-span-4">
              <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl border border-slate-800 sticky top-28">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black flex items-center gap-3">
                    <CheckCircle className="text-green-400" size={28}/>
                    Avaliação
                  </h3>
                  {isPremium && (
                    <button 
                      onClick={handleGerarIA} 
                      disabled={gerandoIA || !novaResposta}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl transition-all shadow-lg disabled:opacity-30 disabled:grayscale"
                      title="Gerar com IA"
                    >
                      {gerandoIA ? <RefreshCw className="animate-spin" size={24}/> : <Sparkles size={24}/>}
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* ÁREA DE TEXTO DO FEEDBACK */}
                  <div className="relative group">
                    <textarea
                      rows="12"
                      placeholder="O feedback aparecerá aqui..."
                      className="w-full bg-slate-800 border-none rounded-3xl p-6 text-base font-medium text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed placeholder:text-slate-600"
                      value={feedbackEditado}
                      onChange={e => setFeedbackEditado(e.target.value)}
                    />
                    {gerandoIA && (
                      <div className="absolute inset-0 bg-slate-900/60 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                           <RefreshCw className="animate-spin text-indigo-400" size={32}/>
                           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">IA Gerando...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CAMPO DE NOTA */}
                  <div className="flex items-center gap-3 bg-slate-800 p-5 rounded-2xl border border-slate-700">
                    <GraduationCap className="text-blue-400" size={24}/>
                    <div className="flex-1">
                       <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Nota Final</label>
                       <input 
                        type="text" placeholder="Ex: 9.5" 
                        className="bg-transparent border-none outline-none font-black text-white w-full text-lg"
                        value={notaAluno} onChange={e => setNotaAluno(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* BOTÃO SALVAR */}
                  <button 
                    onClick={handleAprovar} 
                    disabled={salvando || !feedbackEditado}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-3xl shadow-xl transition-all flex justify-center items-center gap-3 text-xl active:scale-95 disabled:opacity-50"
                  >
                    {salvando ? <RefreshCw className="animate-spin" size={28}/> : <CheckCircle size={28}/>}
                    {salvando ? 'Salvando...' : 'Concluir Feedback'}
                  </button>

                  {/* BOTÃO COPIAR (SÓ APARECE SE JÁ TIVER TEXTO) */}
                  {feedbackEditado && (
                    <button 
                      onClick={() => { navigator.clipboard.writeText(feedbackEditado); setCopiado(true); setTimeout(()=>setCopiado(false), 2000); }}
                      className="w-full bg-slate-800 text-slate-300 font-black py-4 rounded-2xl text-sm flex justify-center items-center gap-2 hover:bg-slate-700 transition-colors"
                    >
                      <Copy size={18}/> {copiado ? 'Texto Copiado!' : 'Copiar para Área de Transferência'}
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
