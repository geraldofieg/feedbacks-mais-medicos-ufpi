import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Search, Link as LinkIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
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
  // A PONTE DEFINITIVA: ETIQUETA DADOS RAIZ (SEM DEPENDER DE UID ANTIGO)
  // =========================================================================
  async function handleEtiquetarOriginais(userEmail, userUid) {
    if (!window.confirm(`Isso vai ETIQUETAR definitivamente os dados raiz para a V3 ler. Confirma?`)) return;
    setSincronizando(userUid);
    try {
      const batch = writeBatch(db);

      // PASSO 1: FAXINA TOTAL DOS CLONES DA V3
      const snapInst = await getDocs(collection(db, 'instituicoes'));
      snapInst.docs.forEach(d => { if (d.data().professorUid === userUid) batch.delete(d.ref); });

      const snapTurmas = await getDocs(collection(db, 'turmas'));
      snapTurmas.docs.forEach(d => { if (d.data().professorUid === userUid) batch.delete(d.ref); });

      // PASSO 2: CRIAR AS GAVETAS OFICIAIS DA V3
      const instRef = doc(collection(db, 'instituicoes'));
      batch.set(instRef, { 
        nome: "UFPI", 
        professorUid: userUid, 
        status: 'ativa', 
        dataCriacao: serverTimestamp() 
      });

      const turmaRef = doc(collection(db, 'turmas'));
      batch.set(turmaRef, { 
        nome: "Mais Médicos", 
        instituicaoId: instRef.id, 
        professorUid: userUid, 
        status: 'ativa' 
      });

      // PASSO 3: ETIQUETAR OS ORIGINAIS E MATAR CLONES
      let contAlunos = 0, contAtiv = 0, contTarefas = 0;

      const processarColecao = async (nomeColecao, tipo) => {
        const snap = await getDocs(collection(db, nomeColecao));
        snap.docs.forEach(d => {
          const data = d.data();
          
          // Se NÃO TEM instituicaoId, é DADO RAIZ DA V1. Etiqueta e dá a posse pra Patrícia!
          if (!data.instituicaoId) {
            batch.update(d.ref, { 
              instituicaoId: instRef.id, 
              turmaId: turmaRef.id, 
              professorUid: userUid 
            });
            if (tipo === 'aluno') contAlunos++;
            if (tipo === 'ativ') contAtiv++;
            if (tipo === 'tarefa') contTarefas++;
          } 
          // Se JÁ TEM instituicaoId e pertence à Patrícia, é um Clone de teste. Apaga pra não duplicar a V1!
          else if (data.instituicaoId && data.professorUid === userUid) {
            batch.delete(d.ref);
          }
        });
      };

      await processarColecao('alunos', 'aluno');
      await processarColecao('atividades', 'ativ');
      await processarColecao('tarefas', 'tarefa');

      await batch.commit();
      alert(`🔗 SUCESSO!\n\nDados Raiz Sincronizados com a V3:\n👤 ${contAlunos} Alunos\n📝 ${contAtiv} Atividades\n📅 ${contTarefas} Tarefas do Cronograma.`);
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
          <div className="bg-slate-900 text-yellow-400 p-3 rounded-xl shadow-lg shrink-0"><ShieldAlert size={28} /></div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Painel SaaS (Super Admin)</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Gestão de acessos e sincronização de dados.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                <th className="p-4 font-bold">Usuário</th>
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
                  
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleEtiquetarOriginais(user.email, user.id)}
                      disabled={sincronizando === user.id}
                      className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-xs font-black uppercase hover:bg-orange-600 transition-colors shadow-md disabled:opacity-50"
                    >
                      <LinkIcon size={16} />
                      {sincronizando === user.id ? 'Sincronizando...' : 'Etiquetar Dados V1'}
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
