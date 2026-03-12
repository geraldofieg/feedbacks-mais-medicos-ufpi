import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Crown, Trash2, UserCog, User, AlertTriangle } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Admin() {
  const { currentUser, userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Proteção dupla: Só renderiza se for admin
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  // BUSCA USUÁRIOS
  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin) return;
      try {
        const q = query(collection(db, 'usuarios'));
        const snap = await getDocs(q);
        
        // Ordena para que os Admins apareçam primeiro na lista
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return (a.nome || '').localeCompare(b.nome || '');
        });
        
        setUsuarios(lista);
      } catch (e) { 
        console.error("Erro ao buscar usuários:", e); 
      } finally { 
        setLoading(false); 
      }
    }
    fetchUsuarios();
  }, [isAdmin]);

  // FUNÇÃO: MUDAR CARGO (Professor <-> Admin)
  async function handleMudarCargo(id, cargoAtual) {
    const novoCargo = cargoAtual === 'admin' ? 'professor' : 'admin';
    const msg = novoCargo === 'admin' 
      ? "Dar superpoderes de Administrador para este usuário?" 
      : "Rebaixar este usuário para Professor comum?";
      
    if (!window.confirm(msg)) return;

    try {
      await updateDoc(doc(db, 'usuarios', id), { role: novoCargo });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, role: novoCargo } : u));
    } catch (e) { 
      alert("Erro ao mudar o nível de acesso."); 
    }
  }

  // FUNÇÃO: MUDAR PLANO SAAS
  async function handleMudarPlano(id, novoPlano) {
    try {
      await updateDoc(doc(db, 'usuarios', id), { plano: novoPlano });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, plano: novoPlano } : u));
    } catch (e) { 
      alert("Erro ao mudar o plano do usuário."); 
    }
  }

  // FUNÇÃO: EXCLUIR USUÁRIO
  async function handleExcluirUsuario(id, nome) {
    if (!window.confirm(`ATENÇÃO! Tem certeza que deseja excluir a conta de "${nome}" do banco de dados?\n\nEsta ação é irreversível e o usuário perderá o acesso à plataforma.`)) return;
    try {
      await deleteDoc(doc(db, 'usuarios', id));
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (e) { 
      console.error(e);
      alert("Erro ao excluir usuário."); 
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-6" size={64}/>
        <h1 className="text-3xl font-black text-gray-800 mb-4">Acesso Negado</h1>
        <p className="text-gray-500 text-lg">Esta é uma área restrita apenas para a diretoria da plataforma.</p>
      </div>
    );
  }

  if (loading) return <div className="p-20 text-center text-gray-400 font-bold animate-pulse">Carregando painel de controle...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      <Breadcrumb items={[{ label: 'Painel Admin' }]} />

      <div className="flex items-center gap-4 mt-4 mb-8">
        <div className="bg-slate-900 text-yellow-400 p-3.5 rounded-2xl shadow-lg border border-slate-700">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Painel SaaS (Super Admin)</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Gestão de acessos, cobranças e delegação de poderes.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-gray-100">
              <tr>
                <th className="p-5 text-xs font-black text-slate-500 uppercase tracking-widest">Usuário</th>
                <th className="p-5 text-xs font-black text-slate-500 uppercase tracking-widest">Nível de Acesso</th>
                <th className="p-5 text-xs font-black text-slate-500 uppercase tracking-widest">Plano SaaS</th>
                <th className="p-5 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usuarios.map(user => (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                  
                  {/* COLUNA 1: NOME E EMAIL */}
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                        {user.role === 'admin' ? <Crown size={18}/> : <User size={18}/>}
                      </div>
                      <div>
                        <p className="font-black text-gray-800 text-base">{user.nome || 'Usuário Sem Nome'}</p>
                        <p className="text-xs text-gray-500 font-medium">{user.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* COLUNA 2: CARGO (ADMIN/PROFESSOR) */}
                  <td className="p-5">
                    <button 
                      onClick={() => handleMudarCargo(user.id, user.role)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                        user.role === 'admin' 
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' 
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                      title="Clique para promover/rebaixar"
                    >
                      {user.role === 'admin' ? <><Crown size={14}/> Super Admin</> : <><UserCog size={14}/> Professor</>}
                    </button>
                  </td>

                  {/* COLUNA 3: PLANO SAAS */}
                  <td className="p-5">
                    <select 
                      value={user.plano || 'basico'} 
                      onChange={(e) => handleMudarPlano(user.id, e.target.value)}
                      className="bg-white border border-gray-200 text-gray-700 text-sm rounded-xl py-2 px-3 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer hover:border-blue-300 transition-colors"
                    >
                      <option value="basico">Tier 1: Básico (Gratuito)</option>
                      <option value="intermediario">Tier 2: Intermediário</option>
                      <option value="premium">Tier 3: Premium (Ilimitado)</option>
                    </select>
                  </td>

                  {/* COLUNA 4: AÇÕES (LIXEIRA) */}
                  <td className="p-5 text-right">
                    <button 
                      onClick={() => handleExcluirUsuario(user.id, user.nome)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all inline-flex items-center gap-2 font-bold text-sm opacity-50 group-hover:opacity-100"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
