import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings } from 'lucide-react';

export default function Configuracoes() {
  const [modulos, setModulos] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [novoModulo, setNovoModulo] = useState('');
  const [novaTarefa, setNovaTarefa] = useState('');

  // Busca Módulos e Tarefas do banco de dados em tempo real
  useEffect(() => {
    const qModulos = query(collection(db, 'modulos'), orderBy('nome', 'asc'));
    const unsubModulos = onSnapshot(qModulos, (snap) => {
      setModulos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTarefas = query(collection(db, 'tarefas'), orderBy('nome', 'asc'));
    const unsubTarefas = onSnapshot(qTarefas, (snap) => {
      setTarefas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubModulos(); unsubTarefas(); };
  }, []);

  async function handleAddModulo(e) {
    e.preventDefault();
    if (!novoModulo.trim()) return;
    try {
      await addDoc(collection(db, 'modulos'), { nome: novoModulo.trim() });
      setNovoModulo('');
    } catch (error) { console.error("Erro:", error); }
  }

  async function handleAddTarefa(e) {
    e.preventDefault();
    if (!novaTarefa.trim()) return;
    try {
      await addDoc(collection(db, 'tarefas'), { nome: novaTarefa.trim() });
      setNovaTarefa('');
    } catch (error) { console.error("Erro:", error); }
  }

  async function handleExcluirModulo(id) {
    if (window.confirm('Tem certeza que deseja excluir este módulo?')) {
      await deleteDoc(doc(db, 'modulos', id));
    }
  }

  async function handleExcluirTarefa(id) {
    if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
      await deleteDoc(doc(db, 'tarefas', id));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="text-blue-600" />
            Configurações do Sistema
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* COLUNA 1: Módulos */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Gerenciar Módulos</h3>
            
            <form onSubmit={handleAddModulo} className="flex gap-2 mb-6">
              <input required type="text" placeholder="Ex: Módulo 1..." className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={novoModulo} onChange={e => setNovoModulo(e.target.value)} />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={20} />
              </button>
            </form>

            <ul className="divide-y divide-gray-100">
              {modulos.length === 0 && <li className="text-gray-500 text-sm text-center py-4">Nenhum módulo cadastrado</li>}
              {modulos.map(mod => (
                <li key={mod.id} className="py-3 flex justify-between items-center hover:bg-gray-50">
                  <span className="font-medium text-gray-700">{mod.nome}</span>
                  <button onClick={() => handleExcluirModulo(mod.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                </li>
              ))}
            </ul>
          </div>

          {/* COLUNA 2: Tarefas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Gerenciar Tarefas</h3>
            
            <form onSubmit={handleAddTarefa} className="flex gap-2 mb-6">
              <input required type="text" placeholder="Ex: Fórum Temático..." className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={20} />
              </button>
            </form>

            <ul className="divide-y divide-gray-100">
              {tarefas.length === 0 && <li className="text-gray-500 text-sm text-center py-4">Nenhuma tarefa cadastrada</li>}
              {tarefas.map(tar => (
                <li key={tar.id} className="py-3 flex justify-between items-center hover:bg-gray-50">
                  <span className="font-medium text-gray-700">{tar.nome}</span>
                  <button onClick={() => handleExcluirTarefa(tar.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
