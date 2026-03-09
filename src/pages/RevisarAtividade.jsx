import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle, FileText, ExternalLink, User, Copy, Trash2, CheckCheck, Send, RotateCcw, Sparkles, Edit3, CalendarDays, ChevronLeft, ChevronRight, AlertCircle, Clock, GraduationCap } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function RevisarAtividade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [tarefa, setTarefa] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [atividadesMap, setAtividadesMap] = useState({});
  const [alunoAtualIndex, setAlunoAtualIndex] = useState(0);
  
  // ESTADOS DO "PROFESSOR DIGITADOR"
  const [novaResposta, setNovaResposta] = useState('');
  const [feedbackEditado, setFeedbackEditado] = useState('');
  const [notaAluno, setNotaAluno] = useState(''); 
  
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const [marcandoPostado, setMarcandoPostado] = useState(false);

  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

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

  const alunoAtual = alunos[alunoAtualIndex];
  const atividadeAtual = alunoAtual ? atividadesMap[alunoAtual.id] : null;

  // RECARREGA OS CAMPOS SEMPRE QUE MUDAR DE ALUNO
  useEffect(() => {
    setSalvando(false); setMarcandoPostado(false); setExcluindo(false); setSalvandoAcao(false); setCopiado(false);
    setNovaResposta(atividadeAtual?.resposta || '');
    setFeedbackEditado(atividadeAtual?.feedbackFinal || atividadeAtual?.feedbackSugerido || '');
    setNotaAluno(atividadeAtual?.nota || '');
  }, [alunoAtualIndex, atividadeAtual]);

  const irParaProximo = () => { if (alunoAtualIndex < alunos.length - 1) setAlunoAtualIndex(prev => prev + 1); };
  const irParaAnterior = () => { if (alunoAtualIndex > 0) setAlunoAtualIndex(prev => prev - 1); };

  async function handleAprovar() {
    if (salvando) return;
    setSalvando(true);
    try {
      const payload = { 
        resposta: novaResposta.trim(),
        feedbackFinal: feedbackEditado.trim(), 
        nota: notaAluno.trim() || null, 
        status: 'aprovado', 
        postado: false, 
        dataAprovacao: new Date() 
      };

      if (atividadeAtual) {
        // ATUALIZAR ATIVIDADE EXISTENTE
        await updateDoc(doc(db, 'atividades', atividadeAtual.id), payload);
        setAtividadesMap(prev => ({ 
          ...prev, 
          [alunoAtual.id]: { ...prev[alunoAtual.id], ...payload } 
        }));
      } else {
        // CRIAR NOVA ATIVIDADE (A MÁGICA DO DIGITADOR)
        const novaAtiv = {
          alunoId: alunoAtual.id,
          turmaId: tarefa.turmaId,
          instituicaoId: tarefa.instituicaoId,
          tarefaId: tarefa.id,
          feedbackSugerido: '',
          dataCriacao: new Date(),
          ...payload
        };
        const docRef = await addDoc(collection(db, 'atividades'), novaAtiv);
        setAtividadesMap(prev => ({ 
          ...prev, 
          [alunoAtual.id]: { id: docRef.id, ...novaAtiv } 
        }));
      }
      
      if (alunoAtualIndex < alunos.length - 1) irParaProximo(); 
      else alert("Todos os alunos desta turma foram revisados!");
    } catch (error) { alert("Erro ao salvar."); console.error(error); } finally { setSalvando(false); }
  }

  async function handleMarcarPostado() {
    if (marcandoPostado || !atividadeAtual) return;
    setMarcandoPostado(true);
    try {
      await updateDoc(doc(db, 'atividades', atividadeAtual.id), { postado: true, dataPostagem: new Date() });
      setAtividadesMap(prev => ({ ...prev, [alunoAtual.id]: { ...prev[alunoAtual.id], postado: true, dataPostagem: new Date() } }));
      if (alunoAtualIndex < alunos.length - 1) irParaProximo();
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
