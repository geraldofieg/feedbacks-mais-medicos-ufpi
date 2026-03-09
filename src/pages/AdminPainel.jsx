import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Crown, CheckCircle, XCircle, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser } = useAuth();
  
  // A CHAVE MESTRA: Apenas o seu email tem acesso a esta tela
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [atualizando, setAtualizando] = useState(null);

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'usuarios'));
        const lista = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Ordena por nome
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setUsuarios(lista);
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsuarios();
  }, [isAdmin]);

  // Função genérica para atualizar qualquer campo do usuário (plano, role, status)
  async function handleUpdateUser(userId, campo, valor) {
    setAtualizando(userId);
    try {
      await updateDoc(doc(db, 'usuarios', userId), {
        [campo]: valor
      });
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, [campo]: valor } : u));
    } catch (error) {
      alert("Erro ao atualizar usuário.");
      console.error(error);
    } finally {
      setAtualizando(null);
    }
  }

  // Se não for o Geraldo, expulsa da tela (Segurança)
  if (!isAdmin) {
    return <Navigate to="/" />;
  }

  const usuariosFiltrados = usuarios.filter(u => 
    (u.nome || '').toLowerCase().includes(busca.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(busca.toLowerCase())
  );

  const totalPremium = usuarios.filter(u => u.plano === 'premium').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-yellow-400 p-3 rounded-xl shadow-lg shrink-0">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Painel SaaS (Super Admin)</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Gestão de acessos, assinaturas e permissões.</p>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total de Usuários</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">{usuarios.length}</h3>
          </div>
          <div className="bg-blue-50 text-blue-500 p-3 rounded-xl"><Users size={24}/></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-yellow-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Assinantes Premium</p>
            <h3 className="text-3xl font-black text-gray-800 mt-1">{totalPremium}</h3>
          </div>
          <div className="bg-yellow-50 text-yellow-500 p-3 rounded-xl"><Crown size={24}/></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div className="w-full">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Busca Rápida</p>
            <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <Search size={16} className="text-gray-400 mr-2 shrink-0"/>
              <input 
                type="text" 
                placeholder="Nome ou e-mail..." 
                className="w-full text-sm bg-transparent outline-none text-gray-700 font-medium"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABELA DE USUÁRIOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Carregando base de usuários...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                  <th className="p-4 font-bold">Usuário</th>
                  <th className="p-4 font-bold">Plano SaaS</th>
                  <th className="p-4 font-bold">Nível (Role)</th>
                  <th className="p-4 font-bold text-center">Status de Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usuariosFiltrados.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${atualizando === user.id ? 'opacity-50 pointer-events-none' : ''}`}>
                    <td className="p-4">
                      <p className="font-bold text-gray-900">{user.nome || 'Sem Nome'}</p>
                      <p className="text-xs font-medium text-gray-500 mt-0.5">{user.email}</p>
                    </td>
                    
                    <td className="p-4">
                      <select 
                        className={`text-sm font-bold p-2.5 rounded-lg border outline-none cursor-pointer transition-colors ${
                          user.plano === 'premium' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 
                          user.plano === 'intermediario' ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                          'bg-gray-50 border-gray-200 text-gray-600'
                        }`}
                        value={user.plano || 'basico'}
                        onChange={(e) => handleUpdateUser(user.id, 'plano', e.target.value)}
                        disabled={atualizando === user.id}
                      >
                        <option value="basico">Tier 1: Básico</option>
                        <option value="intermediario">Tier 2: Intermediário</option>
                        <option value="premium">Tier 3: Premium (IA)</option>
                      </select>
                    </td>

                    <td className="p-4">
                      <select 
                        className={`text-sm font-bold p-2.5 rounded-lg outline-none cursor-pointer transition-colors ${
                          user.role === 'admin' ? 'bg-slate-800 text-white border border-slate-700' : 'bg-gray-100 text-gray-700 border border-transparent'
                        }`}
                        value={user.role || 'professor'}
                        onChange={(e) => handleUpdateUser(user.id, 'role', e.target.value)}
                        disabled={atualizando === user.id}
                      >
                        <option value="professor">Professor</option>
                        <option value="admin">Gestor (Admin)</option>
                      </select>
                    </td>

                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleUpdateUser(user.id, 'status', user.status === 'bloqueado' ? 'ativo' : 'bloqueado')}
                        disabled={atualizando === user.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                          user.status === 'bloqueado' 
                          ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                        }`}
                      >
                        {user.status === 'bloqueado' ? <><XCircle size={16}/> Bloqueado</> : <><CheckCircle size={16}/> Liberado</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usuariosFiltrados.length === 0 && (
              <div className="text-center py-12">
                <Users size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Nenhum usuário encontrado com esta busca.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
