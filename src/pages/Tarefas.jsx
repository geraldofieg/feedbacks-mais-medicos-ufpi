import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Plus, Search, Pencil, Trash2, Calendar, StickyNote, GraduationCap, ArrowRight, Check, X, Clock } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

const ordenarTarefas = (lista) => {
  return [...lista].sort((a, b) => {
    const timeA = a.dataFim?.toMillis ? a.dataFim.toMillis() : 0;
    const timeB = b.dataFim?.toMillis ? b.dataFim.toMillis() : 0;

    if (timeA === 0 && timeB !== 0) return 1; 
    if (timeA !== 0 && timeB === 0) return -1; 
    if (timeA !== 0 && timeB !== 0) return timeA - timeB; 

    const criaA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
    const criaB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
    return criaB - criaA;
  });
};

export default function Tarefas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [alunosTurma, setAlunosTurma] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });

  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', enunciado: '', dataInicio: '', horaInicio: '', dataFim: '', horaFim: '', tipo: 'entrega' });
  const [atribuicaoEspecifica, setAtribuicaoEspecifica] = useState(false); 
  const [alunosSelecionados, setAlunosSelecionados] = useState([]); 
  const [salvando, setSalvando] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sucessoMsg, setSucessoMsg] = useState('');
  const tituloInputRef = useRef(null);

  const [editandoId, setEditandoId] = useState(null);
  const [tituloEdicao, setTituloEdicao] = useState('');
  const [enunciadoEdicao, setEnunciadoEdicao] = useState('');
  const [dataInicioEdicao, setDataInicioEdicao] = useState('');
  const [horaInicioEdicao, setHoraInicioEdicao] = useState('');
  const [dataFimEdicao, setDataFimEdicao] = useState('');
  const [horaFimEdicao, setHoraFimEdicao] = useState('');
  const [tipoEdicao, setTipoEdicao] = useState('entrega');

  useEffect(() => {
    if (location.state?.novoRegistro || location.state?.abrirModal) {
      setIsModalOpen(true);
      const stateCopy = { ...location.state };
      delete stateCopy.novoRegistro;
      delete stateCopy.abrirModal;
      window.history.replaceState(stateCopy, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state, turmaAtiva]);

  useEffect(() => {
    if (turmaAtiva) localStorage.setItem('ultimaTurmaAtiva', turmaAtiva);
  }, [turmaAtiva]);

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        
        const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
        const isValid = turmasData.some(t => t.id === targetTurma);
        
        if (isValid) {
          if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
        } else if (turmasData.length > 0) {
          setTurmaAtiva(turmasData[0].id);
        }
      } catch (error) { console.error("Erro fetch turmas:", error); }
    }
    fetchTurmas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, escolaSelecionada]);

  useEffect(() => {
    async function fetchDadosTurma() {
      if (!turmaAtiva) { setTarefas([]); setAlunosTurma([]); setLoading(false); return; }
      setLoading(true);
      try {
        const qT = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id), where('turmaId', '==', turmaAtiva));
        const snapT = await getDocs(qT);
