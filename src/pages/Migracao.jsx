import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Migracao() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turmaAlvo, setTurmaAlvo] = useState('');
  
  const [analise, setAnalise] = useState(null);
  const [status, setStatus] = useState('ocioso'); // ocioso, analisando, migrando, concluido
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

  const analisarBanco = async () => {
    if (!escolaSelecionada || !turmaAlvo) {
      alert("Selecione uma Instituição no topo e uma Turma abaixo!");
      return;
    }
    setStatus('analisando');
    setLogs(['Iniciando varredura no banco V1...']);
    
    try {
      // Puxa TODOS os dados do banco (sem limite)
      const [snapAlunos, snapTarefas, snapAtividades] = await Promise.all([
        getDocs(collection(db, 'alunos')),
        getDocs(collection(db, 'tarefas')),
        getDocs(collection(db, 'atividades'))
      ]);

      // Filtra apenas os que estão "órfãos" (Sem turmaId - que vieram da V1)
      const alunosOrfaos = snapAlunos.docs.filter(d => !d.data().turmaId);
      const tarefasOrfaos = snapTarefas.docs.filter(d => !d.data().turmaId);
      const atividadesOrfaos = snapAtividades.docs.filter(d => !d.data().turmaId);

      setAnalise({
        alunos: alunosOrfaos,
        tarefas: tarefasOrfaos,
        atividades: atividadesOrfaos
      });

      addLog(`Encontrados: ${alunosOrfaos.length} alunos sem crachá.`);
      addLog(`Encontrados: ${tarefasOrfaos.length} tarefas sem crachá.`);
      addLog(`Encontrados: ${atividadesOrfaos.length} atividades sem crachá.`);
      setStatus('pronto');
    } catch (e) {
      console.error(e);
      addLog('ERRO: ' + e.message);
      setStatus('ocioso');
    }
  };

  const executarMigracao = async () => {
    if (!analise || !turmaAlvo) return;
    if (!window.confirm("ATENÇÃO: Essa ação vai colocar os dados antigos dentro da turma selecionada. Deseja continuar?")) return;
    
    setStatus('migrando');
    addLog('--- INICIANDO MIGRAÇÃO PARA V3 ---');

    const profUid = currentUser.uid;
    const instId = escolaSelecionada.id;

    // MAPAS DE MEMÓRIA PARA CRUZAR NOMES COM IDs
    const mapaAlunos = {}; 
    const mapaTarefas = {};

    try {
      // 1. MIGRAR ALUNOS
      addLog(`Migrando ${analise.alunos.length} alunos...`);
      for (let docSnap of analise.alunos) {
        const id = docSnap.id;
        const data = docSnap.data();
        await updateDoc(doc(db, 'alunos', id), {
          instituicaoId: instId,
          turmaId: turmaAlvo,
          professorUid: profUid,
          status: data.status || 'ativo'
        });
        if (data.nome) mapaAlunos[data.nome.trim().toLowerCase()] = id;
      }

      // 2. MIGRAR TAREFAS
      addLog(`Migrando ${analise.tarefas.length} tarefas...`);
      for (let docSnap of analise.tarefas) {
        const id = docSnap.id;
        const data = docSnap.data();
        await updateDoc(doc(db, 'tarefas', id), {
          instituicaoId: instId,
          turmaId: turmaAlvo,
          professorUid: profUid,
          status: data.status || 'ativa',
          tipo: data.tipo || 'entrega',
          nomeTarefa: data.nomeTarefa || data.titulo || data.nome || 'Tarefa Migrada',
          titulo: data.titulo || data.nomeTarefa || data.nome || 'Tarefa Migrada'
        });
        if (data.nome) mapaTarefas[data.nome.trim().toLowerCase()] = id;
      }

      // 3. MIGRAR ATIVIDADES
      addLog(`Migrando ${analise.atividades.length} atividades (Respostas e Feedbacks)...`);
      for (let docSnap of analise.atividades) {
        const id = docSnap.id;
        const data = docSnap.data();
        
        // Tenta descobrir o ID do aluno pelo Nome
        let idAlunoEncontrado = data.alunoId;
        if (!idAlunoEncontrado && data.aluno) {
          idAlunoEncontrado = mapaAlunos[data.aluno.trim().toLowerCase()] || null;
        }

        // Tenta descobrir o ID da tarefa pelo Nome
        let idTarefaEncontrada = data.tarefaId;
        if (!idTarefaEncontrada && data.tarefa) {
          idTarefaEncontrada = mapaTarefas[data.tarefa.trim().toLowerCase()] || null;
        }

        await updateDoc(doc(db, 'atividades', id), {
          instituicaoId: instId,
          turmaId: turmaAlvo,
          professorUid: profUid,
          alunoId: idAlunoEncontrado || data.aluno || 'desconhecido', // Fallback de segurança
          tarefaId: idTarefaEncontrada || data.tarefa || data.modulo || 'desconhecido'
        });
      }

      addLog('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
      setStatus('concluido');
      alert("Sucesso! Pode voltar para a aba Início, os dados já devem aparecer.");

    } catch (e) {
      console.error(e);
      addLog('❌ ERRO NA MIGRAÇÃO: ' + e.message);
      setStatus('erro');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Motor de Migração V1 -> V3' }]} />
      
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden mt-6">
        <div className="bg-gray-900 p-8 text-white">
          <h1 className="text-3xl font-black flex items-center gap-3 mb-2"><Database className="text-blue-400"/> Motor de Migração</h1>
          <p className="text-gray-400 font-medium">Injete as credenciais de Instituição e Turma nos dados antigos da V1 para que eles apareçam na V3.</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl">
            <h3 className="font-bold text-blue-900 mb-3">Para onde os dados da V1 devem ir?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black text-gray-500 uppercase">1. Instituição Atual (No Menu do Topo)</label>
                <div className="font-bold text-gray-800 bg-white p-3 rounded-lg border mt-1 cursor-not-allowed">
                  {escolaSelecionada?.nome || 'Nenhuma selecionada'}
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-500 uppercase">2. Turma de Destino</label>
                <select className="w-full bg-white font-bold text-gray-800 p-3 rounded-lg border mt-1 cursor-pointer outline-blue-500" value={turmaAlvo} onChange={e => setTurmaAlvo(e.target.value)}>
                  <option value="" disabled>Selecione a turma destino...</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          {status === 'ocioso' && (
            <button onClick={analisarBanco} className="w-full py-4 rounded-xl font-black text-lg bg-gray-800 text-white hover:bg-gray-700 transition-all flex justify-center items-center gap-2">
              <Database /> Analisar Banco V1
            </button>
          )}

          {status === 'analisando' && (
            <div className="text-center py-10 font-bold text-blue-600 animate-pulse flex flex-col items-center gap-2">
              <RefreshCw size={40} className="animate-spin"/> Lendo banco de dados...
            </div>
          )}

          {(status === 'pronto' || status === 'migrando' || status === 'concluido' || status === 'erro') && (
            <div className="space-y-4">
              <div className="bg-gray-900 text-green-400 p-4 rounded-xl text-xs font-mono max-h-64 overflow-y-auto">
                {logs.map((log, i) => <div key={i}>{">"} {log}</div>)}
              </div>

              {status === 'pronto' && (
                <button onClick={executarMigracao} className="w-full py-4 rounded-xl font-black text-lg bg-green-600 text-white hover:bg-green-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-green-600/30 animate-in fade-in zoom-in">
                  <ArrowRight /> Confirmar e Migrar Dados para a V3
                </button>
              )}

              {status === 'migrando' && (
                <div className="w-full py-4 rounded-xl font-black text-lg bg-yellow-500 text-white flex justify-center items-center gap-2 shadow-lg">
                  <RefreshCw className="animate-spin"/> Processando injeção de dados...
                </div>
              )}

              {status === 'concluido' && (
                <div className="w-full py-4 rounded-xl font-black text-lg bg-blue-600 text-white flex justify-center items-center gap-2 shadow-lg">
                  <CheckCircle2 /> Migração Concluída! Veja o Painel Inicial.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
