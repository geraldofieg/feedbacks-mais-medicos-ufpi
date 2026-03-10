import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Crown, CheckCircle, XCircle, Search, Rocket, RefreshCw } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [atualizando, setAtualizando] = useState(null);
  const [migrando, setMigrando] = useState(null);

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

  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Rodar migração inteligente para ${userEmail}? Atividades sem feedback irão para 'Revisão'.`)) return;
    setMigrando(userUid);
    try {
      const snapAlunosV1 = await getDocs(collection(db, 'alunos'));
      const snapAtivV1 = await getDocs(collection(db, 'atividades'));

      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "UFPI - Mais Médicos (V3)",
        professorUid: userUid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      });

      const turmaRef = await addDoc(collection(db, 'turmas'), {
        nome: "Turma Integrada V1",
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa'
      });

      const batch = writeBatch(db);
      const mapaAlunosNovos = {};

      snapAlunosV1.docs.forEach((docAlu) => {
        const d = docAlu.data();
        const nomeReal = d.nome || d.nomeAluno || "Aluno Sem Nome";
        const novoAluRef = doc(collection(db, 'alunos'));
        batch.set(novoAluRef, { nome: nomeReal, matricula: d.matricula || "", turmaId: turmaRef.id, instituicaoId: instRef.id, professorUid: userUid, status: 'ativo' });
        mapaAlunosNovos[nomeReal] = novoAluRef.id;
      });

      snapAtivV1.docs.forEach((docAtiv) => {
        const d = docAtiv.data();
        const idDoNovoAluno = mapaAlunosNovos[d.nomeAluno || d.nome];
        if (idDoNovoAluno) {
          const novaAtivRef = doc(collection(db, 'atividades'));
          // LÓGICA INTELIGENTE: Se não tem feedback final, status é 'pendente'
          const temFeedback = d.feedbackFinal && d.feedbackFinal.trim() !== "";
          batch.set(novaAtivRef, {
            alunoId: idDoNovoAluno,
            turmaId: turmaRef.id,
            instituicaoId: instRef.id,
            professorUid: userUid,
            resposta: d.resposta || "",
            feedbackSugerido: d.feedbackIA || "",
            feedbackFinal: d.feedbackFinal || "",
            status: temFeedback ? 'aprovado' : 'pendente',
            postado: temFeedback ? true : false,
            dataAprovacao: temFeedback ? serverTimestamp() : null
          });
        }
      });

      await batch.commit();
      alert("🚀 Migração Finalizada! As pendências agora estão separadas do histórico.");
    } catch (e) { console.error(e); } finally { setMigrando(null); }
  }

  async function handleUpdateUser(userId, campo, valor) {
    setAtualizando(userId);
    try {
      await updateDoc(doc(db, 'usuarios', userId), { [campo]: valor });
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, [campo]: valor } : u));
    } catch (error) { alert("Erro ao atualizar."); } finally { setAtualizando(null); }
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-slate-900"></div></div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8 border-b pb-6">
        <div className="bg-slate-900 text-yellow-400 p-3 rounded-xl shadow-lg"><ShieldAlert size={28} /></div>
        <div>
          <h1 className="text-2xl font-black text-gray-800">Painel SaaS (Super Admin)</h1>
          <p className="text-sm font-medium text-gray-500">Gestão completa de usuários e migração.</p>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div><p className="text-xs font-bold text-gray-400 uppercase">Usuários</p><h3 className="text-3xl font-black">{usuarios.length}</h3></div>
          <Users className="text-blue-500" />
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
           <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              <Search size={16} className="text-gray-400 mr-2"/><input type="text" placeholder="Buscar..." className="w-full text-sm bg-transparent outline-none" value={busca} onChange={(e) => setBusca(e.target.value)} />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                <th className="p-4 font-bold">Usuário</th>
                <th className="p-4 font-bold">Plano</th>
                <th className="p-4 font-bold">Nível</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Migração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.filter(u => u.email.includes(busca)).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{user.nome || 'Sem Nome'}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </td>
                  <td className="p-4">
                    <select className="text-sm font-bold p-2 rounded-lg border bg-white" value={user.plano || 'basico'} onChange={(e) => handleUpdateUser(user.id, 'plano', e.target.value)}>
                      <option value="basico">Tier 1: Básico</option>
                      <option value="intermediario">Tier 2: Intermediário</option>
                      <option value="premium">Tier 3: Premium</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select className="text-sm font-bold p-2 rounded-lg border bg-white" value={user.role || 'professor'} onChange={(e) => handleUpdateUser(user.id, 'role', e.target.value)}>
                      <option value="professor">Professor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleUpdateUser(user.id, 'status', user.status === 'bloqueado' ? 'ativo' : 'bloqueado')} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${user.status === 'bloqueado' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                      {user.status === 'bloqueado' ? 'Bloqueado' : 'Liberado'}
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleMigrarDados(user.email, user.id)} disabled={migrando === user.id} className="bg-purple-600 text-white p-2 rounded-xl hover:bg-purple-700 disabled:opacity-50">
                      {migrando === user.id ? <RefreshCw className="animate-spin" size={16}/> : <Rocket size={16} />}
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
