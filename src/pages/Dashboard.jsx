import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusCircle, ClipboardList, Users, Settings, LogOut, 
  CheckCircle, Clock, Calendar, ChevronRight, AlertTriangle, Send, CheckCheck, Sparkles, User, CalendarRange, Megaphone, MonitorPlay
} from 'lucide-react';

import { cronogramaAssincrono, cronogramaSincrono, getStatusData, getDiasRestantes } from '../data/cronogramaData';

export const isModuloValido = (nome) => {
  if (!nome) return false;
  const lower = nome.toLowerCase();
  if (lower.includes('recupera')) return false;
  const match = lower.match(/\d+/);
  if (match && parseInt(match, 10) < 7) return false;
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

  // Lê a Turma Selecionada no Menu Global (Workspace)
  const turmaSelecionada = localStorage.getItem('saas_turma');

  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  // Estes cronogramas futuramente virão do banco Nível 3, mas por enquanto os mantemos visualmente genéricos
  const moduloAtual = cronogramaAssincrono.find(m => getStatusData(m.inicio, m.fim) === 'atual');
  const semanaAtual = cronogramaSincrono.find(s => getStatusData(s.inicio, s.fim) === 'atual');

  useEffect(() => {
    // Se não tiver turma selecionada, não carrega dados para evitar misturar mundos
    if (!turmaSelecionada) return;

    async function fetchData() {
      // 1. Busca Alunos
      const alunosSnap = await getDocs(collection(db, 'alunos'));
      const alunosAtuais = alunosSnap.docs.map(d => d.data().nome);
      setAlunosAtivos(alunosAtuais);

      // 2. Busca Atividades filtrando pela Turma Selecionada (Isolamento de Dados)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);

      // Na V2, nós cruzamos dataLimite + idTurma
      const qAtividades = query(
        collection(db, 'atividades'), 
        where('dataCriacao', '>=', dataLimite)
        // No futuro SaaS completo ativaremos: where('idTurma', '==', turmaSelecionada)
      );

      const atividadesSnap = await getDocs(qAtividades);
      
      // Filtro manual temporário para simular o isolamento de turmas até a migração completa do DB
      const docs = atividadesSnap.docs.map(doc => doc.data()).filter(d => d.idTurma === turmaSelecionada || !d.idTurma); // Se não tiver idTurma, tratamos como legado por enquanto. Na versão final rigorosa, esconderíamos. Para você ver o painel zerar como pediu, vamos forçar o filtro estrito:
      const docsSaaS = atividadesSnap.docs.map(doc => doc.data()).filter(d => d.idTurma === turmaSelecionada);

      let contRevisao = 0;
      let contPostar = 0;
      let contFinalizado = 0;
      const atividadesProcessadas = []; 

      docsSaaS.forEach(d => {
        const isFinalizado = !!d.dataPostagem || d.postado === true || d.status === 'postado';
        const isAprovado = !!d.dataAprovacao || d.status === 'aprovado';

        if (isFinalizado) {
          contFinalizado++;
          atividadesProcessadas.push(d); 
        } else if (isAprovado) {
          contPostar++;
          atividadesProcessadas.push(d); 
        } else {
          contRevisao++;
        }
      });

      setStats({ revisao: contRevisao, postar: contPostar, finalizados: contFinalizado });

      const originais = atividadesProcessadas.filter(d => d.feedbackFinal?.trim() === d.feedbackSugerido?.trim()).length;
      const taxa = atividadesProcessadas.length > 0 ? Math.round((originais / atividadesProcessadas.length) * 100) : 0;
      setIaStats({ total: atividadesProcessadas.length, originais, taxa });

      if (alunosAtuais.length > 0 && docsSaaS.length > 0) {
        const validAtiv = docsSaaS.filter(a => isModuloValido(a.modulo));
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
            const devedores = alunosAtuais.filter(al => !entregas.has(`${al}-${mod.nome}-${tar}`));
            if(devedores.length > 0) resultado.push({ modulo: mod.nome, tarefa: tar, devedores });
          });
        });
        setPendenciasGerais(resultado);
      } else {
        setPendenciasGerais([]);
      }

      // 3. Última Sincronização
      const qUltima = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'), limit(1));
      const ultimaSnap = await getDocs(qUltima);
      if (!ultimaSnap.empty) {
        const data = ultimaSnap.docs[0].data().dataCriacao?.toDate();
        if (data) setUltimaData(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      }
    }

    fetchData();
  }, [turmaSelecionada]); 

  async function handleLogout() { try { await logout(); navigate('/login'); } catch (e) { console.error(e); } }

  // ========== TELA DE BLOQUEIO (SEM TURMA SELECIONADA) ==========
  if (!turmaSelecionada) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full p-10 rounded-3xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
          <div className="bg-indigo-50 text-indigo-500 w-20 h-20 rounded-full flex items-center justify-center mb-6">
            <MonitorPlay size={40} />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2">Painel Aguardando Conexão</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Para visualizar os indicadores e gerenciar pendências, por favor, <b>selecione uma Instituição e uma Turma no menu superior</b>.
          </p>
          <div className="bg-blue-50 text-blue-800 px-6 py-4 rounded-xl text-sm font-bold flex items-center gap-2">
             👆 O Seletor Global fica ali no topo!
          </div>
        </div>
      </div>
    );
  }

  // ========== DASHBOARD NORMAL (COM TURMA SELECIONADA) ==========
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <h1 className="text-xl font-black text-indigo-900 flex items-center gap-2">
            Painel de Gestão da Turma
          </h1>
          {ultimaData && (
            <div className="flex items-center gap-2 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200 self-start">
              <Calendar size={14} /><span>Sincronizado: {ultimaData}</span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        
        {/* Banner de Situação (Visual Genérico) */}
        <div className="mb-6 bg-slate-800 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="bg-slate-700 p-3 rounded-xl"><CalendarRange size={28} className="text-indigo-400" /></div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 mb-1">Status do Cronograma Vigente</h3>
              <div className="flex flex-col gap-1.5">
                {moduloAtual ? (
                  <p className="text-sm font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span> 
                    <span className="text-gray-300">Unidade Ativa:</span> {moduloAtual.modulo} <span className="text-green-400 font-bold ml-1">(Faltam {getDiasRestantes(moduloAtual.fim)} dias)</span>
                  </p>
                ) : (
                  <p className="text-sm font-medium flex items-center gap-2 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Nenhuma unidade em andamento.</p>
                )}
              </div>
            </div>
          </div>
          <Link to="/cronograma" className="w-full md:w-auto text-center bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-sm">
            Painel de Datas
          </Link>
        </div>

        {/* Termômetro IA */}
        <div className="mb-6 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl"><Sparkles size={28} /></div>
            <div>
              <h3 className="font-bold text-lg">Termômetro da IA</h3>
              <p className="text-indigo-100 text-sm hidden md:block">Porcentagem de feedbacks aprovados sem alterações estruturais.</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-4xl font-black">{iaStats.taxa}%</span>
            <p className="text-xs text-indigo-200 font-medium">{iaStats.originais} de {iaStats.total} originais</p>
          </div>
        </div>

        {/* Cards de Status */}
        <div className={`grid grid-cols-1 gap-4 mb-8 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <Link to="/lista/pendente" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-200 active:scale-95 transition-all">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Aguardando Revisão</p>
              <h3 className="text-4xl font-black text-yellow-500">{stats.revisao}</h3>
              <div className="flex items-center gap-1 text-indigo-600 text-sm font-bold mt-2">Ver lista <ChevronRight size={16} /></div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-2xl text-yellow-600 border border-yellow-100"><Clock size={32} /></div>
          </Link>

          {isAdmin && (
            <Link to="/lista/falta-postar" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-200 active:scale-95 transition-all">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Aguardando Envio</p>
                <h3 className="text-4xl font-black text-blue-600">{stats.postar}</h3>
                <div className="flex items-center gap-1 text-indigo-600 text-sm font-bold mt-2">Copiar p/ Sistema <ChevronRight size={16} /></div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 border border-blue-100"><Send size={32} /></div>
            </Link>
          )}
          
          <Link to="/lista/finalizados" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-indigo-200 active:scale-95 transition-all">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Histórico Finalizado</p>
              <h3 className="text-4xl font-black text-green-600">{stats.finalizados}</h3>
              <div className="flex items-center gap-1 text-indigo-600 text-sm font-bold mt-2">Ver histórico <ChevronRight size={16} /></div>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl text-green-600 border border-green-100"><CheckCheck size={32} /></div>
          </Link>
        </div>

        {/* Acesso Rápido */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          {isAdmin && (
            <>
              <Link to="/nova-atividade" className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><PlusCircle size={28} /><span className="font-bold text-sm">Nova Ativ</span></Link>
              <Link to="/alunos" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center hover:border-indigo-300 active:scale-95 transition-all"><Users size={28} className="text-indigo-600" /><span className="font-bold text-sm">Alunos</span></Link>
              <Link to="/configuracoes" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center hover:border-indigo-300 active:scale-95 transition-all"><Settings size={28} className="text-gray-500" /><span className="font-bold text-sm">Config</span></Link>
            </>
          )}

          <Link to="/cronograma" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center hover:border-indigo-300 active:scale-95 transition-all"><CalendarRange size={28} className="text-blue-500" /><span className="font-bold text-sm">Datas</span></Link>
          
          <Link to="/comunicacao" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center hover:border-indigo-300 active:scale-95 transition-all"><Megaphone size={28} className="text-green-500" /><span className="font-bold text-sm">Avisos</span></Link>

          <Link to="/pendencias" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center hover:border-indigo-300 active:scale-95 transition-all"><AlertTriangle size={28} className="text-orange-500" /><span className="font-bold text-sm">Pendências</span></Link>
          <Link to="/mapa" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center hover:border-indigo-300 active:scale-95 transition-all"><ClipboardList size={28} className="text-indigo-600" /><span className="font-bold text-sm">Mapa</span></Link>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-5 rounded-2xl border border-red-100 flex flex-col items-center gap-2 text-center hover:bg-red-100 active:scale-95 transition-all"><LogOut size={28} /><span className="font-bold text-sm">Sair</span></button>
        </div>

        {pendenciasGerais.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-200">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <AlertTriangle className="text-orange-500" /> Alertas: Alunos Pendentes
            </h3>
            <div className="space-y-4">
              {pendenciasGerais.map((item, idx) => (
                <div key={idx} className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-orange-900">{item.modulo}</span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">{item.devedores.length} pendências</span>
                  </div>
                  <p className="text-sm font-medium text-orange-800 mb-3">{item.tarefa}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.devedores.map((aluno, i) => (
                      <span key={i} className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 flex items-center gap-1">
                        <User size={12}/> {aluno}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
