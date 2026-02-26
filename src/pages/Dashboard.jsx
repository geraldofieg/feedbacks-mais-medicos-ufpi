import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusCircle, ClipboardList, Users, Settings, LogOut, 
  CheckCircle, Clock, Calendar, ChevronRight, AlertTriangle, Send, CheckCheck, Sparkles
} from 'lucide-react';

// === A REGRA DE OURO DA FILTRAGEM ===
export const isModuloValido = (nome) => {
  if (!nome) return false;
  const lower = nome.toLowerCase();
  if (lower.includes('recupera')) return false; // Elimina módulos de recuperação
  const match = lower.match(/\d+/);
  if (match && parseInt(match[0], 10) < 7) return false; // Elimina Módulo 1 ao 6
  return true; // Aceita Módulo 7+, ou qualquer outro nome sem número que surja no futuro
};

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ revisao: 0, postar: 0, finalizados: 0 });
  const [iaStats, setIaStats] = useState({ total: 0, originais: 0, taxa: 0 });
  const [ultimaData, setUltimaData] = useState(null);
  
  // Estados para calcular Pendências da Patrícia
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendenciasPat, setPendenciasPat] = useState([]);

  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  useEffect(() => {
    // Busca os alunos (Necessário para a Patrícia cruzar dados de pendências)
    const unsubAlunos = onSnapshot(collection(db, 'alunos'), (snap) => {
      setAlunosAtivos(snap.docs.map(d => d.data().nome));
    });

    const unsubAtividades = onSnapshot(collection(db, 'atividades'), (snap) => {
      const docs = snap.docs.map(doc => doc.data());
      
      const aprovados = docs.filter(d => d.status === 'aprovado');
      setStats({
        revisao: docs.filter(d => d.status === 'pendente').length,
        postar: aprovados.filter(d => !d.postado).length,
        finalizados: aprovados.filter(d => d.postado === true).length
      });

      const originais = aprovados.filter(d => d.feedbackFinal?.trim() === d.feedbackSugerido?.trim()).length;
      const taxa = aprovados.length > 0 ? Math.round((originais / aprovados.length) * 100) : 0;
      setIaStats({ total: aprovados.length, originais, taxa });

      // === CÁLCULO DE PENDÊNCIAS PARA GESTÃO À VISTA (PATRÍCIA) ===
      if (!isAdmin && alunosAtivos.length > 0) {
        const validAtiv = docs.filter(a => isModuloValido(a.modulo));
        const entregas = new Set(validAtiv.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));
        
        // Agrupa por módulo para descobrir a data mais recente
        const modulosMap = {};
        validAtiv.forEach(a => {
          if(!modulosMap[a.modulo]) modulosMap[a.modulo] = { nome: a.modulo, data: 0, tarefas: new Set() };
          if(a.dataCriacao?.seconds > modulosMap[a.modulo].data) modulosMap[a.modulo].data = a.dataCriacao.seconds;
          modulosMap[a.modulo].tarefas.add(a.tarefa);
        });

        // Ordena módulos do mais recente pro mais antigo
        const listaMod = Object.values(modulosMap).sort((a,b) => b.data - a.data);
        
        const resultado = [];
        listaMod.forEach(mod => {
          mod.tarefas.forEach(tar => {
            const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${mod.nome}-${tar}`));
            if(devedores.length > 0) resultado.push({ modulo: mod.nome, tarefa: tar, devedores });
          });
        });
        setPendenciasPat(resultado);
      }
    });

    const qUltima = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'), limit(1));
    const unsubUltima = onSnapshot(qUltima, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data().dataCriacao?.toDate();
        if (data) setUltimaData(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit',
