import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Archive } from 'lucide-react';

export default function Configuracoes() {
  const [modulos, setModulos] = useState([]);
  const [novoModulo, setNovoModulo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [novaTarefaModulo, setNovaTarefaModulo] = useState({}); 

  useEffect(() => {
    // Busca todos os módulos sem ordenação prévia do Firebase, 
    // pois faremos a separação e ordenação inteligente no JavaScript.
    const qModulos = query(collection(db, 'modulos'));
    const unsubModulos = onSnapshot(qModulos, (snap) => {
      setModulos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubModulos();
  }, []);

  // ==========================================
  // LÓGICA DE ORDENAÇÃO E SEPARAÇÃO (A SUA IDEIA!)
  // ==========================================
  const modulosAtivos = modulos
    .filter(m => m.status !== 'arquivado')
    .sort((a, b) => {
      const timeA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
      const timeB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
      return timeB - timeA; // Do mais novo pro mais velho
    });

  const modulosArquivados = modulos
    .filter(m => m.status === 'arquivado')
    .sort((a, b) => {
      const timeA = a.dataCriacao?.toMillis ? a.dataCriacao.toMillis() : 0;
      const timeB = b.dataCriacao?.toMillis ? b.dataCriacao.toMillis() : 0;
      return timeB - timeA; // Do mais novo pro mais velho
    });


  // ==========================================
  // CRUD DE UNIDADES
  // ==========================================
  async function handleAddModulo(e) {
    e.preventDefault();
    if (salvando || !novoModulo.trim()) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'modulos'), { 
        nome: novoModulo.trim(),
        tarefas: [], 
        status: 'ativo', 
        dataCriacao: serverTimestamp() 
      });
      setNovoModulo('');
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  async function handleExcluirModulo(id) {
    if (salvando) return;
    if (window.confirm('Tem certeza que deseja excluir esta Unidade e todas as tarefas dela?')) {
      setSalvando(true);
      try { await deleteDoc(doc(db, 'modulos', id)); } finally { setSalvando(false); }
    }
  }

  async function handleToggleStatus(id, statusAtual) {
    if (salvando) return;
    setSalvando(true);
    try {
      const novoStatus = statusAtual === 'ativo' ? 'arquivado' : 'ativo';
      await updateDoc(doc(db, 'modulos', id), { status: novoStatus });
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  // ==========================================
  // CRUD DE TAREFAS ANINHADAS
  // ==========================================
  async function handleAddTarefaNoModulo(moduloId, listaAtual) {
    const nomeTarefa = novaTarefaModulo[moduloId];
    if (salvando || !nomeTarefa || !nomeTarefa.trim()) return;
    
    setSalvando(true);
    try {
      const novaLista = [...(listaAtual || []), nomeTarefa.trim()];
      await updateDoc(doc(db, 'modulos', moduloId), { tarefas: novaLista });
      setNovaTarefaModulo(prev => ({ ...prev, [moduloId]: '' }));
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  async function handleExcluirTarefaDoModulo(moduloId, nomeTarefaParaExcluir, listaAtual) {
    if (salvando) return;
    if (window.confirm(`Excluir a tarefa "${nomeTarefaParaExcluir}"?`)) {
      setSalvando(true);
      try {
        const novaLista = listaAtual.filter(t => t !== nomeTarefaParaExcluir);
        await updateDoc(doc(db, 'modulos', moduloId), { tarefas: novaLista });
      } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
    }
  }

  // Função auxiliar para desenhar o Card do Módulo e evitar código repetido
  const renderModuloCard = (mod, isAtivo) => (
    <div key={mod.id} className={`rounded-xl border overflow-hidden shadow-sm flex flex-col transition-all ${isAtivo ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-300 opacity-75'}`}>
      <div className={`p-4 flex justify-between items-center text-white ${isAtivo ? 'bg-gray-800' : 'bg-gray-400'}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold">{mod.nome}</span>
          {!isAtivo && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider">Arquivado</span>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleToggleStatus(mod.id, mod.status)} disabled={salvando} title={isAtivo ? "Arquivar Unidade" : "Desarquivar Unidade"} className="hover:text-yellow-400 transition-colors">
            <Archive size={18} />
          </button>
          <button onClick={() => handleExcluirModulo(mod.id)} disabled={salvando} className="hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
        </div>
      </div>
      
      <div className="p-4 flex-1">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tarefas:</h4>
        <ul className="space-y-2 mb-4">
          {(!mod.tarefas || mod.tarefas.length === 0) && <li className="text-sm text-gray-400 italic">Nenhuma tarefa.</li>}
          {mod.tarefas?.map((tar, idx) => (
            <li key={idx} className={`border p-2 rounded-lg flex justify-between items-center text-sm ${isAtivo ? 'bg-white border-gray-100 text-gray-700' : 'bg-transparent border-gray-200 text-gray-500'}`}>
              <span className="font-medium">{tar}</span>
              <button onClick={() => handleExcluirTarefaDoModulo(mod.id, tar, mod.tarefas)} disabled={salvando || !isAtivo} className="text-red-300 hover:text-red-500 disabled:opacity-0"><Trash2 size={16}/></button>
            </li>
          ))}
        </ul>
      </div>
      
      {isAtivo && (
        <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
          <input type="text" placeholder="Nova tarefa..." className="flex-grow p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
            value={novaTarefaModulo[mod.id] || ''} 
            onChange={e => setNovaTarefaModulo(prev => ({ ...prev, [mod.id]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleAddTarefaNoModulo(mod.id, mod.tarefas)}
          />
          <button onClick={() => handleAddTarefaNoModulo(mod.id, mod.tarefas)} disabled={salvando} className="bg-gray-800 text-white px-3 py-2 rounded-md hover:bg-black transition-colors">
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="text-blue-600" />
            Configurações do Sistema
          </h2>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Gerenciamento Estrutural (Unidades de Ensino)</h3>
          
          <form onSubmit={handleAddModulo} className="flex gap-2 mb-8 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <input required type="text" placeholder="Criar nova Unidade (Ex: Módulo 9, Semana 3...)" className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={novoModulo} onChange={e => setNovoModulo(e.target.value)} />
            <button type="submit" disabled={salvando} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:opacity-50">
              Criar Unidade
            </button>
          </form>

          {/* SESSÃO DE ATIVOS */}
          <div className="mb-12">
            <h4 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-
