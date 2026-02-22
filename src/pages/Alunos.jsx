import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';

export default function Alunos() {
  const [alunos, setAlunos] = useState([]);
  const [novoAluno, setNovoAluno] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Busca os alunos em tempo real
  useEffect(() => {
    const q = query(collection(db, 'alunos'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setAlunos(lista);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function handleAddAluno(e) {
    e.preventDefault();
    if (!novoAluno.trim()) return;
    
    setSalvando(true);
    try {
      await addDoc(collection(db, 'alunos'), {
        nome: novoAluno.trim()
      });
      setNovoAluno(''); // Limpa o campo
    } catch (error) {
      console.error("Erro ao adicionar aluno:", error);
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(id) {
    if (window.confirm('Tem certeza que deseja excluir este aluno?')) {
      try {
        await deleteDoc(doc(db, 'alunos', id));
      } catch (error) {
        console.error("Erro ao excluir:", error);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users size={28} className="text-blue-600" />
            Gerenciar Alunos
          </h2>
        </div>

        {/* Formulário de Cadastro */}
        <form onSubmit={handleAddAluno} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex gap-4 items-end">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo do Aluno</label>
            <input 
              required 
              type="text" 
              placeholder="Ex: João da Silva..." 
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              value={novoAluno} 
              onChange={e => setNovoAluno(e.target.value)} 
            />
          </div>
          <button 
            type="submit" 
            disabled={salvando} 
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 h-[42px] rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus size={20} />
            <span className="hidden md:inline">Adicionar</span>
          </button>
        </form>

        {/* Lista de Alunos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 font-medium text-gray-600 flex justify-between">
            <span>Alunos Cadastrados ({alunos.length})</span>
          </div>
          
          {loading ? (
            <div className="p-6 text-center text-gray-500">Carregando lista...</div>
          ) : alunos.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Nenhum aluno cadastrado ainda.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {alunos.map(aluno => (
                <li key={aluno.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <span className="font-medium text-gray-800">{aluno.nome}</span>
                  <button onClick={() => handleExcluir(aluno.id)} className="text-red-400 hover:text-red-600 transition-colors p-2">
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
