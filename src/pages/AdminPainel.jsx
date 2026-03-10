import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Rocket, RefreshCw, Trash2, Search } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const [migrando, setMigrando] = useState(null);
  const [limpando, setLimpando] = useState(false);

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin || authLoading) return;
      const querySnapshot = await getDocs(collection(db, 'usuarios'));
      setUsuarios(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    fetchUsuarios();
  }, [isAdmin, authLoading]);

  // =========================================================================
  // RESET TOTAL (Apaga o lixo da V3, preserva a V1 intacta)
  // =========================================================================
  async function handleNukeV3() {
    if (!window.confirm("🔴 PERIGO: Isso vai DELETAR todas as Instituições, Turmas e Testes gerados na V3. Os dados originais da V1 não serão tocados. Confirma?")) return;
    setLimpando(true);
    try {
      const deleteQuery = async (colName, filterFn) => {
        const q = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        let deleted = 0;
        q.docs.forEach(d => {
          if (!filterFn || filterFn(d.data())) { batch.delete(d.ref); deleted++; }
        });
        if (deleted > 0) await batch.commit();
      };

      // Apaga Instituições (todas são V3)
      await deleteQuery('instituicoes');
      
      // Apaga o resto APENAS se tiver 'instituicaoId' (A prova de que é da V3)
      await deleteQuery('turmas', (data) => !!data.instituicaoId);
      await deleteQuery('tarefas', (data) => !!data.instituicaoId);
      await deleteQuery('alunos', (data) => !!data.instituicaoId);
      await deleteQuery('atividades', (data) => !!data.instituicaoId);

      alert("💥 BOOM! A V3 foi resetada. O banco está limpo e a V1 está segura.");
      window.location.reload();
    } catch(e) { alert("Erro: " + e.message); } finally { setLimpando(false); }
  }

  // =========================================================================
  // MIGRAÇÃO DEFINITIVA
  // =========================================================================
  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Iniciar migração oficial para ${userEmail}?`)) return;
    setMigrando(userUid);
    try {
      const snapAlunosV1 = await getDocs(collection(db, 'alunos'));
      const snapAtivV1 = await getDocs(collection(db, 'atividades'));

      const instRef = await addDoc(collection(db, 'instituicoes'), { nome: "UFPI - Mais Médicos (OFICIAL)", professorUid: userUid, status: 'ativa', dataCriacao: serverTimestamp() });
      const turmaRef = await addDoc(collection(db, 'turmas'), { nome: "Turma Integrada V1", instituicaoId: instRef.id, professorUid: userUid, status: 'ativa' });
      const tarefaRef = await addDoc(collection(db, 'tarefas'), { nomeTarefa: "Atividades V1", turmaId: turmaRef.id, instituicaoId: instRef.id, professorUid: userUid, status: 'ativa', tipo: 'entrega' });

      const batch = writeBatch(db);
      const mapaAlunosNovos = {};
      let contAlunos = 0;
      let contAtiv = 0;

      snapAlunosV1.docs.forEach((docAlu) => {
        const d = docAlu.data();
        if (d.instituicaoId) return; // Pula se por acaso ler algo da V3
        const nomeReal = d.nome || d.nomeAluno || d.aluno || d.estudante || "Aluno Sem Nome";
        const novoAluRef = doc(collection(db, 'alunos'));
        batch.set(novoAluRef, { nome: nomeReal, matricula: d.matricula || "", turmaId: turmaRef.id, instituicaoId: instRef.id, professorUid: userUid, status: 'ativo' });
        mapaAlunosNovos[nomeReal] = novoAluRef.id;
        contAlunos++;
      });

      snapAtivV1.docs.forEach((docAtiv) => {
        const d = docAtiv.data();
        if (d.instituicaoId) return; // Pula se ler algo da V3
        const nomeNaAtiv = d.nomeAluno || d.nome || d.aluno || d.estudante;
        const idNovo = mapaAlunosNovos[nomeNaAtiv];

        if (idNovo) {
          const novaAtivRef = doc(collection(db, 'atividades'));
          const temFeedback = d.feedbackFinal && String(d.feedbackFinal).trim() !== "";
          batch.set(novaAtivRef, {
            alunoId: idNovo,
            tarefaId: tarefaRef.id,
            turmaId: turmaRef.id,
            instituicaoId: instRef.id,
            professorUid: userUid,
            resposta: d.resposta || "",
            feedbackSugerido: d.feedbackIA || d.feedbackSugerido || "",
            feedbackFinal: d.feedbackFinal || d.feedbackIA || "",
            status: temFeedback ? 'aprovado' : 'pendente',
            postado: temFeedback,
            dataAprovacao: temFeedback ? serverTimestamp() : null
          });
          contAtiv++;
        }
      });

      await batch.commit();
      alert(`🚀 SUCESSO ABSOLUTO! \n\nMigramos:\n👤 ${contAlunos} Alunos\n📝 ${contAtiv} Atividades.`);
      window.location.reload();
    } catch (e) { alert("Erro na migração."); console.error(e); } finally { setMigrando(null); }
  }

  async function handleUpdateUser(userId, campo, valor) {
    try {
      await updateDoc(doc(db, 'usuarios', userId), { [campo]: valor });
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, [campo]: valor } : u));
    } catch (error) { alert("Erro ao atualizar."); }
  }

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8 border-b pb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><ShieldAlert className="text-yellow-500" /> Painel SaaS</h1>
        </div>
        <button onClick={handleNukeV3} disabled={limpando} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg">
          <Trash2 size={16}/> {limpando ? 'Resetando...' : 'RESETAR DADOS DA V3'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <th className="p-4 font-bold">Usuário</th>
              <th className="p-4 font-bold text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t hover:bg-gray-50/50 transition-colors">
                <td className="p-4"><p className="font-bold text-gray-800">{u.nome || 'Sem Nome'}</p><p className="text-xs text-gray-400">{u.email}</p></td>
                <td className="p-4 text-center">
                  <button onClick={() => handleMigrarDados(u.email, u.id)} disabled={migrando === u.id} className="bg-purple-600 text-white px-6 py-2 rounded-xl font-black text-xs hover:bg-purple-700 shadow-md">
                    {migrando === u.id ? <RefreshCw className="animate-spin inline mr-2" size={14}/> : <Rocket className="inline mr-2" size={14}/>}
                    MIGRAR DADOS
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
