import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, CheckCircle, FileText, ExternalLink, User, Copy, 
  Trash2, CheckCheck, Send, RotateCcw, Sparkles, Edit3, 
  CalendarDays, AlertCircle, Clock, GraduationCap, Search, RefreshCw 
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
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 
  const isPremium = userProfile?.plano === 'premium' || isAdmin;

  useEffect(() => {
    async function buscarDadosDaEstacao() {
      setLoading(true);
      try {
        const snapTarefa = await getDoc(doc(db, 'tarefas', id));
        if (!snapTarefa.exists()) { setTarefa(null); setLoading(false); return; }
        const dadosTarefa = { id: snapTarefa.id, ...snapTarefa.data() };
        setTarefa(dadosTarefa);

        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', dadosTarefa.turmaId));
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
  }, [id]);

  const alunoAtual = alunoSelecionadoId ? alunos.find(a => a.id === alunoSelecionadoId) : null;
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  useEffect(() => {
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
  }, [alunoSelecionadoId, atividadeAtual]);

  // =========================================================================
  // MOTOR DE IA TURBINADO (GEMINI 3.1 FLASH LITE + SEARCH)
  // =========================================================================
  async function handleGerarIA() {
    if (!novaResposta.trim()) return alert("Cole a resposta do aluno primeiro!");
    setGerandoIA(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key não configurada na Vercel.");

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // CONFIGURAÇÃO DO MODELO COM BUSCA (GROUNDING) ATIVA
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3.1-flash-lite-preview",
        tools: [{ googleSearch: {} }] // Ativa a busca no Google em tempo real
      });

      const promptDoProfessor = userProfile?.promptPersonalizado || "Seja um professor cordial e técnico.";
      const enunciadoBase = tarefa?.enunciado || "Tarefa sem enunciado específico.";

      const promptCompleto = `
        Você é um tutor de Medicina. Use sua capacidade de pesquisa para validar as informações.
        
        PERSONALIDADE/ESTILO: "${promptDoProfessor}"
        CONTEXTO DA ATIVIDADE: "${enunciadoBase}"
        RESPOSTA DO ALUNO: "${novaResposta}"

        MANDATOS:
        1. Analise se a conduta médica ou teoria está correta.
        2. Se houver erro técnico, explique de forma didática baseada em evidências.
        3. Responda DIRETAMENTE ao aluno.
        4. Não use introduções como "Aqui está sua análise".
      `;

      const result = await model.generateContent(promptCompleto);
      const textoGerado = result.response.text();
      setFeedbackEditado(textoGerado);

    } catch (error) {
      console.error("Erro IA:", error);
      alert("Houve um erro na geração. Verifique se a chave da API está correta.");
    } finally {
      setGerandoIA(false);
    }
  }

  // =========================================================================

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
      alert("Avaliação salva!");
    } catch (error) { console.error(error); } finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: serverTimestamp() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true, dataPostagem: serverTimestamp() } }));
    } catch (error) { console.error(error); } finally { setMarcandoPostado(false); }
  }

  const formatarData = (ts) => {
    if (!ts) return null;
    let d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('pt-BR');
  };

  if (loading) return <div className="p-20 text-center font-black text-gray-400 animate-pulse">Carregando Estação...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        
        {/* CABEÇALHO COM SELETOR MIRA A LASER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-blue-600 bg-white p-2 rounded-xl shadow-sm border border-gray-200"><ArrowLeft size={24} /></Link>
            <div>
              <Breadcrumb items={[{ label: 'Dashboard', path: '/' }, { label: 'Revisão' }]} />
              <h2 className="text-xl font-black text-gray-800 tracking-tight">{tarefa?.nomeTarefa}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-blue-200 w-full md:w-80">
            <Search size={18} className="text-blue-500 ml-2" />
            <select 
              className="bg-transparent font-bold text-gray-700 outline-none w-full py-1.5 cursor-pointer"
              value={alunoSelecionadoId}
              onChange={(e) => setAlunoSelecionadoId(e.target.value)}
            >
              <option value="">Buscar Aluno...</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>
                  {atividadesMap[a.id]?.status === 'aprovado' ? '✅' : '🔴'} {a.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!alunoAtual ? (
          <div className="bg-white p-20 rounded-3xl text-center border-2 border-dashed border-gray-200 shadow-sm">
            <User className="mx-auto text-gray-200 mb-4" size={64} />
            <h3 className="text-2xl font-black text-gray-400">Selecione um aluno para começar</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* COLUNA DA ESQUERDA: RESPOSTA */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={16} className="text-blue-500"/> Resposta do Aluno
                  </h4>
                  {atividadeAtual?.dataAprovacao && <span className="text-[10px] font-black bg-green-100 text-green-700 px-3 py-1 rounded-full uppercase">Aprovado</span>}
                </div>
                
                <textarea
                  rows="12"
                  placeholder="Cole aqui a resposta bruta do aluno..."
                  className="w-full p-5 rounded-2xl border-none bg-gray-50 text-gray-800 font-medium focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                  value={novaResposta}
                  onChange={(e) => setNovaResposta(e.target.value)}
                />
                
                {tarefa?.enunciado && (
                  <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                    <AlertCircle className="text-amber-500 shrink-0" size={20}/>
                    <p className="text-xs text-amber-800 font-bold leading-relaxed">
                      <span className="block mb-1 opacity-60 uppercase">Enunciado:</span>
                      {tarefa.enunciado}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA DA DIREITA: FEEDBACK IA */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white border border-slate-800 flex flex-col h-full sticky top-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="text-blue-400" size={18}/> Feedback IA
                  </h3>
                  {isPremium ? (
                    <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">PREMIUM</span>
                  ) : (
                    <span className="text-[10px] font-black bg-gray-700 text-gray-400 px-2 py-0.5 rounded">BÁSICO</span>
                  )}
                </div>

                {isPremium && (
                  <button 
                    onClick={handleGerarIA} 
                    disabled={gerandoIA || !novaResposta}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black py-4 rounded-2xl mb-6 shadow-lg transition-all flex justify-center items-center gap-2"
                  >
                    {gerandoIA ? <RefreshCw className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                    {gerandoIA ? 'Pesquisando e Escrevendo...' : 'Gerar com Gemini 3.1'}
                  </button>
                )}

                <textarea
                  placeholder="O feedback aparecerá aqui..."
                  className="w-full flex-1 bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30 resize-none mb-6 min-h-[250px]"
                  value={feedbackEditado}
                  onChange={e => setFeedbackEditado(e.target.value)}
                />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 bg-slate-800 p-3 rounded-2xl border border-slate-700">
                    <GraduationCap className="text-blue-400" size={20}/>
                    <input 
                      type="text" placeholder="Nota..." 
                      className="bg-transparent border-none outline-none font-black text-white w-full"
                      value={notaAluno} onChange={e => setNotaAluno(e.target.value)}
                    />
                  </div>

                  <button 
                    onClick={handleAprovar} 
                    disabled={salvando}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex justify-center items-center gap-2"
                  >
                    {salvando ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                    Salvar Avaliação
                  </button>

                  {isAdmin && atividadeAtual?.status === 'aprovado' && !atividadeAtual.postado && (
                    <button onClick={handleMarcarPostado} className="w-full bg-slate-700 text-white font-bold py-3 rounded-2xl text-xs flex justify-center items-center gap-2">
                      <Send size={14}/> Marcar como Lançado
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
