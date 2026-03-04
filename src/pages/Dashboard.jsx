import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'; 
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusCircle, ClipboardList, Users, Settings, LogOut, 
  CheckCircle, Clock, Calendar, ChevronRight, AlertTriangle, Send, CheckCheck, Sparkles, User, CalendarRange, Megaphone
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

// Função auxiliar para extrair apenas o número do módulo com segurança
const extractNum = (nome) => {
  if (!nome) return 0;
  const match = nome.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ revisao: 0, postar: 0, finalizados: 0 });
  const [iaStats, setIaStats] = useState({ total: 0, originais: 0, taxa: 0 });
  const [ultimaData, setUltimaData] = useState(null);
  
  const [alunosAtivos, setAlunosAtivos] = useState([]);
  const [pendenciasGerais, setPendenciasGerais] = useState([]);
  const [numReferenciaAtual, setNumReferenciaAtual] = useState(0); 

  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'; 

  // Mantemos para exibir no painel azul superior
  const moduloAtualIndex = cronogramaAssincrono.findIndex(m => getStatusData(m.inicio, m.fim) === 'atual');
  const moduloAtual = moduloAtualIndex !== -1 ? cronogramaAssincrono[moduloAtualIndex] : null;
  const semanaAtual = cronogramaSincrono.find(s => getStatusData(s.inicio, s.fim) === 'atual');

  useEffect(() => {
    async function fetchData() {
      // 1. Ouvinte de Alunos
      const alunosSnap = await getDocs(collection(db, 'alunos'));
      const alunosAtuais = alunosSnap.docs.map(d => d.data().nome);
      setAlunosAtivos(alunosAtuais);

      // 2. Busca de atividades dos últimos 90 dias
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);
      const qAtividades = query(collection(db, 'atividades'), where('dataCriacao', '>=', dataLimite));
      const atividadesSnap = await getDocs(qAtividades);
      const docs = atividadesSnap.docs.map(doc => doc.data());

      // Busca na coleção de enunciados (caso exista) para garantir que acha o módulo recém-criado
      let enunciadosDocs = [];
      try {
        const enunciadosSnap = await getDocs(collection(db, 'enunciados'));
        enunciadosDocs = enunciadosSnap.docs.map(doc => doc.data());
      } catch (e) { console.log('Coleção de enunciados não encontrada, seguindo...'); }
      
      let contRevisao = 0; let contPostar = 0; let contFinalizado = 0;
      const atividadesProcessadas = []; 

      // 3. Descobre qual é o MAIOR módulo que a Patrícia já mexeu (em atividades ou enunciados)
      let maxNum = 0;

      docs.forEach(d => {
        if (isModuloValido(d.modulo)) {
          const num = extractNum(d.modulo);
          if (num > maxNum) maxNum = num;
        }

        const isFinalizado = !!d.dataPostagem || d.postado === true || d.status === 'postado';
        const isAprovado = !!d.dataAprovacao || d.status === 'aprovado';

        if (isFinalizado) { contFinalizado++; atividadesProcessadas.push(d); } 
        else if (isAprovado) { contPostar++; atividadesProcessadas.push(d); } 
        else { contRevisao++; }
      });

      enunciadosDocs.forEach(e => {
        if (isModuloValido(e.modulo)) {
          const num = extractNum(e.modulo);
          if (num > maxNum) maxNum = num;
        }
      });

      setStats({ revisao: contRevisao, postar: contPostar, finalizados: contFinalizado });

      const originais = atividadesProcessadas.filter(d => d.feedbackFinal?.trim() === d.feedbackSugerido?.trim()).length;
      const taxa = atividadesProcessadas.length > 0 ? Math.round((originais / atividadesProcessadas.length) * 100) : 0;
      setIaStats({ total: atividadesProcessadas.length, originais, taxa });

      // 4. A MÁGICA DE PENDÊNCIAS: Foco nos dois maiores módulos
      setNumReferenciaAtual(maxNum);
      const numsAlvo = [maxNum, maxNum - 1].filter(n => n >= 7); // Ex: Se max for 8, alvos = [8, 7]

      if (alunosAtuais.length > 0 && numsAlvo.length > 0) {
        // Registra tudo o que os alunos já entregaram
        const entregas = new Set();
        docs.forEach(a => {
          // Ignora documentos que são apenas o "Enunciado" genérico
          if (isModuloValido(a.modulo) && a.aluno && a.aluno.toLowerCase() !== 'enunciado') {
            const num = extractNum(a.modulo);
            entregas.add(`${a.aluno}-${num}-${a.tarefa}`);
          }
        });

        const resultado = [];

        // Monta a tela cruzando o Módulo alvo com o Cronograma Oficial
        numsAlvo.forEach(numAlvo => {
          const cronoMod = cronogramaAssincrono.find(m => extractNum(m.modulo) === numAlvo);
          // Fallback de segurança se o módulo não existir no cronograma
          const tarefasDoModulo = cronoMod?.tarefas || [`M${numAlvo < 10 ? '0'+numAlvo : numAlvo}-Desafio`, `M${numAlvo < 10 ? '0'+numAlvo : numAlvo}-Fórum`]; 
          const nomeModuloLabel = cronoMod ? cronoMod.modulo : `Módulo ${numAlvo}`;

          tarefasDoModulo.forEach(tar => {
            // Se o aluno NÃO está na lista de entregas desse módulo/tarefa, ele deve!
            const devedores = alunosAtuais.filter(al => !entregas.has(`${al}-${numAlvo}-${tar}`));
            if (devedores.length > 0) {
              resultado.push({ 
                modulo: nomeModuloLabel, 
                numeroModulo: numAlvo,
                tarefa: tar, 
                devedores 
              });
            }
          });
        });

        setPendenciasGerais(resultado);
      } else {
        setPendenciasGerais([]);
      }

      // 5. Última Sincronização
      const qUltima = query(collection(db, 'atividades'), orderBy('dataCriacao', 'desc'), limit(1));
      const ultimaSnap = await getDocs(qUltima);
      if (!ultimaSnap.empty) {
        const data = ultimaSnap.docs[0].data().dataCriacao?.toDate();
        if (data) setUltimaData(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
      }
    }

    fetchData();
  }, []); // Sem dependências complexas para evitar loops

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
          <Link to="/lista/pendente" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 active:scale-95 transition-all">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Aguardando Revisão</p>
              <h3 className="text-4xl font-black text-yellow-500">{stats.revisao}</h3>
              <div className="flex items-center gap-1 text-blue-600 text-sm font-bold mt-2">Ver lista <ChevronRight size={16} /></div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-2xl text-yellow-600 border border-yellow-100"><Clock size={32} /></div>
          </Link>

          {isAdmin && (
            <Link to="/lista/falta-postar" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 active:scale-95 transition-all">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Aguardando Postar</p>
                <h3 className="text-4xl font-black text-blue-600">{stats.postar}</h3>
                <div className="flex items-center gap-1 text-blue-600 text-sm font-bold mt-2">Copiar p/ Site <ChevronRight size={16} /></div>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 border border-blue-100"><Send size={32} /></div>
            </Link>
          )}
          
          <Link to="/lista/finalizados" className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 active:scale-95 transition-all">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Histórico Finalizado</p>
              <h3 className="text-4xl font-black text-green-600">{stats.finalizados}</h3>
              <div className="flex items-center gap-1 text-blue-600 text-sm font-bold mt-2">Ver histórico <ChevronRight size={16} /></div>
            </div>
            <div className="bg-green-50 p-4 rounded-2xl text-green-600 border border-green-100"><CheckCheck size={32} /></div>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          {isAdmin && (
            <>
              <Link to="/nova-atividade" className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><PlusCircle size={28} /><span className="font-bold text-sm">Nova Ativ</span></Link>
              <Link to="/alunos" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><Users size={28} className="text-blue-600" /><span className="font-bold text-sm">Alunos</span></Link>
              <Link to="/configuracoes" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><Settings size={28} className="text-gray-500" /><span className="font-bold text-sm">Config</span></Link>
            </>
          )}

          <Link to="/cronograma" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><CalendarRange size={28} className="text-blue-500" /><span className="font-bold text-sm">Cronograma</span></Link>
          
          <Link to="/comunicacao" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><Megaphone size={28} className="text-green-500" /><span className="font-bold text-sm">Comunicação</span></Link>

          <Link to="/pendencias" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><AlertTriangle size={28} className="text-orange-500" /><span className="font-bold text-sm">Pendências</span></Link>
          <Link to="/mapa" className="bg-white text-gray-700 p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><ClipboardList size={28} className="text-blue-600" /><span className="font-bold text-sm">Mapa</span></Link>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-5 rounded-2xl border border-red-100 flex flex-col items-center gap-2 text-center active:scale-95 transition-transform"><LogOut size={28} /><span className="font-bold text-sm">Sair</span></button>
        </div>

        {pendenciasGerais.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-200">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <AlertTriangle className="text-orange-500" /> Gestão à Vista: Foco Atual
            </h3>
            <div className="space-y-4">
              {pendenciasGerais.map((item, idx) => {
                const isAtual = item.numeroModulo === numReferenciaAtual;
                
                return (
                  <div key={idx} className={`p-4 rounded-xl border ${isAtual ? 'bg-orange-50/80 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold ${isAtual ? 'text-orange-900' : 'text-gray-700'}`}>
                        {item.modulo} {isAtual ? '(Atual)' : '(Anterior)'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAtual ? 'text-orange-600 bg-orange-100' : 'text-gray-600 bg-gray-200'}`}>
                        {item.devedores.length} pendências
                      </span>
                    </div>
                    <p className={`text-sm font-medium mb-3 ${isAtual ? 'text-orange-800' : 'text-gray-600'}`}>{item.tarefa}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.devedores.map((aluno, i) => (
                        <span key={i} className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded border border-gray-200 flex items-center gap-1">
                          <User size={12}/> {aluno}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
