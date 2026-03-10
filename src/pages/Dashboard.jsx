import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Rocket, RefreshCw, Trash2, Search, Crown, CheckCircle, XCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [atualizando, setAtualizando] = useState(null);
  const [migrando, setMigrando] = useState(null);
  const [limpando, setLimpando] = useState(false);

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin || authLoading) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'usuarios'));
        setUsuarios(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchUsuarios();
  }, [isAdmin, authLoading]);

  // FAXINA: Apaga definitivamente o que está com status 'lixeira'
  async function handleLimpezaTotal() {
    if (!window.confirm("ATENÇÃO: Isso vai APAGAR PARA SEMPRE todas as Instituições e Turmas que você enviou para a lixeira. Confirma?")) return;
    setLimpando(true);
    try {
      const batch = writeBatch(db);
      const snapInst = await getDocs(collection(db, 'instituicoes'));
      snapInst.docs.forEach(d => { if (d.data().status === 'lixeira') batch.delete(d.ref); });
      const snapTurmas = await getDocs(collection(db, 'turmas'));
      snapTurmas.docs.forEach(d => { if (d.data().status === 'lixeira') batch.delete(d.ref); });
      await batch.commit();
      alert("🧹 Banco de dados limpo! Os itens fantasmas sumiram.");
      window.location.reload();
    } catch (e) { alert("Erro na limpeza."); } finally { setLimpando(false); }
  }

  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Rodar migração V1 para ${userEmail}? Atividades sem feedback irão para 'Revisão'.`)) return;
    setMigrando(userUid);
    try {
      const snapAlunosV1 = await getDocs(collection(db, 'alunos'));
      const snapAtivV1 = await getDocs(collection(db, 'atividades'));

      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "UFPI - Mais Médicos (V3 Oficial)",
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
        if (d.status === 'lixeira') return;
        const nomeReal = d.nome || d.nomeAluno || "Aluno";
        const novoAluRef = doc(collection(db, 'alunos'));
        batch.set(novoAluRef, { nome: nomeReal, turmaId: turmaRef.id, instituicaoId: instRef.id, professorUid: userUid, status: 'ativo' });
        mapaAlunosNovos[nomeReal] = novoAluRef.id;
      });

      snapAtivV1.docs.forEach((docAtiv) => {
        const d = docAtiv.data();
        const idDoNovoAluno = mapaAlunosNovos[d.nomeAluno || d.nome];
        if (idDoNovoAluno) {
          const novaAtivRef = doc(collection(db, 'atividades'));
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
            postado: temFeedback,
            dataAprovacao: temFeedback ? serverTimestamp() : null
          });
        }
      });

      await batch.commit();
      alert("🚀 Migração Finalizada!");
    } catch (e) { console.error(e); } finally { setMigrando(null); }
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
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <h1 className="text-2xl font-black flex items-center gap-2"><ShieldAlert className="text-yellow-500" /> Painel SaaS</h1>
        <button onClick={handleLimpezaTotal} disabled={limpando} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-200 transition-all flex items-center gap-2">
          <Trash2 size={18}/> {limpando ? 'Limpando...' : 'Esvaziar Lixeiras do Banco'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input type="text" placeholder="Filtrar usuário..." className="bg-transparent outline-none text-sm font-medium" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <th className="p-4 font-bold">Usuário</th>
              <th className="p-4 font-bold">Plano</th>
              <th className="p-4 font-bold text-center">Acesso</th>
              <th className="p-4 text-center font-bold">Migração</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {usuarios.filter(u => u.email.includes(busca.toLowerCase())).map(user => (
              <tr key={user.id} className="hover:bg-gray-50/50">
                <td className="p-4"><p className="font-bold text-gray-800">{user.nome || 'Sem Nome'}</p><p className="text-xs text-gray-400">{user.email}</p></td>
                <td className="p-4">
                  <select className="text-xs font-bold p-2 rounded-lg border bg-white" value={user.plano || 'basico'} onChange={e => handleUpdateUser(user.id, 'plano', e.target.value)}>
                    <option value="basico">Básico</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => handleUpdateUser(user.id, 'status', user.status === 'bloqueado' ? 'ativo' : 'bloqueado')} className={`px-3 py-1.5 rounded-lg text-xs font-black border ${user.status === 'bloqueado' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {user.status === 'bloqueado' ? 'Bloqueado' : 'Liberado'}
                  </button>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => handleMigrarDados(user.email, user.id)} disabled={migrando === user.id} className="bg-purple-600 text-white p-2 rounded-xl hover:bg-purple-700">
                    {migrando === user.id ? <RefreshCw className="animate-spin" size={16}/> : <Rocket size={16} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
