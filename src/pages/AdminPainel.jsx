import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Rocket, RefreshCw, Trash2, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
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

  // =========================================================================
  // LIMPEZA DEFINITIVA (Apaga o que está com status 'lixeira')
  // =========================================================================
  async function handleLimpezaTotal() {
    if (!window.confirm("Isso vai apagar DEFINITIVAMENTE todas as Instituições e Turmas que estão na lixeira. Confirma?")) return;
    setLimpando(true);
    try {
      const batch = writeBatch(db);
      
      const snapInst = await getDocs(collection(db, 'instituicoes'));
      snapInst.docs.forEach(d => { if (d.data().status === 'lixeira') batch.delete(d.ref); });

      const snapTurmas = await getDocs(collection(db, 'turmas'));
      snapTurmas.docs.forEach(d => { if (d.data().status === 'lixeira') batch.delete(d.ref); });

      await batch.commit();
      alert("Limpeza concluída! Os itens fantasmas sumiram.");
      window.location.reload();
    } catch (e) { alert("Erro ao limpar banco."); } finally { setLimpando(false); }
  }

  // =========================================================================
  // MIGRAÇÃO INTELIGENTE V1 -> V3
  // =========================================================================
  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Migrar dados V1 para o perfil de ${userEmail}?`)) return;
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
        batch.set(novoAluRef, { 
          nome: nomeReal, 
          turmaId: turmaRef.id, 
          instituicaoId: instRef.id, 
          professorUid: userUid, 
          status: 'ativo' 
        });
        mapaAlunosNovos[nomeReal] = novoAluRef.id;
      });

      snapAtivV1.docs.forEach((docAtiv) => {
        const d = docAtiv.data();
        const idNovo = mapaAlunosNovos[d.nomeAluno || d.nome];
        if (idNovo) {
          const novaAtivRef = doc(collection(db, 'atividades'));
          const temFeedback = d.feedbackFinal && d.feedbackFinal.trim() !== "";
          batch.set(novaAtivRef, {
            alunoId: idNovo,
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
      alert("🚀 Sucesso! Dados migrados e organizados.");
    } catch (e) { console.error(e); } finally { setMigrando(null); }
  }

  async function handleUpdateUser(userId, campo, valor) {
    setAtualizando(userId);
    try {
      await updateDoc(doc(db, 'usuarios', userId), { [campo]: valor });
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, [campo]: valor } : u));
    } catch (e) { alert("Erro ao atualizar."); } finally { setAtualizando(null); }
  }

  if (authLoading) return <div className="p-10 text-center">Carregando Auth...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShieldAlert className="text-yellow-500" /> Painel SaaS
          </h1>
          <p className="text-gray-500 text-sm">Controle de acessos e limpeza de dados</p>
        </div>
        <button 
          onClick={handleLimpezaTotal} 
          disabled={limpando} 
          className="flex items-center gap-2 bg-red-100 text-red-600 px-5 py-2.5 rounded-xl font-black text-xs hover:bg-red-200 transition-all shadow-sm"
        >
          <Trash2 size={16}/> {limpando ? 'Limpando...' : 'Esvaziar Lixeiras do Banco'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por e-mail..." 
            className="bg-transparent outline-none text-sm font-medium w-full"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase text-gray-400 border-b">
              <th className="p-4">Usuário</th>
              <th className="p-4">Plano</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.filter(u => u.email.includes(busca.toLowerCase())).map(u => (
              <tr key={u.id} className="border-t hover:bg-gray-50/50 transition-colors">
                <td className="p-4">
                  <p className="font-bold text-gray-800">{u.nome || 'Sem Nome'}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="p-4">
                  <select 
                    className="text-xs font-bold p-2 rounded-lg border bg-white" 
                    value={u.plano || 'basico'} 
                    onChange={(e) => handleUpdateUser(u.id, 'plano', e.target.value)}
                  >
                    <option value="basico">Básico</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="premium">Premium</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => handleMigrarDados(u.email, u.id)} 
                    disabled={migrando === u.id} 
                    className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 shadow-md active:scale-95 transition-all"
                  >
                    {migrando === u.id ? <RefreshCw className="animate-spin" size={16}/> : <Rocket size={16}/>}
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
