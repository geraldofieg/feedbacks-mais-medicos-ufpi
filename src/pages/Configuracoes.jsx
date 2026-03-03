import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, onSnapshot, serverTimestamp, orderBy, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Building2, Users, Layers, Hand, ChevronRight, BookOpen } from 'lucide-react';

export default function Configuracoes() {
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');

  const [turmas, setTurmas] = useState([]);
  const [novaTurma, setNovaTurma] = useState('');
  const [instituicaoSelecionadaParaTurma, setInstituicaoSelecionadaParaTurma] = useState('');
  
  // NÍVEL 3 
  const [turmaAtivaNivel3, setTurmaAtivaNivel3] = useState('');
  const [modulosDaTurma, setModulosDaTurma] = useState([]);
  const [novoModuloNome, setNovoModuloNome] = useState('');
  const [tarefaNomes, setTarefaNomes] = useState({}); 
  
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

  // Busca Nível 3 
  useEffect(() => {
    if (!turmaAtivaNivel3) { setModulosDaTurma([]); return; }
    const qMod = query(collection(db, 'saas_modulos'), where('idTurma', '==', turmaAtivaNivel3), orderBy('dataCriacao', 'asc'));
    const unsub = onSnapshot(qMod, (snap) => setModulosDaTurma(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    return () => unsub();
  }, [turmaAtivaNivel3]);


  // === FUNÇÕES DE NAVEGAÇÃO RÁPIDA (UX) ===
  const irParaNovaTurma = (idInstituicao) => {
    setInstituicaoSelecionadaParaTurma(idInstituicao);
    document.getElementById('nivel2')?.scrollIntoView({ behavior: 'smooth' });
  };

  const irParaModulos = (idTurma) => {
    setTurmaAtivaNivel3(idTurma);
    document.getElementById('nivel3')?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Ações Instituição ---
  async function handleAddInstituicao(e) {
    e.preventDefault(); if (salvando || !novaInstituicao.trim()) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_instituicoes'), { nome: novaInstituicao.trim(), dataCriacao: serverTimestamp() }); setNovaInstituicao(''); } finally { setSalvando(false); }
  }
  async function handleExcluirInstituicao(id) {
    if (window.confirm('Excluir Instituição? (Isso deixará as turmas dela órfãs)')) { setSalvando(true); try { await deleteDoc(doc(db, 'saas_instituicoes', id)); } finally { setSalvando(false); } }
  }

  // --- Ações Turma ---
  async function handleAddTurma(e) {
    e.preventDefault(); if (salvando || !novaTurma.trim() || !instituicaoSelecionadaParaTurma) return; setSalvando(true);
    try { 
      const docRef = await addDoc(collection(db, 'saas_turmas'), { idInstituicao: instituicaoSelecionadaParaTurma, nome: novaTurma.trim(), dataCriacao: serverTimestamp() }); 
      setNovaTurma(''); 
      irParaModulos(docRef.id); // Cria e já desce pro Nível 3
    } finally { setSalvando(false); }
  }
  async function handleExcluirTurma(id) {
    if (window.confirm('Excluir Turma?')) { 
      setSalvando(true); 
      try { 
        await deleteDoc(doc(db, 'saas_turmas', id)); 
        if (turmaAtivaNivel3 === id) setTurmaAtivaNivel3(''); 
      } finally { setSalvando(false); } 
    }
  }

  // --- Ações Módulos e Tarefas ---
  async function handleAddModulo(e) {
    e.preventDefault(); if (salvando || !novoModuloNome.trim() || !turmaAtivaNivel3) return; setSalvando(true);
    try { await addDoc(collection(db, 'saas_modulos'), { idTurma: turmaAtivaNivel3, nome: novoModuloNome.trim(), tarefas: [], dataCriacao: serverTimestamp() }); setNovoModuloNome(''); } finally { setSalvando(false); }
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
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-blue-600" /> Estrutura do Seu Negócio</h2>
        </div>

        {/* NÍVEL 1 */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-indigo-900 mb-6 flex items-center gap-2 border-b pb-4"><Building2 size={24} /> Nível 1: Instituições</h3>
          <form onSubmit={handleAddInstituicao} className="mb-6 flex gap-2"><input required type="text" placeholder="Nome da Instituição (Ex: UFPI)" className="flex-1 p-3 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={novaInstituicao} onChange={e => setNovaInstituicao(e.target.value)} /><button type="submit" disabled={salvando} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Adicionar</button></form>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instituicoes.length === 0 && <p className="text-sm text-gray-400 italic">Nenhuma instituição cadastrada.</p>}
            {instituicoes.map(inst => (
              <div key={inst.id} className="bg-white border border-indigo-100 p-4 rounded-xl shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-bold text-indigo-900 text-lg">{inst.nome}</span>
                  <button onClick={() => handleExcluirInstituicao(inst.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                </div>
                {/* BOTÃO DE AÇÃO RÁPIDA */}
                <button onClick={() => irParaNovaTurma(inst.id)} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2 px-3 rounded-lg flex items-center justify-center gap-1 w-full transition-colors">
                  <Plus size={14}/> Nova Turma nesta Instituição
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* NÍVEL 2 */}
        <div id="nivel2" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 scroll-mt-24">
          <h3 className="text-xl font-black text-teal-900 mb-6 flex items-center gap-2 border-b pb-4"><Users size={24} /> Nível 2: Turmas</h3>
          <form onSubmit={handleAddTurma} className="mb-6 space-y-4 bg-teal-50 p-5 rounded-xl border border-teal-100">
            <div>
              <label className="block text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">Vincular a qual Instituição? *</label>
              <select required className="w-full p-3 border border-teal-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white" value={instituicaoSelecionadaParaTurma} onChange={e => setInstituicaoSelecionadaParaTurma(e.target.value)}><option value="">Selecione a Instituição...</option>{instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}</select>
            </div>
            <div className="flex gap-2"><input required type="text" placeholder="Ex: Turma Matutino 2026" className="flex-1 p-3 border border-teal-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} disabled={!instituicaoSelecionadaParaTurma} /><button type="submit" disabled={salvando || !instituicaoSelecionadaParaTurma} className="bg-teal-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-teal-700 transition-colors">Criar Turma</button></div>
          </form>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {turmas.length === 0 && <p className="text-sm text-gray-400 italic">Nenhuma turma cadastrada.</p>}
            {turmas.map(turma => { 
              const instPai = instituicoes.find(i => i.id === turma.idInstituicao); 
              return (
                <div key={turma.id} className="border border-gray-200 bg-white p-4 rounded-xl shadow-sm flex flex-col justify-between hover:border-teal-300 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-teal-600 uppercase block mb-1">{instPai ? instPai.nome : 'Sem vínculo'}</span>
                      <span className="font-bold text-gray-800 text-lg">{turma.nome}</span>
                    </div>
                    <button onClick={() => handleExcluirTurma(turma.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                  </div>
                  {/* BOTÃO DE AÇÃO RÁPIDA */}
                  <button onClick={() => irParaModulos(turma.id)} className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 py-2 px-3 rounded-lg flex items-center justify-center gap-1 w-full transition-colors">
                    <BookOpen size={14}/> Gerenciar Módulos
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* NÍVEL 3 */}
        <div id="nivel3" className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-orange-200 border-t-4 border-t-orange-500 scroll-mt-24">
          <h3 className="text-xl font-black text-orange-900 mb-6 flex items-center gap-2 border-b pb-4"><Layers size={24} /> Nível 3: Módulos e Tarefas</h3>
          
          <div className="mb-8 bg-gray-50 p-5 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">Configurar Módulos de qual Turma?</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white" value={turmaAtivaNivel3} onChange={e => setTurmaAtivaNivel3(e.target.value)}>
                <option value="">Selecione uma turma...</option>
                {turmas.map(t => { 
                  const instPai = instituicoes.find(i => i.id === t.idInstituicao);
                  return <option key={t.id} value={t.id}>{instPai ? `${instPai.nome} > ` : ''}{t.nome}</option>
                })}
              </select>
            </div>
          </div>

          {!turmaAtivaNivel3 ? (
            <div className="bg-orange-50 p-6 rounded-xl text-center border border-orange-100 flex flex-col items-center">
              <Hand className="text-orange-400 mb-3 animate-bounce" size={32} />
              <p className="text-orange-800 font-bold">Selecione uma turma na caixa acima (ou clique em "Gerenciar Módulos" na lista de turmas) para começar.</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <form onSubmit={handleAddModulo} className="mb-8 flex gap-2"><input required type="text" placeholder="Nome do Módulo (Ex: Módulo 1 - Ética)" className="flex-1 p-3 border border-orange-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={novoModuloNome} onChange={e => setNovoModuloNome(e.target.value)} /><button type="submit" disabled={salvando} className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors"><Plus size={20} /> Criar Módulo</button></form>
              
              <div className="space-y-6">
                {modulosDaTurma.length === 0 && <p className="text-sm text-gray-500 italic text-center py-4">Ainda não há módulos nesta turma. Crie o primeiro acima!</p>}
                
                {modulosDaTurma.map(mod => (
                  <div key={mod.id} className="border border-orange-100 bg-orange-50/30 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-orange-100 p-4 flex justify-between items-center"><h4 className="font-black text-orange-900">{mod.nome}</h4><button onClick={() => handleExcluirModulo(mod.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button></div>
                    <div className="p-4 bg-white">
                      <div className="flex gap-2 mb-4"><input type="text" placeholder="Nova Tarefa (Ex: Desafio 1)" className="flex-1 p-2 border border-gray-200 rounded text-sm outline-none focus:border-orange-400" value={tarefaNomes[mod.id] || ''} onChange={e => setTarefaNomes({...tarefaNomes, [mod.id]: e.target.value})} /><button onClick={() => handleAddTarefa(mod.id)} disabled={salvando || !tarefaNomes[mod.id]?.trim()} className="bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 hover:bg-orange-600 transition-colors">Adicionar Tarefa</button></div>
                      <div className="space-y-2">
                        {(!mod.tarefas || mod.tarefas.length === 0) && <p className="text-xs text-gray-400 italic">Nenhuma tarefa. Adicione a primeira!</p>}
                        {mod.tarefas?.map((tar, idx) => (<div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2 rounded text-sm"><span className="font-medium text-gray-700">{tar}</span><button onClick={() => handleExcluirTarefa(mod.id, tar)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button></div>))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
