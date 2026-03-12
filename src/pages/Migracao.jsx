import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, CalendarDays } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

// DATAS CHUMBADAS DA V1 (Para injeção no Banco)
const cronogramaAssincrono = [
  { id: 1, modulo: "Módulo 1 - Políticas públicas", inicio: "2025-09-28", fim: "2025-10-11" },
  { id: 2, modulo: "Módulo 2 - Atenção Primária e ESF", inicio: "2025-10-13", fim: "2025-10-26" },
  { id: 3, modulo: "Módulo 3 - Princípios da MFC", inicio: "2025-10-27", fim: "2025-11-09" },
  { id: 4, modulo: "Módulo 4 - Abordagem clínica", inicio: "2025-11-10", fim: "2025-12-07" },
  { id: 5, modulo: "Módulo 5 - Gestão da clínica", inicio: "2025-12-08", fim: "2026-01-04" },
  { id: 6, modulo: "Módulo 6 - Abordagem familiar", inicio: "2026-01-05", fim: "2026-02-01" },
  { id: 7, modulo: "Módulo 7 - Abordagem comunitária", inicio: "2026-02-02", fim: "2026-03-01" },
  { id: 8, modulo: "Módulo 8 - Criança e adolescente", inicio: "2026-03-02", fim: "2026-03-29" },
  { id: 9, modulo: "Semana de retenção e correção", inicio: "2026-03-30", fim: "2026-04-12" },
  { id: 10, modulo: "Módulo 9 - Saúde da mulher", inicio: "2026-03-30", fim: "2026-04-26" },
  { id: 11, modulo: "Módulo 10 - Saúde do homem", inicio: "2026-04-27", fim: "2026-05-10" },
  { id: 12, modulo: "Módulo 11 - Saúde do idoso", inicio: "2026-05-11", fim: "2026-05-24" }
];

export default function Migracao() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turmaAlvo, setTurmaAlvo] = useState('');
  
  const [analise, setAnalise] = useState(null);
  const [status, setStatus] = useState('ocioso'); // ocioso, analisando, migrando, injeçãoDatas, concluido
  const [logs, setLogs] = useState([]);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    async function fetchTurmas() {
      if (!escolaSelecionada?.id) return;
      const q = isAdmin 
        ? query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id))
        : query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
      const snap = await getDocs(q);
      setTurmas(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira'));
    }
    fetchTurmas();
  }, [escolaSelecionada, isAdmin, currentUser]);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  // FUNÇÃO AUXILIAR PARA CRIAR DATAS SEGURAS DO FIREBASE
  const criarTimestampSeguro = (dataStr, isFim = false) => {
    if (!dataStr) return null;
    const [ano, mes, dia] = dataStr.split('-');
    // Início é 00:00, Fim é 23:59
    const d = new Date(ano, mes - 1, dia, isFim ? 23 : 0, isFim ? 59 : 0, isFim ? 59 : 0);
    return Timestamp.fromDate(d);
  };

  const injetarDatasFaltantes = async () => {
    if (!escolaSelecionada || !turmaAlvo) {
      alert("Selecione uma Instituição e uma Turma primeiro!");
      return;
    }
    setStatus('injeçãoDatas');
    addLog('--- INICIANDO INJEÇÃO DE DATAS NO BANCO ---');

    try {
      const qTarefas = query(collection(db, 'tarefas'), where('turmaId', '==', turmaAlvo));
      const snapTarefas = await getDocs(qTarefas);
      const tarefasBanco = snapTarefas.docs.map(d => ({ id: d.id, ...d.data() }));

      addLog(`Avaliando ${tarefasBanco.length} tarefas da turma para atualização...`);

      let atualizadas = 0;

      for (let tarefa of tarefasBanco) {
        const nomeDaTarefa = (tarefa.nomeTarefa || tarefa.titulo || tarefa.nome || '').trim().toLowerCase();
        
        // Tenta achar um "match" no cronograma usando a palavra-chave (Ex: "Módulo 8")
        const cronogramaMatch = cronogramaAssincrono.find(c => 
          nomeDaTarefa.includes(c.modulo.split(' - ')[0].toLowerCase()) || // Ex: acha "módulo 8"
          nomeDaTarefa.includes(c.modulo.toLowerCase())
        );

        if (cronogramaMatch) {
          const startTs = criarTimestampSeguro(cronogramaMatch.inicio, false);
          const endTs = criarTimestampSeguro(cronogramaMatch.fim, true);

          await updateDoc(doc(db, 'tarefas', tarefa.id), {
            dataInicio: startTs,
            dataFim: endTs
          });
          
          atualizadas++;
          addLog(`Injetado prazo em: ${tarefa.nomeTarefa || tarefa.titulo} (Fim: ${cronogramaMatch.fim})`);
        }
      }

      addLog(`✅ INJEÇÃO DE DATAS CONCLUÍDA! (${atualizadas} tarefas atualizadas)`);
      setStatus('concluido');
      alert("Datas aplicadas com sucesso! Vá para o Dashboard para ver a Barra Preta.");
    } catch (error) {
      console.error(error);
      addLog('❌ ERRO NA INJEÇÃO: ' + error.message);
      setStatus('erro');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Ferramentas de Manutenção' }]} />
      
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden mt-6">
        <div className="bg-gray-900 p-8 text-white">
          <h1 className="text-3xl font-black flex items-center gap-3 mb-2"><Database className="text-blue-400"/> Ferramentas de Manutenção</h1>
          <p className="text-gray-400 font-medium">Use este painel para injetar dados faltantes da V1 na V3.</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl">
            <h3 className="font-bold text-blue-900 mb-3">Onde aplicar as correções?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-gray-500 uppercase">1. Instituição Atual</label>
                <div className="font-bold text-gray-800 bg-white p-3 rounded-lg border mt-1 cursor-not-allowed">
                  {escolaSelecionada?.nome || 'Nenhuma selecionada'}
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-500 uppercase">2. Turma Alvo</label>
                <select className="w-full bg-white font-bold text-gray-800 p-3 rounded-lg border mt-1 cursor-pointer outline-blue-500" value={turmaAlvo} onChange={e => setTurmaAlvo(e.target.value)}>
                  <option value="" disabled>Selecione a turma...</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs font-mono max-h-64 overflow-y-auto">
              {logs.length === 0 ? '> Aguardando comando...' : logs.map((log, i) => <div key={i}>{">"} {log}</div>)}
            </div>

            {status !== 'injeçãoDatas' && (
              <button onClick={injetarDatasFaltantes} className="w-full py-4 rounded-xl font-black text-lg bg-orange-600 text-white hover:bg-orange-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-orange-600/30">
                <CalendarDays /> Injetar Datas nas Tarefas Migradas
              </button>
            )}

            {status === 'injeçãoDatas' && (
              <div className="w-full py-4 rounded-xl font-black text-lg bg-yellow-500 text-white flex justify-center items-center gap-2 shadow-lg">
                <RefreshCw className="animate-spin"/> Cruzando dados e atualizando banco...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
