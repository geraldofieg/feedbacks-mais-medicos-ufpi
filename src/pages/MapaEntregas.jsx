import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Check, X, BookOpen, Users, FileText, RefreshCw, GraduationCap } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function MapaEntregas() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  
  // A MÁGICA DA MEMÓRIA: Verifica localStorage antes de ficar vazio
  const [turmaAtiva, setTurmaAtiva] = useState(() => {
    return location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || '';
  });
  
  const [alunos, setAlunos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [atividades, setAtividades] = useState([]);
  
  const [loadingTurmas, setLoadingTurmas] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);
  const [erro, setErro] = useState(null);

  // O ESPIÃO DE CLIQUES: Força a atualização se a URL trouxer uma turma nova
  useEffect(() => {
    if (location.state?.turmaIdSelecionada && location.state.turmaIdSelecionada !== turmaAtiva) {
      setTurmaAtiva(location.state.turmaIdSelecionada);
    }
  }, [location.state]);

  // SALVA NA MEMÓRIA: Toda vez que a turma ativa mudar, guarda no celular
  useEffect(() => {
    if (turmaAtiva) localStorage.setItem('ultimaTurmaAtiva', turmaAtiva);
  }, [turmaAtiva]);

  async function fetchTurmas() {
    if (!currentUser || !escolaSelecionada?.id) {
      setLoadingTurmas(false);
      return; 
    }
    setErro(null);
    setLoadingTurmas(true);
    try {
      const qT = query(collection(db, 'turmas'), 
        where('instituicaoId', '==', escolaSelecionada.id),
        where('professorUid', '==', currentUser.uid)
      );
      const snapT = await getDocs(qT);
      const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
      setTurmas(turmasData);
      
      // Verifica se a turma na memória ainda existe e pertence a essa instituição
      const targetTurma = location.state?.turmaIdSelecionada || localStorage.getItem('ultimaTurmaAtiva') || turmaAtiva;
      const isValid = turmasData.some(t => t.id === targetTurma);
      
      if (isValid) {
        if (targetTurma !== turmaAtiva) setTurmaAtiva(targetTurma);
      } else if (turmasData.length > 0) {
        setTurmaAtiva(turmasData[0].id); // Se não for válida, pega a primeira
      }
    } catch (error) {
      setErro("Falha de conexão com o banco de dados.");
    } finally {
      setLoadingTurmas(false);
    }
  }

  useEffect(() => { fetchTurmas(); }, [currentUser, escolaSelecionada]);

  useEffect(() => {
    async function fetchMatriz() {
      if (!turmaAtiva) {
        setAlunos([]); setTarefas([]); setAtividades([]); return;
      }
      setLoadingMatriz(true);
      try {
        const qAlunos = query(collection(db, 'alunos'), where('turmaId', '==', turmaAtiva));
        const snapAlunos = await getDocs(qAlunos);
        setAlunos(snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira').sort((a, b) => a.nome.localeCompare(b.nome)));

        const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAtiva));
        const snapTarefas = await getDocs(qTarefas);
        setTarefas(snapTarefas.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira').sort((a, b) => a.dataCriacao?.toMillis() - b.dataCriacao?.toMillis()));

        const qAtividades = query(collection(db, 'atividades'), where('turmaId', '==', turmaAtiva));
        const snapAtividades = await getDocs(qAtividades);
        setAtividades(snapAtividades.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Erro ao montar o mapa:", error);
      } finally {
        setLoadingMatriz(false);
      }
    }
    fetchMatriz();
  }, [turmaAtiva]);

  const verificarEntrega = (alunoId, tarefaId) => atividades.some(ativ => ativ.alunoId === alunoId && ativ.tarefaId === tarefaId);
  const getNomeTurmaAtiva = () => turmas.find(t => t.id === turmaAtiva)?.nome || '...';
  const isCarregando = loadingTurmas || loadingMatriz;
  
