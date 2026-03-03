import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, onSnapshot, serverTimestamp, orderBy, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Building2, Users, Layers, MonitorPlay } from 'lucide-react';

export default function Configuracoes() {
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');

  const [turmas, setTurmas] = useState([]);
  const [novaTurma, setNovaTurma] = useState('');
  const [instituicaoSelecionadaParaTurma, setInstituicaoSelecionadaParaTurma] = useState('');
  
  // NÍVEL 3: Módulos e Tarefas (Amarrados à Turma do Menu)
  const [turmaSelecionadaGlobal, setTurmaSelecionadaGlobal] = useState(localStorage.getItem('saas_turma'));
  const [modulosDaTurma, setModulosDaTurma] = useState([]);
  const [novoModuloNome, setNovoModuloNome] = useState('');
  const [tarefaNomes, setTarefaNomes] = useState({}); // Controla os inputs de nova tarefa por módulo
  
  const [salvando, setSalvando] = useState(false);

  // Escuta o menu superior
  useEffect(() => {
    const atualizaWorkspace = () => setTurmaSelecionadaGlobal(localStorage.getItem('saas_turma'));
    window.addEventListener('workspaceChanged', atualizaWorkspace);
    return () => window.removeEventListener('workspaceChanged', atualizaWorkspace);
  }, []);

  // Busca Nível 1
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'saas_instituicoes'), orderBy('nome', 'asc')), (snap) => setInstituicoes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, []);

  // Busca Nível 2
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'saas_turmas'), orderBy('nome', 'asc')), (snap) => setTurmas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, []);

  // Busca Nível 3 (Apenas da turma selecionada no Menu)
  useEffect(() => {
    if (!turmaSelecionadaGlobal) { setModulosDaTurma([]); return; }
    const qMod = query(collection(db, 'saas_modulos'), where('idTurma', '==', turmaSelecionadaGlobal), orderBy('dataCriacao', 'asc'));
    const unsub = onSnapshot(qMod, (snap) => setModulosDaTurma(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, [turmaSelecionadaGlobal]);


  // --- Ações Instituição ---
  async function handleAddInstituicao(e) {
    e.preventDefault(); if (salvando || !novaInstituicao.trim()) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_instituicoes'), { nome: novaInstituicao.trim(), dataCriacao: serverTimestamp() }); setNovaInstituicao(''); } finally { setSalvando(false); }
  }
  async function handleExcluirInstituicao(id) {
    if (window.confirm('Excluir Instituição?')) { setSalvando(true); try { await deleteDoc(doc(db, 'saas_instituicoes', id)); } finally { setSalvando(false); } }
  }

  // --- Ações Turma ---
  async function handleAddTurma(e) {
    e.preventDefault(); if (salvando || !novaTurma.trim() || !instituicaoSelecionadaParaTurma) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_turmas'), { idInstituicao: instituicaoSelecionadaParaTurma, nome: novaTurma.trim(), dataCriacao: serverTimestamp() }); setNovaTurma(''); } finally { setSalvando(false); }
  }
  async function handleExcluirTurma(id) {
    if (window.confirm('Excluir Turma?')) { setSalvando(true); try { await deleteDoc(doc(db, 'saas_turmas', id)); } finally { setSalvando(false); } }
  }

  // --- Ações Módulos e Tarefas (SaaS) ---
  async function handleAddModulo(e) {
    e.preventDefault(); if (salvando || !novoModuloNome.trim() || !turmaSelecionadaGlobal) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_modulos'), { idTurma: turmaSelecionadaGlobal, nome: novoModuloNome.trim(), tarefas: [], dataCriacao: serverTimestamp() }); setNovoModuloNome(''); } finally { setSalvando(false); }
  }
  async function handleExcluirModulo(id) {
    if (window.confirm('Excluir Módulo inteiro?')) { setSalvando(true); try { await deleteDoc(doc(db, 'saas_modulos', id)); } finally { setSalvando(false); } }
  }
  async function handleAddTarefa(idModulo) {
    const nomeTarefa = tarefaNomes[idModulo];
    if (salvando || !nomeTarefa?.trim()) return; setSalvando(true);
    try { await updateDoc(doc(db, 'saas_modulos', idModulo), { tarefas: arrayUnion(nomeTarefa.trim()) }); setTarefaNomes({ ...tarefaNomes, [idModulo]: '' }); } finally { setSalvando(false); }
  }
  async function handleExcluirTarefa(idModulo, nomeTarefa) {
    if (window.confirm(`Remover tarefa '${nomeTarefa}'?`)) { setSalvando(true); try { await updateDoc(doc(db, 'saas_modulos', idModulo), { tarefas: arrayRemove(nomeTarefa) }); } finally { setSalvando(false); } }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-blue-600" /> Configurações de Estrutura</h2>
        </div>

        {/* NÍVEL 1 */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-indigo-900 mb-6 flex items-center gap-2 border-b pb-4"><Building2 size={24} /> Nível 1: Instituições</h3>
          <form onSubmit={handleAddInstituicao} className="mb-6 flex gap-2"><input required type="text" placeholder="Nome da Instituição (Ex: UFPI)" className="flex-1 p-3 border rounded-lg" value={novaInstituicao} onChange={e => setNovaInstituicao(e.target.value)} /><button type="submit" disabled={salvando} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold">Adicionar</button></form>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{instituicoes.map(inst => <div key={inst.id} className="bg-indigo-50 p-4 rounded-xl flex justify-between items-center"><span className="font-bold text-indigo-900">{inst.nome}</span><button onClick={() => handleExcluirInstituicao(inst.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button></div>)}</div>
        </div>

        {/* NÍVEL 2 */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-teal-900 mb-6 flex items-center gap-2 border-b pb-4"><Users size={24} /> Nível 2: Turmas</h3>
          <form onSubmit={handleAddTurma} className="mb-6 space-y-4 bg-teal-50 p-5 rounded-xl border border-teal-100">
            <select required className="w-full p-3 border rounded-lg bg-white" value={instituicaoSelecionadaParaTurma} onChange={e => setInstituicaoSelecionadaParaTurma(e.target.value)}><option value="">Selecione a Instituição...</option>{instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}</select>
            <div className="flex gap-2"><input required type="text" placeholder="Nome da Turma" className="flex-1 p-3 border rounded-lg" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} disabled={!instituicaoSelecionadaParaTurma} /><button type="submit" disabled={salvando || !instituicaoSelecionadaParaTurma} className="bg-teal-600 text-white px-6 py-3 rounded-lg font-bold">Criar Turma</button></div>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{turmas.map(turma => { const instPai = instituicoes.find(i => i.id === turma.idInstituicao); return (<div key={turma.id} className="border p-4 rounded-xl flex justify-between items-center"><div><span className="text-[10px] font-bold text-teal-600 uppercase block mb-1">{instPai ? instPai.nome : ''}</span><span className="font-bold">{turma.nome}</span></div><button onClick={() => handleExcluirTurma(turma.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button></div>)})}</div>
        </div>

        {/* NÍVEL 3 (BLOQUEADO SE NÃO TIVER TURMA NO MENU) */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-orange-900 mb-6 flex items-center gap-2 border-b pb-4"><Layers size={24} /> Nível 3: Módulos e Tarefas da Turma</h3>
          
          {!turmaSelecionadaGlobal ? (
            <div className="bg-orange-50 p-6 rounded-xl text-center border border-orange-100"><MonitorPlay className="mx-auto text-orange-400 mb-2" size={32} /><p className="text-orange-800 font-bold">Selecione uma Turma no Menu Superior para criar as atividades dela.</p></div>
          ) : (
            <>
              <form onSubmit={handleAddModulo} className="mb-8 flex gap-2"><input required type="text" placeholder="Nome do Módulo (Ex: Módulo 1 - Ética)" className="flex-1 p-3 border border-orange-200 rounded-lg" value={novoModuloNome} onChange={e => setNovoModuloNome(e.target.value)} /><button type="submit" disabled={salvando} className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2"><Plus size={20} /> Criar Módulo</button></form>
              <div className="space-y-6">
                {modulosDaTurma.length === 0 && <p className="text-sm text-gray-400 italic text-center">Nenhum módulo criado para esta turma ainda.</p>}
                {modulosDaTurma.map(mod => (
                  <div key={mod.id} className="border border-orange-100 bg-orange-50/30 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-orange-100 p-4 flex justify-between items-center"><h4 className="font-black text-orange-900">{mod.nome}</h4><button onClick={() => handleExcluirModulo(mod.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button></div>
                    <div className="p-4 bg-white">
                      <div className="flex gap-2 mb-4"><input type="text" placeholder="Nova Tarefa (Ex: Desafio 1)" className="flex-1 p-2 border border-gray-200 rounded text-sm outline-none focus:border-orange-400" value={tarefaNomes[mod.id] || ''} onChange={e => setTarefaNomes({...tarefaNomes, [mod.id]: e.target.value})} /><button onClick={() => handleAddTarefa(mod.id)} disabled={salvando || !tarefaNomes[mod.id]?.trim()} className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50">Adicionar Tarefa</button></div>
                      <div className="space-y-2">
                        {(!mod.tarefas || mod.tarefas.length === 0) && <p className="text-xs text-gray-400 italic">Sem tarefas cadastradas.</p>}
                        {mod.tarefas?.map((tar, idx) => (<div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 rounded text-sm"><span className="font-medium text-gray-700">{tar}</span><button onClick={() => handleExcluirTarefa(mod.id, tar)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
