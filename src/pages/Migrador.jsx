import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Migrador() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [instituicoes, setInstituicoes] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  
  const [instSelecionada, setInstSelecionada] = useState('');
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [profSelecionado, setProfSelecionado] = useState('');

  const [analisando, setAnalisando] = useState(false);
  const [dadosEncontrados, setDadosEncontrados] = useState(null);
  
  const [migrando, setMigrando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // Busca dados iniciais para os selects
  useEffect(() => {
    if (!isAdmin) return;
    async function fetchData() {
      const snapInst = await getDocs(collection(db, 'instituicoes'));
      setInstituicoes(snapInst.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const snapUsers = await getDocs(collection(db, 'usuarios'));
      setUsuarios(snapUsers.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchData();
  }, [isAdmin]);

  // Atualiza as turmas quando a instituição muda
  useEffect(() => {
    async function fetchTurmas() {
      if (!instSelecionada) { setTurmas([]); return; }
      const qT = query(collection(db, 'turmas'), where('instituicaoId', '==', instSelecionada));
      const snapT = await getDocs(qT);
      setTurmas(snapT.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchTurmas();
  }, [instSelecionada]);

  if (!isAdmin) return <Navigate to="/" />;

  // PASSO 1: Analisar o que o professor tem na V1
  async function analisarDados() {
    if (!profSelecionado) return;
    setAnalisando(true);
    setSucesso(false);
    try {
      // 1. Acha os alunos da Patrícia
      const qAlunos = query(collection(db, 'alunos'), where('professorUid', '==', profSelecionado));
      const snapAlunos = await getDocs(qAlunos);
      const alunos = snapAlunos.docs.map(d => d.id);

      // 2. Acha as tarefas da Patrícia
      const qTarefas = query(collection(db, 'tarefas'), where('professorUid', '==', profSelecionado));
      const snapTarefas = await getDocs(qTarefas);
      const tarefas = snapTarefas.docs.map(d => d.id);

      // 3. Acha as atividades (Respostas/Notas) ligadas a essas tarefas
      const snapAtividades = await getDocs(collection(db, 'atividades'));
      const atividades = snapAtividades.docs
        .filter(d => tarefas.includes(d.data().tarefaId))
        .map(d => d.id);

      setDadosEncontrados({ alunos, tarefas, atividades });
    } catch (error) {
      console.error(error);
      alert("Erro ao analisar dados.");
    } finally {
      setAnalisando(false);
    }
  }

  // PASSO 2: Fazer a migração para a V3
  async function executarMigracao() {
    if (!instSelecionada || !turmaSelecionada || !dadosEncontrados) return;
    
    if (!window.confirm("ATENÇÃO: Isso vai mover todos esses registros para a Instituição e Turma selecionadas. Tem certeza?")) return;

    setMigrando(true);
    try {
      const payloadV3 = {
        instituicaoId: instSelecionada,
        turmaId: turmaSelecionada
      };

      // Migrar Alunos
      setProgresso(`Migrando ${dadosEncontrados.alunos.length} alunos...`);
      for (const alunoId of dadosEncontrados.alunos) {
        await updateDoc(doc(db, 'alunos', alunoId), payloadV3);
      }

      // Migrar Tarefas
      setProgresso(`Migrando ${dadosEncontrados.tarefas.length} tarefas...`);
      for (const tarefaId of dadosEncontrados.tarefas) {
        await updateDoc(doc(db, 'tarefas', tarefaId), payloadV3);
      }

      // Migrar Atividades (O histórico de notas)
      setProgresso(`Migrando ${dadosEncontrados.atividades.length} atividades/notas...`);
      for (const ativId of dadosEncontrados.atividades) {
        await updateDoc(doc(db, 'atividades', ativId), payloadV3);
      }

      setSucesso(true);
      setProgresso('');
      setDadosEncontrados(null);
    } catch (error) {
      console.error(error);
      alert("Erro durante a migração!");
    } finally {
      setMigrando(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800 text-white">
        <div className="flex items-center gap-4 mb-6 border-b border-slate-700 pb-6">
          <div className="bg-blue-600 p-4 rounded-2xl"><Database size={32} /></div>
          <div>
            <h1 className="text-2xl font-black">Importador V1 ➔ V3</h1>
            <p className="text-slate-400 font-medium mt-1">Ferramenta exclusiva de administração.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">1. Para onde os dados vão?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Instituição Destino</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                  value={instSelecionada} onChange={e => setInstSelecionada(e.target.value)}>
                  <option value="">Selecione...</option>
                  {instituicoes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Turma Destino</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                  value={turmaSelecionada} onChange={e => setTurmaSelecionada(e.target.value)} disabled={!instSelecionada}>
                  <option value="">Selecione...</option>
                  {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">2. De quem são os dados antigos?</h3>
            <div className="flex gap-3">
              <select className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                value={profSelecionado} onChange={e => setProfSelecionado(e.target.value)}>
                <option value="">Selecione a Professora (Dona dos dados)...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.email})</option>)}
              </select>
              <button onClick={analisando ? null : analisarDados} disabled={!profSelecionado || analisando} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50">
                {analisando ? 'Buscando...' : 'Analisar'}
              </button>
            </div>
          </div>

          {dadosEncontrados && (
            <div className="bg-blue-900/30 border border-blue-500/30 p-6 rounded-2xl animate-in fade-in slide-in-from-top-4">
              <h3 className="text-blue-400 font-bold mb-4 flex items-center gap-2"><AlertTriangle size={20}/> Resumo da Carga Encontrada</h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-900 p-4 rounded-xl text-center border border-slate-700">
                  <span className="block text-3xl font-black text-white">{dadosEncontrados.alunos.length}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alunos</span>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl text-center border border-slate-700">
                  <span className="block text-3xl font-black text-white">{dadosEncontrados.tarefas.length}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tarefas</span>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl text-center border border-slate-700">
                  <span className="block text-3xl font-black text-white">{dadosEncontrados.atividades.length}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notas/Ativ.</span>
                </div>
              </div>
              
              {!migrando && !sucesso && (
                <button onClick={executarMigracao} disabled={!instSelecionada || !turmaSelecionada} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Importar Tudo para a Turma Destino <ArrowRight size={20}/>
                </button>
              )}

              {migrando && (
                <div className="text-center py-4 text-blue-300 font-bold flex items-center justify-center gap-3">
                  <Loader2 className="animate-spin" size={24}/> {progresso}
                </div>
              )}

              {sucesso && (
                <div className="bg-green-500/20 border border-green-500 p-4 rounded-xl text-green-400 font-bold flex items-center justify-center gap-2">
                  <CheckCircle size={24}/> Migração Concluída com Sucesso! Volte ao Dashboard.
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
