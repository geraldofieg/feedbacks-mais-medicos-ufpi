import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User, Copy, Trash2, CheckCheck, Send, RotateCcw, Sparkles, Edit3, CalendarDays, AlertCircle, Clock, GraduationCap, Search, Bot } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';
import { GoogleGenerativeAI } from '@google/generative-ai'; // INJEÇÃO DA BIBLIOTECA DA IA

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const { currentUser, userProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [atividadesMap, setAtividadesMap] = useState({});
  
  // NOVO: A Mira a Laser (Substitui o Index de Próximo/Anterior)
  const [alunoSelecionadoId, setAlunoSelecionadoId] = useState('');
  
  // ESTADOS DO "PROFESSOR DIGITADOR"
  const [novaResposta, setNovaResposta] = useState('');
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [notaAluno, setNotaAluno] = useState(''); 
  
  // ESTADOS DE AÇÃO
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false); // NOVO: Estado de carregamento da IA

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

  // NOVO: Identifica quem é o aluno selecionado no Dropdown
  const alunoAtual = alunoSelecionadoId ? alunos.find(a => a.id === alunoSelecionadoId) : null;
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  // RECARREGA OS CAMPOS SEMPRE QUE MUDAR DE ALUNO
  useEffect(() => {
    setSalvando(false); setMarcandoPostado(false); setExcluindo(false); setSalvandoAcao(false); setCopiado(false); setGerandoIA(false);
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
  }, [alunoSelecionadoId, atividadeAtual]);

  // =========================================================================
  // MOTOR DA INTELIGÊNCIA ARTIFICIAL (GEMINI - API REAL)
  // =========================================================================
  async function handleGerarIA() {
    if (!novaResposta.trim()) {
      alert("Por favor, cole a resposta do aluno primeiro!");
      return;
    }
    setGerandoIA(true);

    try {
      // 1. Puxa a chave direto do cofre da Vercel
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        alert("Chave da API não encontrada na Vercel!");
        setGerandoIA(false);
        return;
      }

      // 2. Inicializa o Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // 3. Prepara os Ingredientes
      const promptDoProfessor = userProfile?.promptPersonalizado || "Você é um professor corrigindo uma atividade. Seja direto, didático e construtivo.";
      const enunciadoBase = tarefa?.enunciado || "Tarefa sem enunciado específico fornecido.";
      const respostaDoAluno = novaResposta;

      // 4. Monta o Super Prompt
      const promptCompleto = `
        Aja como um professor. Siga RIGOROSAMENTE as seguintes instruções de personalidade e tom de voz:
        "${promptDoProfessor}"

        Contexto da Tarefa (O que foi pedido ao aluno):
        "${enunciadoBase}"

        Resposta enviada pelo aluno:
        "${respostaDoAluno}"

        Com base no contexto da tarefa e na resposta do aluno, gere um feedback de avaliação direcionado diretamente ao aluno.
      `;

      // 5. Envia o pedido para o Google e aguarda a mágica
      const result = await model.generateContent(promptCompleto);
      const textoGeradoPelaIA = result.response.text();

      // 6. Joga o texto pronto na tela
      setFeedbackEditado(textoGeradoPelaIA);

    } catch (error) {
      console.error("Erro ao gerar IA:", error);
      alert("Ops! A IA falhou. O limite gratuito pode ter estourado ou houve erro na chave.");
    } finally {
      setGerandoIA(false);
    }
  }
  // =========================================================================

  async function handleAprovar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        feedbackSugerido: atividadeAtual?.feedbackSugerido || feedbackEditado.trim(), // Salva a origem pra fazer a conta do termômetro depois
        feedbackFinal: feedbackEditado.trim(), 
        nota: notaAluno.trim() || null, 
        status: 'aprovado', 
        postado: false, 
        dataAprovacao: new Date() 
      };

      if (atividadeAtual) {
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ 
          ...prev, 
          [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } 
        }));
      } else {
        const novaAtiv = {
          alunoId: alunoAtual.id,
          turmaId: tarefa.turmaId,
          instituicaoId: tarefa.instituicaoId,
          tarefaId: tarefa.id,
          dataCriacao: new Date(),
          ...payload
        };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ 
          ...prev, 
          [alunoAtual.id]: { id: docRef.id, ...novaAtiv } 
        }));
      }
      
    } catch (error) { alert("Erro ao salvar."); console.error(error); } finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: new Date() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true, dataPostagem: new Date() } }));
    } catch (error) { alert("Erro ao marcar."); } finally { setMarcandoPostado(false); }
  }

  async function handleExcluir() {
    if (excluindo || !atividadeAtual) return;
    if (window.confirm("Atenção: Excluir todos os registros deste aluno nesta tarefa?")) {
      setExcluindo(true);
      try { await deleteDoc(doc(db, 'atividades', atividadeAtual.id)); const novoMapa = { ...atividadesMap }; delete novoMapa[alunoAtual.id]; setAtividadesMap(novoMapa); } 
      catch (error) { alert("Erro ao excluir."); } finally { setExcluindo(false); }
    }
  }

  function handleCopiar() {
    if (!atividadeAtual) return;
    const textoCopia = atividadeAtual.nota 
      ? `Nota: ${atividadeAtual.nota}\n\n${atividadeAtual.feedbackFinal || atividadeAtual.feedbackSugerido}`
      : atividadeAtual.feedbackFinal || atividadeAtual.feedbackSugerido;
      
    navigator.clipboard.writeText(textoCopia);
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  }

  async function handleReverterPostagem() {
    if (salvandoAcao || !atividadeAtual) return;
    if (window.confirm("Desfazer lançamento no sistema oficial?")) { setSalvandoAcao(true); try { await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: false, dataPostagem: null }); setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: false, dataPostagem: null } })); } catch (error) { alert("Erro ao reverter."); } finally { setSalvandoAcao(false); } }
  }

  async function handleReverterRevisao() {
    if (salvandoAcao || !atividadeAtual) return;
    if (window.confirm("Devolver para Revisão (Editar)?")) { setSalvandoAcao(true); try { await updateDoc(doc(db, 'atividades', atividadeAtual.id), { status: 'pendente', postado: false, dataAprovacao: null, dataPostagem: null }); setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], status: 'pendente', postado: false, dataAprovacao: null, dataPostagem: null } })); } catch (error) { alert("Erro ao reverter."); } finally { setSalvandoAcao(false); } }
  }

  const formatarData = (ts) => {
    if (!ts) return null;
    try {
      let d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts)));
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch(e) { return null; }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div></div>;
  if (!tarefa) return <div className="text-center p-10 font-bold text-gray-500">Tarefa não encontrada ou apagada.</div>;
  if (alunos.length === 0) return <div className="text-center p-10 font-bold text-gray-500">Nenhum aluno cadastrado nesta turma.</div>;

  const isEnviado = !!atividadeAtual;
  const isPendente = !isEnviado || (!atividadeAtual.dataAprovacao || atividadeAtual.status === 'pendente');
  const isFaltaPostar = isEnviado && (!!atividadeAtual.dataAprovacao && !atividadeAtual.dataPostagem && atividadeAtual.status !== 'postado');
  const isFinalizado = isEnviado && (!!atividadeAtual.dataPostagem || atividadeAtual.status === 'postado');
  const foiEditado = isEnviado && atividadeAtual.feedbackFinal?.trim() !== atividadeAtual.feedbackSugerido?.trim();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600 bg-white p-2 rounded-xl shadow-sm border border-gray-200"><ArrowLeft size={24} /></Link>
            <div>
              <Breadcrumb items={[{ label: 'Dashboard', path: '/' }, { label: 'Estação de Correção' }]} />
              <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight mt-1">{tarefa.nomeTarefa || tarefa.titulo}</h2>
            </div>
          </div>
          
          {/* O NOVO SELETOR (MIRA A LASER) */}
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-blue-200 w-full md:w-auto hover:border-blue-400 transition-colors">
            <Search size={18} className="text-blue-500 ml-2 shrink-0" />
            <select 
              className="bg-transparent font-bold text-gray-700 outline-none pr-4 py-1.5 w-full md:w-64 cursor-pointer"
              value={alunoSelecionadoId}
              onChange={(e) => setAlunoSelecionadoId(e.target.value)}
            >
              <option value="">Buscar Aluno da Turma...</option>
              {alunos.map(a => {
                const temRegistro = atividadesMap[a.id];
                const finalizado = temRegistro && (atividadesMap[a.id].status === 'aprovado' || atividadesMap[a.id].postado === true);
                return (
                  <option key={a.id} value={a.id}>
                    {finalizado ? '✅' : '🔴'} {a.nome}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* SE NÃO TEM ALUNO SELECIONADO, MOSTRA A TELA DE REPOUSO */}
        {!alunoAtual ? (
          <div className="bg-white p-12 rounded-3xl text-center border border-dashed border-gray-300 shadow-sm mt-10">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
              <User size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Pronto para Corrigir!</h3>
            <p className="text-gray-500 font-medium max-w-md mx-auto">
              Utilize o campo de busca no canto superior direito para selecionar o aluno que acabou de entregar a atividade no portal da sua Instituição.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0">
                  {!isEnviado ? ( <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-gray-100 text-gray-500 uppercase flex items-center gap-1 shadow-sm border-b border-l border-gray-200"><Clock size={14}/> Aguardando Preenchimento</span>
                  ) : isPendente ? ( <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-yellow-100 text-yellow-800 uppercase flex items-center gap-1 shadow-sm border-b border-l border-yellow-200">Aguardando Revisão</span>
                  ) : isFaltaPostar ? ( <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-blue-100 text-blue-800 uppercase flex items-center gap-1 shadow-sm border-b border-l border-blue-200">Pronto p/ Lançar</span>
                  ) : ( <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-green-100 text-green-800 uppercase flex items-center gap-1 shadow-sm border-b border-l border-green-200"><CheckCheck size={14}/> Finalizado</span> )}
                </div>
                <div className="flex items-center gap-3 mb-6 mt-2">
                  <div className={`p-3 rounded-full ${isEnviado ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}><User size={24} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{alunoAtual.nome}</h3>
                    <p className="text-sm font-bold text-gray-500">Matrícula: {alunoAtual.matricula || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">1. Enunciado / Observações</h4>
                  {tarefa.enunciado ? ( <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">{tarefa.enunciado}</p> ) : ( <p className="text-gray-400 text-sm italic">Nenhum enunciado cadastrado para esta tarefa.</p> )}
                  {tarefa.urlEnunciado && <a href={tarefa.urlEnunciado} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-blue-100 border border-blue-200"><FileText size={20} /> Ver Arquivo <ExternalLink size={16} /></a>}
                </div>
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">2. Resposta do Aluno</h4>
                  {isPendente ? (
                    <textarea
                      rows="6"
                      placeholder="Cole aqui a resposta do aluno (Opcional)..."
                      className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-800 bg-white shadow-inner"
                      value={novaResposta}
                      onChange={(e) => setNovaResposta(e.target.value)}
                    />
                  ) : (
                    <>
                      {atividadeAtual.resposta ? ( <p className="text-gray-800 bg-green-50 p-4 rounded-xl text-sm border border-green-100 font-medium whitespace-pre-wrap">{atividadeAtual.resposta}</p> ) : ( <p className="text-gray-400 text-sm italic">Nenhuma resposta inserida.</p> )}
                      {atividadeAtual.urlResposta && <a href={atividadeAtual.urlResposta} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-green-100 border border-green-200"><FileText size={20} /> Ver Arquivo <ExternalLink size={16} /></a>}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-1 space-y-4">
              {isPendente ? (
                <div className="bg-slate-900 p-6 rounded-2xl shadow-md text-white animate-in fade-in duration-300 flex flex-col h-full border border-slate-800">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                    <CheckCircle size={20} className="text-blue-400" />3. Avaliação e Feedback
                  </h3>
                  
                  {/* BOTÃO DA IA - SÓ PARA PREMIUM/ADMIN */}
                  {isPremium && (
                    <button 
                      onClick={handleGerarIA} 
                      disabled={gerandoIA || !novaResposta.trim()}
                      className={`w-full font-black py-4 rounded-xl mb-4 transition-all flex justify-center items-center gap-2 shadow-lg ${gerandoIA ? 'bg-indigo-800 text-indigo-300' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:grayscale'}`}
                    >
                      {gerandoIA ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Sparkles size={20} />}
                      {gerandoIA ? 'Analisando e Escrevendo...' : 'Gerar Feedback com IA'}
                    </button>
                  )}

                  <textarea 
                    rows="8" 
                    placeholder={isPremium ? "O feedback da IA aparecerá aqui..." : "Cole o feedback gerado ou digite manualmente (Opcional)..."} 
                    className="w-full flex-1 min-h-[150px] p-4 rounded-xl text-gray-800 font-medium mb-4 shadow-inner outline-none focus:ring-4 focus:ring-blue-300" 
                    value={feedbackEditado} 
                    onChange={(e) => setFeedbackEditado(e.target.value)}
                  ></textarea>
                  
                  <div className="bg-slate-800 p-3 rounded-xl mb-4 border border-slate-700 flex items-center gap-3">
                    <GraduationCap className="text-blue-400 shrink-0" size={24} />
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nota do Aluno (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: 9,5" 
                        className="w-full bg-slate-950 text-white border border-slate-600 font-bold px-3 py-2 rounded-lg outline-none focus:border-blue-500"
                        value={notaAluno}
                        onChange={(e) => setNotaAluno(e.target.value)}
                      />
                    </div>
                  </div>

                  <button onClick={handleAprovar} disabled={salvando} className="w-full bg-blue-600 text-white font-black text-lg py-4 rounded-xl hover:bg-blue-500 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2 border border-blue-500">
                    {salvando ? 'Salvando...' : 'Salvar Avaliação'}
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900 p-6 rounded-2xl shadow-md text-white animate-in fade-in duration-300 flex flex-col h-full border border-slate-800">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                    <CheckCircle size={20} className="text-green-400" />Aprovado
                    {foiEditado ? ( <span className="ml-auto text-[10px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full flex items-center gap-1"><Edit3 size={12}/> Editado</span> ) : ( <span className="ml-auto text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={12}/> 100% IA</span> )}
                  </h3>
                  
                  {atividadeAtual.nota && (
                    <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-xl mb-3 flex items-center gap-3">
                      <GraduationCap size={20} />
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">Nota Final</span>
                        <span className="font-black text-lg">{atividadeAtual.nota}</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-sm mb-4 min-h-[150px] whitespace-pre-wrap font-medium shadow-inner border border-slate-700">
                    {atividadeAtual.feedbackFinal || atividadeAtual.feedbackSugerido || <span className="italic text-slate-500">Nenhum feedback registrado.</span>}
                  </div>
                  
                  {(atividadeAtual.feedbackFinal || atividadeAtual.feedbackSugerido) && (
                    <button onClick={handleCopiar} className="w-full bg-white text-gray-900 font-black text-lg py-4 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2 mb-4">
                      <Copy size={24} /> {copiado ? 'Texto Copiado!' : 'Copiar Feedback'}
                    </button>
                  )}
                  
                  {isAdmin && isFaltaPostar && ( 
                    <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-blue-600 text-white font-black text-md py-4 rounded-xl hover:bg-blue-700 transition-all border border-blue-500 flex justify-center items-center gap-2 mb-4">
                      {marcandoPostado ? 'Salvando...' : <><Send size={20}/> Marcar como Lançado</>}
                    </button> 
                  )}
                  
                  {isFinalizado && ( 
                    <div className="w-full bg-green-900/40 text-green-300 font-bold text-sm py-3 rounded-xl flex justify-center items-center gap-2 border border-green-700 mb-4">
                      <CheckCheck size={18} /> Lançado no sistema oficial
                    </div> 
                  )}
                  
                  <div className="mt-auto pt-4">
                    {/* A VOLTA PARA A BASE: Limpa o seletor para buscar o próximo */}
                    <button onClick={() => setAlunoSelecionadoId('')} className="w-full bg-slate-700 text-white font-black text-md py-4 rounded-xl hover:bg-slate-600 transition-all flex justify-center items-center gap-2 border border-slate-600 shadow-md">
                      <Search size={20}/> Buscar Outro Aluno
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-700 space-y-2 text-xs text-slate-400 font-medium">
                    {atividadeAtual.dataAprovacao && ( <p className="flex items-center gap-2"><CalendarDays size={14}/> Revisado: {formatarData(atividadeAtual.dataAprovacao)}</p> )}
                    {isFinalizado && atividadeAtual.dataPostagem && ( <p className="flex items-center gap-2 text-slate-500"><CalendarDays size={14}/> Lançado: {formatarData(atividadeAtual.dataPostagem)}</p> )}
                  </div>
                </div>
              )}

              {isAdmin && isEnviado && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center border-b border-gray-100 pb-2">Controles Gerenciais</h4>
                  {isFinalizado && ( <button onClick={handleReverterPostagem} disabled={salvandoAcao} className="w-full flex items-center justify-center gap-2 text-orange-600 hover:bg-orange-50 py-3 rounded-xl font-bold transition-colors text-sm disabled:opacity-50"><RotateCcw size={18} /> Desfazer Lançamento</button> )}
                  {!isPendente && ( <button onClick={handleReverterRevisao} disabled={salvandoAcao} className="w-full flex items-center justify-center gap-2 text-yellow-600 hover:bg-yellow-50 py-3 rounded-xl font-bold transition-colors text-sm disabled:opacity-50"><RotateCcw size={18} /> Devolver p/ Revisão</button> )}
                  <button onClick={handleExcluir} disabled={excluindo} className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-3 rounded-xl font-bold transition-colors text-sm"><Trash2 size={18} /> Excluir Resposta do Aluno</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
