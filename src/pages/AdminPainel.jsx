import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Crown, CheckCircle, XCircle, Search, Link as LinkIcon, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [atualizando, setAtualizando] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin || authLoading) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'usuarios'));
        const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setUsuarios(lista);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchUsuarios();
  }, [isAdmin, authLoading]);

  // =========================================================================
  // A PONTE ELEGANTE: ETIQUETA ORIGINAIS E APAGA CLONES (COM NOMES OFICIAIS)
  // =========================================================================
  async function handleEtiquetarOriginais(userEmail, userUid) {
    if (!window.confirm(`Isso vai LIMPAR os clones e ETIQUETAR os dados reais de ${userEmail} para a V3 ler. Confirma?`)) return;
    setSincronizando(userUid);
    try {
      const batch = writeBatch(db);

      // PASSO 1: FAXINA DOS CLONES (Tudo que foi criado exclusivamete pra V3 antes)
      const apagarClones = async (colName) => {
        const q = await getDocs(collection(db, colName));
        q.docs.forEach(d => { 
          if (d.data().instituicaoId) batch.delete(d.ref); 
        });
      };
      await apagarClones('instituicoes');
      await apagarClones('turmas');
      
      // PASSO 2: CRIAR AS GAVETAS DA V3 (Com os Nomes Oficiais)
      const instRef = doc(collection(db, 'instituicoes'));
      batch.set(instRef, { 
        nome: "UFPI", // Nome oficial solicitado
        professorUid: userUid, 
        status: 'ativa', 
        dataCriacao: serverTimestamp() 
      });

      const turmaRef = doc(collection(db, 'turmas'));
      batch.set(turmaRef, { 
        nome: "Mais Médicos", // Nome oficial solicitado
        instituicaoId: instRef.id, 
        professorUid: userUid, 
        status: 'ativa' 
      });

      // PASSO 3: ETIQUETAR OS ORIGINAIS (Sem duplicar a V1)
      let contAlunos = 0, contAtiv = 0, contTarefas = 0;

      // Etiqueta Alunos Originais
      const snapAlunos = await getDocs(collection(db, 'alunos'));
      snapAlunos.docs.forEach(d => {
        if (!d.data().instituicaoId) { // Se não tem etiqueta, é original da V1
          batch.update(d.ref, { instituicaoId: instRef.id, turmaId: turmaRef.id });
          contAlunos++;
        } else {
           // Se era clone nosso dos testes, apaga para desduplicar a V1
           batch.delete(d.ref);
        }
      });

      // Etiqueta Atividades Originais
      const snapAtiv = await getDocs(collection(db, 'atividades'));
      snapAtiv.docs.forEach(d => {
        if (!d.data().instituicaoId) {
          batch.update(d.ref, { instituicaoId: instRef.id, turmaId: turmaRef.id });
          contAtiv++;
        } else {
           batch.delete(d.ref);
        }
      });

      // Etiqueta Tarefas Originais (Cronograma)
      const snapTarefas = await getDocs(collection(db, 'tarefas'));
      snapTarefas.docs.forEach(d => {
        if (!d.data().instituicaoId) {
          batch.update(d.ref, { instituicaoId: instRef.id, turmaId: turmaRef.id });
          contTarefas++;
        } else {
           batch.delete(d.ref);
        }
      });

      await batch.commit();
      alert(`🔗 PONTE CRIADA COM SUCESSO!\n\nDados Reais Etiquetados:\n👤 ${contAlunos} Alunos\n📝 ${contAtiv} Atividades\n📅 ${contTarefas} Tarefas do Cronograma.\n\nDuplicidades removidas da V1!`);
      window.location.reload();
    } catch (e) {
      alert("Erro ao criar a ponte: " + e.message);
      console.error(e);
    } finally {
      setSincronizando(null);
    }
  }

  async function handleUpdateUser(userId, campo, valor) {
    setAtualizando(userId);
    try {
      await updateDoc(doc(db, 'usuarios', userId), { [campo]: valor });
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, [campo]: valor } : u));
    } catch (error) { alert("Erro ao atualizar."); } finally { setAtualizando(null); }
  }

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-yellow-400 p-3 rounded-xl shadow-lg shrink-0">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Painel SaaS (Super Admin)</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Gestão de acessos, assinaturas e sincronização de dados.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                <th className="p-4 font-bold">Usuário</th>
                <th className="p-4 font-bold">Plano SaaS</th>
                <th className="p-4 font-bold text-center">Status de Acesso</th>
                <th className="p-4 font-bold text-center">Ponte V1 ➔ V3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{user.nome || 'Sem Nome'}</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">{user.email}</p>
                  </td>
                  
                  <td className="p-4">
                    <select className="text-sm font-bold p-2.5 rounded-lg border bg-gray-50" value={user.plano || 'basico'} onChange={(e) => handleUpdateUser(user.id, 'plano', e.target.value)} disabled={atualizando === user.id}>
                      <option value="basico">Tier 1: Básico</option>
                      <option value="intermediario">Tier 2: Intermediário</option>
                      <option value="premium">Tier 3: Premium (IA)</option>
                    </select>
                  </td>

                  <td className="p-4 text-center">
                    <button onClick={() => handleUpdateUser(user.id, 'status', user.status === 'bloqueado' ? 'ativo' : 'bloqueado')} disabled={atualizando === user.id} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider ${user.status === 'bloqueado' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {user.status === 'bloqueado' ? 'Bloqueado' : 'Liberado'}
                    </button>
                  </td>

                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleEtiquetarOriginais(user.email, user.id)}
                      disabled={sincronizando === user.id}
                      className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <LinkIcon size={16} />
                      {sincronizando === user.id ? 'Sincronizando...' : 'Etiquetar Dados'}
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
