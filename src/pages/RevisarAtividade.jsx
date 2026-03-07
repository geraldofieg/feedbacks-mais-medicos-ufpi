import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User, Copy, Trash2, CheckCheck, Send, RotateCcw, Sparkles, Edit3, CalendarDays, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function RevisarAtividade() {
  const { id } = useParams(); // Na V3, este ID é o da TAREFA (Entrega)
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [atividadesMap, setAtividadesMap] = useState({});
  const [alunoAtualIndex, setAlunoAtualIndex] = useState(0);
  
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);

  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  // 1. CARREGA A TAREFA, OS ALUNOS DA TURMA E AS ATIVIDADES
  useEffect(() => {
    async function buscarDadosDaEstacao() {
      setLoading(true);
      try {
        // Busca a Tarefa
        const snapTarefa = await getDoc(doc(db, 'tarefas', id));
        if (!snapTarefa.exists()) {
          setTarefa(null); setLoading(false); return;
        }
        const dadosTarefa = { id: snapTarefa.id, ...snapTarefa.data() };
        setTarefa(dadosTarefa);

        // Busca os Alunos daquela Turma
        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', dadosTarefa.turmaId));
        const snapAlunos = await getDocs(qAlunos);
        const listaAlunos = snapAlunos.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => a.status !== 'lixeira')
          .sort((a, b) => a.nome.localeCompare(b.nome));
        setAlunos(listaAlunos);

        // Busca TODAS as submissões (atividades) para essa Tarefa
        const qAtividades = query(collection(db, 'atividades'), where('tarefaId', '==', id));
        const snapAtividades = await getDocs(qAtividades);
        const mapa = {};
        snapAtividades.docs.forEach(d => {
          const data = d.data();
          mapa[data.alunoId] = { id: d.id, ...data };
        });
        setAtividadesMap(mapa);

      } catch (error) { console.error("Erro ao montar estação:", error); } 
      finally { setLoading(false); }
    }
    buscarDadosDaEstacao();
  }, [id]);

  // 2. ATUALIZA O FEEDBACK SEMPRE QUE MUDAR DE ALUNO
  const alunoAtual = alunos[alunoAtualIndex];
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  useEffect(() => {
    // Reseta botões
    setSalvando(false); setMarcandoPostado(false); setExcluindo(false); setSalvandoAcao(false); setCopiado(false);
    // Carrega o feedback da atividade atual
    setFeedbackEditado(atividadeAtual?.feedbackSugerido || '');
  }, [alunoAtualIndex, atividadeAtual]);

  // NAVEGAÇÃO DE ALUNOS
  const irParaProximo = () => { if (alunoAtualIndex < alunos.length - 1) setAlunoAtualIndex(prev => prev + 1); };
  const irParaAnterior = () => { if (alunoAtualIndex > 0) setAlunoAtualIndex(prev => prev - 1); };

  // ==========================================
  // FUNÇÕES DE AÇÃO DA V1 (Adaptadas para V3)
  // ==========================================
  async function handleAprovar() {
    if (salvando || !atividadeAtual) return;
    setSalvando(true);
    try {
      const docRef = doc(db, 'atividades', atividadeAtual.id);
      await updateDoc(docRef, { feedbackFinal: feedbackEditado, status: 'aprovado', postado: false, dataAprovacao: new Date() });
      
      // Atualiza o estado local para não precisar recarregar a página
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], feedbackFinal: feedbackEditado, status: 'aprovado', postado: false, dataAprovacao: new Date() } }));
      
      // Magia: Avança automaticamente para o próximo aluno
      if (alunoAtualIndex < alunos.length - 1) irParaProximo();
      else alert("Todos os alunos revisados!");
      
    } catch (error) { alert("Erro ao salvar."); } 
    finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: new Date() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true, dataPostagem: new Date() } }));
      if (alunoAtualIndex < alunos.length - 1) irParaProximo();
    } catch (error) { alert("Erro ao marcar."); } 
    finally { setMarcandoPostado(false); }
  }

  async function handleExcluir() {
    if (excluindo || !atividadeAtual) return;
    if (window.confirm("Atenção: Tem certeza que deseja excluir esta resposta?")) {
      setExcluindo(true);
      try { 
        await deleteDoc(doc(db, 'atividades', atividadeAtual.id)); 
        const novoMapa = { ...atividadesMap };
        delete novoMapa[alunoAtual.id];
        setAtividadesMap(novoMapa);
      } catch (error) { alert("Erro ao excluir."); } 
      finally { setExcluindo(false); }
    }
  }

  function handleCopiar() {
    if (!atividadeAtual) return;
    navigator.clipboard.writeText(atividadeAtual.feedbackFinal || atividadeAtual.feedbackSugerido);
    setCopiado(true); setTimeout(() => setCopiado(false), 2000);
  }

  async function handleReverterPostagem() {
    if (salvandoAcao || !atividadeAtual) return;
    if (window.confirm("Desfazer postagem?")) {
      setSalvandoAcao(true);
      try { 
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: false, dataPostagem: null });
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: false, dataPostagem: null } }));
      } catch (error) { alert("Erro ao reverter."); } 
      finally { setSalvandoAcao(false); }
    }
  }

  async function handleReverterRevisao() {
    if (salvandoAcao || !atividadeAtual) return;
    if (window.confirm("Devolver para Revisão?")) {
      setSalvandoAcao(true);
      try { 
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), { status: 'pendente', postado: false, dataAprovacao: null, dataPostagem: null });
        setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], status: 'pendente', postado: false, dataAprovacao: null, dataPostagem: null } }));
      } catch (error) { alert("Erro ao reverter."); } 
      finally { setSalvandoAcao(false); }
    }
  }

  const formatarData = (ts) => {
    if (!ts) return null;
    const dataObj = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return dataObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ESTADOS DE CARREGAMENTO
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div></div>;
  if (!tarefa) return <div className="text-center p-10 font-bold text-gray-500">Tarefa não encontrada ou apagada.</div>;
  if (alunos.length === 0) return <div className="text-center p-10 font-bold text-gray-500">Nenhum aluno cadastrado nesta turma.</div>;

  // STATUS DA ATIVIDADE ATUAL
  const isEnviado = !!atividadeAtual;
  const isPendente = isEnviado && (!atividadeAtual.dataAprovacao || atividadeAtual.status === 'pendente');
  const isFaltaPostar = isEnviado && (!!atividadeAtual.dataAprovacao && !atividadeAtual.dataPostagem && atividadeAtual.status !== 'postado');
  const isFinalizado = isEnviado && (!!atividadeAtual.dataPostagem || atividadeAtual.status === 'postado');
  const foiEditado = isEnviado && atividadeAtual.feedbackFinal?.trim() !== atividadeAtual.feedbackSugerido?.trim();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-24">
      <div className="max-w-5xl mx-auto">
        
        {/* CABEÇALHO E CONTROLE DE NAVEGAÇÃO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-500 hover:text-blue-600 bg-white p-2 rounded-xl shadow-sm border border-gray-200"><ArrowLeft size={24} /></Link>
            <div>
              <Breadcrumb items={[{ label: 'Dashboard', path: '/' }, { label: 'Estação de Correção' }]} />
              <h2 className="text-xl md:text-2xl font-black text-gray-800 tracking-tight mt-1">{tarefa.nomeTarefa || tarefa.titulo}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200 self-start md:self-auto">
            <button onClick={irParaAnterior} disabled={alunoAtualIndex === 0} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronLeft size={20}/></button>
            <span className="font-bold text-sm text-gray-600 px-2 whitespace-nowrap">Aluno {alunoAtualIndex + 1} de {alunos.length}</span>
            <button onClick={irParaProximo} disabled={alunoAtualIndex === alunos.length - 1} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={20}/></button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LADO ESQUERDO: ENUNCIADO E RESPOSTA */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden">
              
              {/* STATUS BADGE ABSOLUTO */}
              <div className="absolute top-0 right-0">
                {!isEnviado ? (
                   <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-gray-100 text-gray-500 uppercase flex items-center gap-1 shadow-sm border-b border-l border-gray-200"><AlertCircle size={14}/> Sem Resposta</span>
                ) : isPendente ? (
                  <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-yellow-100 text-yellow-800 uppercase flex items-center gap-1 shadow-sm border-b border-l border-yellow-200">Aguardando Revisão</span>
                ) : isFaltaPostar ? (
                  <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-blue-100 text-blue-800 uppercase flex items-center gap-1 shadow-sm border-b border-l border-blue-200">Pronto p/ Postar</span>
                ) : (
                  <span className="px-4 py-1.5 rounded-bl-2xl text-xs font-black bg-green-100 text-green-800 uppercase flex items-center gap-1 shadow-sm border-b border-l border-green-200"><CheckCheck size={14}/> Finalizado</span>
                )}
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
                {tarefa.enunciado ? (
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">{tarefa.enunciado}</p>
                ) : (
                   <p className="text-gray-400 text-sm italic">Nenhum enunciado cadastrado para esta tarefa.</p>
                )}
                {tarefa.urlEnunciado && <a href={tarefa.urlEnunciado} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-blue-100 border border-blue-200"><FileText size={20} /> Ver Arquivo <ExternalLink size={16} /></a>}
              </div>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">2. Resposta do Aluno</h4>
                {!isEnviado ? (
                  <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 text-center">
                    <AlertCircle className="mx-auto text-gray-300 mb-2" size={32}/>
                    <p className="text-gray-500 font-medium">O aluno ainda não possui uma resposta/atividade vinculada a esta tarefa.</p>
                  </div>
                ) : (
                  <>
                    {atividadeAtual.resposta && <p className="text-gray-800 bg-green-50 p-4 rounded-xl text-sm border border-green-100 font-medium whitespace-pre-wrap">{atividadeAtual.resposta}</p>}
                    {atividadeAtual.urlResposta && <a href={atividadeAtual.urlResposta} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg font-bold text-sm hover:bg-green-100 border border-green-200"><FileText size={20} /> Ver Arquivo <ExternalLink size={16} /></a>}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* LADO DIREITO: ÁREA DE TRABALHO (FEEDBACK) */}
          <div className="lg:col-span-1 space-y-4">
            
            {!isEnviado ? (
              <div className="bg-gray-100 p-6 rounded-2xl border border-gray-200 text-center shadow-inner">
                <Clock className="mx-auto text-gray-400 mb-3" size={40}/>
                <h3 className="font-bold text-gray-600 mb-2">Ação Indisponível</h3>
                <p className="text-sm text-gray-500">Aguarde o aluno enviar a resposta para gerar e revisar o feedback.</p>
              </div>
            ) : isPendente ? (
              <div className="bg-blue-600 p-6 rounded-2xl shadow-md text-white animate-in fade-in duration-300">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-blue-500 pb-2"><CheckCircle size={20} />3. Aprovar Feedback</h3>
                <textarea rows="8" className="w-full p-4 rounded-xl text-gray-800 font-medium mb-4 shadow-inner outline-none focus:ring-4 focus:ring-blue-300" value={feedbackEditado} onChange={(e) => setFeedbackEditado(e.target.value)}></textarea>
                <button onClick={handleAprovar} disabled={salvando} className="w-full bg-white text-blue-700 font-black text-lg py-4 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2">
                  {salvando ? 'Salvando...' : 'Aprovar e Avançar'} <ChevronRight size={20}/>
                </button>
              </div>
            ) : (
              <div className="bg-gray-800 p-6 rounded-2xl shadow-md text-white animate-in fade-in duration-300">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2 border-b border-gray-600 pb-2">
                  <CheckCircle size={20} />Aprovado
                  {foiEditado ? (
                    <span className="ml-auto text-[10px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full flex items-center gap-1"><Edit3 size={12}/> Editado</span>
                  ) : (
                    <span className="ml-auto text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={12}/> 100% IA</span>
                  )}
                </h3>

                <div className="bg-white text-gray-800 p-4 rounded-xl text-sm mb-4 min-h-[150px] whitespace-pre-wrap font-medium shadow-inner">
                  {atividadeAtual.feedbackFinal || atividadeAtual.feedbackSugerido}
                </div>
                
                <button onClick={handleCopiar} className="w-full bg-white text-gray-800 font-black text-lg py-4 rounded-xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2 mb-4">
                  <Copy size={24} /> {copiado ? 'Texto Copiado!' : 'Copiar Feedback'}
                </button>

                {isAdmin && isFaltaPostar && (
                  <button onClick={handleMarcarPostado} disabled={marcandoPostado} className="w-full bg-blue-600 text-white font-black text-md py-4 rounded-xl hover:bg-blue-700 transition-all border border-blue-500 flex justify-center items-center gap-2">
                    {marcandoPostado ? 'Salvando...' : <><Send size={20}/> Marcar como Postado</>}
                  </button>
                )}
                
                {isFinalizado && (
                  <div className="w-full bg-green-900 text-green-100 font-bold text-sm py-3 rounded-xl flex justify-center items-center gap-2 border border-green-700">
                    <CheckCheck size={18} /> Postado no Mais Médicos
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-700 space-y-2 text-xs text-gray-400 font-medium">
                  {atividadeAtual.dataAprovacao && (
                    <p className="flex items-center gap-2"><CalendarDays size={14}/> Revisado: {formatarData(atividadeAtual.dataAprovacao)}</p>
                  )}
                  {isFinalizado && atividadeAtual.dataPostagem && (
                    <p className="flex items-center gap-2 text-gray-300"><CalendarDays size={14}/> Postado: {formatarData(atividadeAtual.dataPostagem)}</p>
                  )}
                </div>
              </div>
            )}

            {/* BOTÕES ADMINISTRATIVOS */}
            {isAdmin && isEnviado && (
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 text-center border-b border-gray-100 pb-2">Controles Gerenciais</h4>
                
                {isFinalizado && (
                  <button onClick={handleReverterPostagem} disabled={salvandoAcao} className="w-full flex items-center justify-center gap-2 text-orange-600 hover:bg-orange-50 py-3 rounded-xl font-bold transition-colors text-sm disabled:opacity-50">
                    <RotateCcw size={18} /> Desfazer Postagem
                  </button>
                )}
                
                {!isPendente && (
                  <button onClick={handleReverterRevisao} disabled={salvandoAcao} className="w-full flex items-center justify-center gap-2 text-yellow-600 hover:bg-yellow-50 py-3 rounded-xl font-bold transition-colors text-sm disabled:opacity-50">
                    <RotateCcw size={18} /> Devolver p/ Revisão
                  </button>
                )}

                <button onClick={handleExcluir} disabled={excluindo} className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-3 rounded-xl font-bold transition-colors text-sm">
                  <Trash2 size={18} /> Excluir Resposta do Aluno
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
      }
