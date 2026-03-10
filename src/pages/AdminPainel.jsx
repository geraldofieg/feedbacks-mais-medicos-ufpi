import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, Users, Rocket, RefreshCw, Trash2, Search, AlertTriangle } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function AdminPainel() {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  const [usuarios, setUsuarios] = useState([]);
  const [instituicoes, setInstituicoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrando, setMigrando] = useState(null);

  async function carregarDados() {
    if (!isAdmin || authLoading) return;
    setLoading(true);
    try {
      const qUsers = await getDocs(collection(db, 'usuarios'));
      setUsuarios(qUsers.docs.map(d => ({ id: d.id, ...d.data() })));

      const qInst = await getDocs(collection(db, 'instituicoes'));
      setInstituicoes(qInst.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { carregarDados(); }, [isAdmin, authLoading]);

  // DELETAR TUDO DE UMA INSTITUIÇÃO (Para limpar o lixo)
  async function handleDeletarInstituicao(id, nome) {
    if (!window.confirm(`Apagar DEFINITIVAMENTE a instituição "${nome}" e todos os seus dados?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'instituicoes', id));
      
      // Busca turmas, alunos e atividades dessa inst para apagar tmb
      const colecoes = ['turmas', 'alunos', 'atividades', 'tarefas'];
      for (const col of colecoes) {
        const q = await getDocs(collection(db, col));
        q.docs.forEach(d => { if (d.data().instituicaoId === id) batch.delete(d.ref); });
      }
      
      await batch.commit();
      alert("Instituição removida do mapa!");
      carregarDados();
    } catch (e) { alert("Erro ao deletar."); }
  }

  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Rodar migração definitiva para ${userEmail}?`)) return;
    setMigrando(userUid);
    try {
      // 1. Puxa os dados da V1 (Confirme se os nomes são esses no seu Firebase)
      const snapAlunosV1 = await getDocs(collection(db, 'alunos'));
      const snapAtivV1 = await getDocs(collection(db, 'atividades'));

      // 2. Cria a única e oficial Instituição V3
      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "UFPI - Mais Médicos (OFICIAL V3)",
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

      // 3. Migra Alunos
      snapAlunosV1.docs.forEach((docAlu) => {
        const d = docAlu.data();
        if (d.instituicaoId) return; // Pula se já for um dado da V3
        const nomeReal = d.nome || d.nomeAluno || "Aluno";
        const novoAluRef = doc(collection(db, 'alunos'));
        batch.set(novoAluRef, { nome: nomeReal, turmaId: turmaRef.id, instituicaoId: instRef.id, professorUid: userUid, status: 'ativo' });
        mapaAlunosNovos[nomeReal] = novoAluRef.id;
      });

      // 4. Migra Atividades com lógica de status
      snapAtivV1.docs.forEach((docAtiv) => {
        const d = docAtiv.data();
        if (d.instituicaoId) return; // Pula se já for V3
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
            feedbackFinal: d.feedbackFinal || "",
            status: temFeedback ? 'aprovado' : 'pendente',
            postado: temFeedback ? true : false
          });
        }
      });

      await batch.commit();
      alert("🚀 MÁGICA FEITA! Dados migrados para 'OFICIAL V3'.");
      carregarDados();
    } catch (e) { console.error(e); } finally { setMigrando(null); }
  }

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-black mb-8 flex items-center gap-2"><ShieldAlert className="text-yellow-500" /> Painel de Controle SaaS</h1>

      <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl mb-8">
        <h2 className="text-red-800 font-black flex items-center gap-2 mb-4"><Trash2 size={20}/> Limpeza de Instituições Fantasmas</h2>
        <p className="text-red-700 text-sm mb-4">Apague todas as instituições de teste abaixo antes de migrar novamente.</p>
        <div className="grid gap-2">
          {instituicoes.map(inst => (
            <div key={inst.id} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center">
              <span className="font-bold text-gray-700">{inst.nome}</span>
              <button onClick={() => handleDeletarInstituicao(inst.id, inst.nome)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs uppercase text-gray-400"><th className="p-4">Usuário</th><th className="p-4 text-center">Migrar V1</th></thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-4"><p className="font-bold">{u.nome}</p><p className="text-xs text-gray-400">{u.email}</p></td>
                <td className="p-4 text-center">
                  <button onClick={() => handleMigrarDados(u.email, u.id)} disabled={migrando === u.id} className="bg-purple-600 text-white p-2 rounded-xl hover:bg-purple-700 shadow-md">
                    {migrando === u.id ? <RefreshCw className="animate-spin" size={18}/> : <Rocket size={18}/>}
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
