import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Zap, RefreshCw, CalendarDays, Trash2 } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

// LISTA FILTRADA: APENAS MÓDULO 09 EM DIANTE (Extraído do PDF Oficial)
const cronogramaFuturo = [
  { num: "09", inicio: "2026-03-30", fim: "2026-04-26" },
  { num: "10", inicio: "2026-04-27", fim: "2026-05-10" },
  { num: "11", inicio: "2026-05-11", fim: "2026-05-24" },
  { num: "34", inicio: "2026-05-25", fim: "2026-07-05" },
  { num: "12", inicio: "2026-07-06", fim: "2026-08-02" },
  { num: "13", inicio: "2026-08-03", fim: "2026-08-30" },
  { num: "14", inicio: "2026-08-31", fim: "2026-09-27" },
  { num: "15", inicio: "2026-09-28", fim: "2026-10-11" },
  { num: "16", inicio: "2026-10-12", fim: "2026-11-08" },
  { num: "17", inicio: "2026-11-09", fim: "2026-12-06" },
  { num: "18", inicio: "2026-12-07", fim: "2026-12-20" },
  { num: "19", inicio: "2026-12-21", fim: "2027-01-03" },
  { num: "20", inicio: "2027-01-04", fim: "2027-01-31" },
  { num: "21", inicio: "2027-02-01", fim: "2027-02-14" },
  { num: "22", inicio: "2027-02-15", fim: "2027-03-14" },
  { num: "23", inicio: "2027-03-15", fim: "2027-04-11" },
  { num: "24", inicio: "2027-04-12", fim: "2027-04-25" },
  { num: "25", inicio: "2027-04-26", fim: "2027-05-09" },
  { num: "26", inicio: "2027-05-10", fim: "2027-05-23" },
  { num: "27", inicio: "2027-05-24", fim: "2027-06-06" },
  { num: "28", inicio: "2027-06-07", fim: "2027-06-20" },
  { num: "29", inicio: "2027-06-21", fim: "2027-07-18" },
  { num: "30", inicio: "2027-07-19", fim: "2027-08-15" },
  { num: "31", inicio: "2027-08-16", fim: "2027-08-29" },
  { num: "32", inicio: "2027-08-30", fim: "2027-09-12" }
];

export default function Migracao() {
  const { currentUser, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turmaAlvo, setTurmaAlvo] = useState('');
  const [status, setStatus] = useState('ocioso');
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function fetchTurmas() {
      if (!escolaSelecionada?.id) return;
      const q = query(collection(db, 'turmas'), where('instituicaoId', '==', escolaSelecionada.id));
      const snap = await getDocs(q);
      setTurmas(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira'));
    }
    fetchTurmas();
  }, [escolaSelecionada]);

  const criarTimestamp = (dataStr, isFim = false) => {
    const [ano, mes, dia] = dataStr.split('-');
    const d = new Date(ano, mes - 1, dia, isFim ? 23 : 0, isFim ? 59 : 0, isFim ? 59 : 0);
    return Timestamp.fromDate(d);
  };

  const gerarNovasTarefas = async () => {
    if (!turmaAlvo) return alert("Selecione a turma!");
    if (!window.confirm("Isto criará as tarefas do Módulo 09 em diante com o campo 'ano'. Confirma?")) return;

    setStatus('processando');
    setLogs(['A iniciar criação em lote (Módulo 09 ao 32)...']);

    try {
      for (const modulo of cronogramaFuturo) {
        const tipos = ['Desafio', 'Fórum'];
        const anoRef = parseInt(modulo.fim.split('-')[0]);

        for (const tipo of tipos) {
          const nomeFinal = `Módulo ${modulo.num} - ${tipo}`;
          
          await addDoc(collection(db, 'tarefas'), {
            nomeTarefa: nomeFinal,
            titulo: nomeFinal,
            instituicaoId: escolaSelecionada.id,
            turmaId: turmaAlvo,
            professorUid: currentUser.uid,
            status: 'ativa',
            tipo: 'entrega',
            ano: anoRef, // INDEXADOR PARA DISTINGUIR DAS TAREFAS SEM ANO
            dataInicio: criarTimestamp(modulo.inicio, false),
            dataFim: criarTimestamp(modulo.fim, true),
            dataCriacao: Timestamp.now(),
            enunciado: "" 
          });
          
          setLogs(prev => [...prev, `✅ Criado: ${nomeFinal} (Ano: ${anoRef})`]);
        }
      }
      setStatus('concluido');
      alert("Sucesso! Módulos 09+ gerados. Podes agora remover as duplicatas sem campo 'ano'.");
    } catch (e) {
      setLogs(prev => [...prev, '❌ Erro: ' + e.message]);
      setStatus('erro');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Automação Académica (Módulo 09+)' }]} />
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden mt-6">
        <div className="bg-slate-900 p-8 text-white">
          <h1 className="text-3xl font-black flex items-center gap-3 mb-2"><Zap className="text-yellow-400"/> Gerador de Estrutura V3</h1>
          <p className="text-slate-400 font-medium">Criação de Fóruns e Desafios (M09-M32) com indexação de Ano.</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 items-start">
            <Trash2 className="text-amber-600 shrink-0" size={20}/>
            <p className="text-xs text-amber-800 font-medium">
              <strong>Atenção:</strong> Os módulos 1 a 8 serão mantidos. A partir do 9, apaga manualmente as tarefas antigas que <strong>não possuem</strong> o campo "ano" no banco.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl">
            <label className="text-xs font-black text-blue-500 uppercase tracking-widest">Turma de Destino</label>
            <select className="w-full bg-white font-bold text-gray-800 p-3 rounded-lg border mt-2 outline-blue-500" value={turmaAlvo} onChange={e => setTurmaAlvo(e.target.value)}>
              <option value="">Escolher turma...</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div className="bg-black text-green-400 p-4 rounded-xl text-[10px] font-mono max-h-64 overflow-y-auto shadow-inner border border-slate-800">
            {logs.length === 0 ? '> Sistema pronto para injeção de tarefas...' : logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>

          <button 
            onClick={gerarNovasTarefas}
            disabled={status === 'processando'}
            className="w-full py-4 rounded-xl font-black text-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex justify-center items-center gap-2 shadow-lg disabled:opacity-50"
          >
            {status === 'processando' ? <RefreshCw className="animate-spin"/> : <Zap />}
            Gerar Ciclo Completo (Módulos 09 ao 32)
          </button>
        </div>
      </div>
    </div>
  );
}
