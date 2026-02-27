import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusCircle, ClipboardList, Users, Settings, LogOut, 
  CheckCircle, Clock, Calendar, ChevronRight, AlertTriangle, Send, CheckCheck, Sparkles, User, CalendarRange
} from 'lucide-react';

import { cronogramaAssincrono, cronogramaSincrono, getStatusData, getDiasRestantes } from '../data/cronogramaData';

export const isModuloValido = (nome) => {
  if (!nome) return false;
  const lower = nome.toLowerCase();
  if (lower.includes('recupera')) return false;
  const match = lower.match(/\d+/);
  if (match && parseInt(match[0], 10) < 7) return false;
  return true;
};

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ revisao: 0, postar: 0, finalizados: 0 });
  const [iaStats, setIaStats] = useState({ total: 0, originais: 0, taxa: 0 });
  const [ultimaData, setUltimaData] = useState(null);
  
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendenciasGerais, setPendenciasGerais] = useState([]);

  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  const moduloAtual = cronogramaAssincrono.find(m => getStatusData(m.inicio, m.fim) === 'atual');
  const semanaAtual = cronogramaSincrono.find(s => getStatusData(s.inicio, s.fim) === 'atual');

  useEffect(() => {
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

      if (alunosAtivos.length > 0) {
        const validAtiv = docs.filter(a => isModuloValido(a.modulo));
        const entregas = new Set(validAtiv.map(a => `${a.aluno}-${a.modulo}-${a.tarefa}`));
        
        const modulosMap = {};
        validAtiv.forEach(a => {
          if(!modulosMap[a.modulo]) modulosMap[a.modulo] = { nome: a.modulo, data: 0, tarefas: new Set() };
          if(a.dataCriacao?.seconds > modulosMap[a.modulo].data) modulosMap[a.modulo].data = a.dataCriacao.seconds;
          modulosMap[a.modulo].tarefas.add(a.tarefa);
        });

        const listaMod = Object.values(modulosMap).sort((a,b) => b.data - a.data);
        
        const resultado = [];
        listaMod.forEach(mod => {
          mod.tarefas.forEach(tar => {
            const devedores = alunosAtivos.filter(al => !entregas.has(`${al}-${mod.nome}-${tar}`));
            if(devedores.length > 0) resultado.push({ modulo: mod.nome, tarefa: tar, devedores });
          });
        });
        setPendenciasGerais(resultado);
      }
    });

    const qUltima = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'), limit(1));
    const unsubUltima = onSnapshot(qUltima, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data().dataCriacao?.toDate();
        if (data) setUltimaData(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      }
    });

    return () => { unsubAlunos(); unsubAtividades(); unsubUltima(); };
  }, [alunosAtivos]); 

  async function handleLogout() { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800">
            Mais Médicos UFPI <span className="text-xs text-blue-500 ml-2">{isAdmin ? '(Perfil Gestor)' : '(Perfil Professora)'}</span>
          </h1>
          {ultimaData && (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold border border-blue-100 self-start">
              <Calendar size={16} /><span>Sincronizado: {ultimaData}</span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        
        <div className="mb-6 bg-slate-800 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="bg-slate-700 p-3 rounded-xl"><CalendarRange size={28} className="text-blue-400" /></div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 mb-1">Ponto de Situação do Curso</h3>
              <div className="flex flex-col gap-1.5">
                {moduloAtual ? (
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span> 
                    <span className="text-gray-300">Assíncrono:</span> {moduloAtual.modulo} <span className="text-green-400 font-bold ml-1">(Faltam {getDiasRestantes(moduloAtual.fim)} dias)</span>
                  </p>
                ) : (
                  <p className="text-sm font-medium flex items-center gap-2 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Nenhum módulo assíncrono em andamento.</p>
                )}
                
                {semanaAtual ? (
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span> 
                    <span className="text-gray-300">Síncrono:</span> Semana {semanaAtual.semana} <span className="text-purple-400 font-bold ml-1">(Faltam {getDiasRestantes(semanaAtual.fim)} dias)</span>
                  </p>
                ) : (
                  <p className="text-sm font-medium flex items-center gap-2 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Nenhuma semana síncrona em andamento.</p>
                )}
              </div>
            </div>
          </div>
          <Link to="/cronograma" className="w-full md:w-auto text-center bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
            Ver Cronograma Completo
          </Link>
        </div>

        <div className="mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl"><Sparkles size={28} /></div>
            <div>
              <h3 className="font-bold text-lg">Termômetro da IA</h3>
              <p className="text-purple-100 text-sm hidden md:block">Porcentagem de feedbacks aprovados sem NENHUMA alteração.</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black">{iaStats.taxa}%</span>
            <p className="text-xs text-purple-200 font-medium">{iaStats.originais} de {iaStats.total} originais</p>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-4 mb-8 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <Link to="/lista/pendente" className="bg-white p-6 rounded-2xl shadow-sm border border-
