import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch, query } from 'firebase/firestore';
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

  // =========================================================================
  // MOTOR DE MIGRAÇÃO INTELIGENTE (V1 -> V3)
  // =========================================================================
  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Deseja rodar a migração inteligente para ${userEmail}?`)) return;
    
    setMigrando(userUid);
    console.log("🚀 Iniciando Migração Inteligente...");

    try {
      // 1. Defina aqui os nomes das coleções da V1 (Confira no seu Firebase!)
      const NOME_COLECAO_ALUNOS_V1 = 'alunos'; 
      const NOME_COLECAO_ATIVIDADES_V1 = 'atividades';

      const snapAlunosV1 = await getDocs(collection(db, NOME_COLECAO_ALUNOS_V1));
      const snapAtivV1 = await getDocs(collection(db, NOME_COLECAO_ATIVIDADES_V1));

      console.log(`📊 V1 Encontrada: ${snapAlunosV1.docs.length} alunos e ${snapAtivV1.docs.length} atividades.`);

      // 2. Cria a Estrutura na V3
      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "Unasus Piauí (Migração Real)",
        professorUid: userUid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      });

      const turmaRef = await addDoc(collection(db, 'turmas'), {
        nome: "Turma Consolidada V1",
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa'
      });

      const tarefaRef = await addDoc(collection(db, 'tarefas'), {
        nomeTarefa: "Atividades Migradas da V1",
        turmaId: turmaRef.id,
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa',
        tipo: 'entrega',
        dataFim: serverTimestamp()
      });

      const batch = writeBatch(db);
      const mapaAlunosNovos = {};

      // 3. Migrar Alunos (Detectando Nome)
      snapAlunosV1.docs.forEach((docAlu) => {
        const d = docAlu.data();
        // Tenta achar o nome em várias gavetas possíveis
        const nomeReal = d.nome || d.nomeAluno || d.aluno || d.estudante || "Aluno Sem Nome";
        
        const novoAluRef = doc(collection(db, 'alunos'));
        batch.set(novoAluRef, {
          nome: nomeReal,
          matricula: d.matricula || "",
          turmaId: turmaRef.id,
          instituicaoId: instRef.id,
          professorUid: userUid, // Garante que a Patrícia seja a dona
          status: 'ativo'
        });
        // Guarda no mapa para vincular as atividades depois
        mapaAlunosNovos[nomeReal] = novoAluRef.id;
      });

      // 4. Migrar Atividades (O Coração do Problema)
      let atividadesVinculadas = 0;
      snapAtivV1.docs.forEach((docAtiv) => {
        const d = docAtiv.data();
        // Procura quem é o dono dessa atividade na V1
        const nomeNoDocAtividade = d.nomeAluno || d.nome || d.aluno || d.estudante;
        const idDoNovoAluno = mapaAlunosNovos[nomeNoDocAtividade];

        if (idDoNovoAluno) {
          const novaAtivRef = doc(collection(db, 'atividades'));
          batch.set(novaAtivRef, {
            alunoId: idDoNovoAluno,
            tarefaId: tarefaRef.id,
            turmaId: turmaRef.id,
            instituicaoId: instRef.id,
            professorUid: userUid, // Importante para o Dashboard da Patrícia ver
            resposta: d.resposta || "",
            feedbackSugerido: d.feedbackIA || d.feedbackSugerido || "",
            feedbackFinal: d.feedbackFinal || d.feedbackIA || "",
            status: 'aprovado',
            postado: true,
            dataAprovacao: serverTimestamp()
          });
          atividadesVinculadas++;
        }
      });

      await batch.commit();
      console.log(`✅ Migração concluída! ${atividadesVinculadas} atividades vinculadas.`);
      alert(`🚀 Sucesso! ${atividadesVinculadas} atividades foram migradas para a Patrícia.`);
      
    } catch (e) {
      console.error("❌ Erro na migração:", e);
      alert("Erro crítico na migração. Olhe o console (F12).");
    } finally {
      setMigrando(null);
    }
  }
  // =========================================================================

  async function handleUpdateUser(userId, campo, valor) {
    setAtualizando(userId);
    try {
      await updateDoc(doc(db, 'usuarios', userId), { [campo]: valor });
      setUsuarios(usuarios.map(u => u.id === userId ? { ...u, [campo]: valor } : u));
    } catch (error) { alert("Erro ao atualizar."); } finally { setAtualizando(null); }
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-slate-900"></div></div>;
  if (!isAdmin) return <Navigate to="/" />;

  const usuariosFiltrados = usuarios.filter(u => (u.nome || '').toLowerCase().includes(busca.toLowerCase()) || (u.email || '').toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-gray-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 text-yellow-400 p-3 rounded-xl shadow-lg"><ShieldAlert size={28} /></div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">Painel SaaS (Super Admin)</h1>
            <p className="text-sm font-medium text-gray-500">Gestão e Migração V1 ➔ V3</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <th className="p-4 font-bold">Usuário</th>
              <th className="p-4 font-bold">Ações Especiais</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 border-b border-gray-100">
                <td className="p-4">
                  <p className="font-bold text-gray-900">{user.nome || 'Sem Nome'}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </td>
                <td className="p-4">
                  <button 
                    onClick={() => handleMigrarDados(user.email, user.id)}
                    disabled={migrando === user.id}
                    className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl font-black text-xs hover:bg-purple-700 transition-all disabled:opacity-50 shadow-md"
                  >
                    {migrando === user.id ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
                    MIGRAR DADOS V1
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
