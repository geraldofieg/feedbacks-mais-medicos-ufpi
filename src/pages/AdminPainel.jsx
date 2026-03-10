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
  const [migrando, setMigrando] = useState(null); // Armazena o ID do usuário que está sendo migrado

  useEffect(() => {
    async function fetchUsuarios() {
      if (!isAdmin || authLoading) return;
      try {
        const querySnapshot = await getDocs(collection(db, 'usuarios'));
        const lista = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setUsuarios(lista);
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsuarios();
  }, [isAdmin, authLoading]);

  // =========================================================================
  // MOTOR DE MIGRAÇÃO (V1 -> V3)
  // =========================================================================
  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`ATENÇÃO: Deseja migrar os dados da V1 para o perfil de ${userEmail}? Isso criará novas Instituições e Turmas na estrutura V3.`)) return;
    
    setMigrando(userUid);
    try {
      // 1. Nomes das coleções da V1 no seu Firebase
      const NOME_COLECAO_ALUNOS_V1 = 'alunos'; 
      const NOME_COLECAO_ATIVIDADES_V1 = 'atividades';

      // 2. Busca os dados brutos da V1
      const snapAlunosV1 = await getDocs(collection(db, NOME_COLECAO_ALUNOS_V1));
      const snapAtivV1 = await getDocs(collection(db, NOME_COLECAO_ATIVIDADES_V1));

      // 3. Cria a Estrutura Hierárquica na V3
      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "Unasus Piauí (Importado V1)",
        professorUid: userUid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      });

      const turmaRef = await addDoc(collection(db, 'turmas'), {
        nome: "Turma Migrada V1",
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa'
      });

      const tarefaRef = await addDoc(collection(db, 'tarefas'), {
        nomeTarefa: "Histórico Consolidado V1",
        turmaId: turmaRef.id,
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa',
        tipo: 'entrega',
        dataFim: serverTimestamp()
      });

      // 4. Migração em Lote (Batch) para proteger seu limite do Firebase
      const batch = writeBatch(db);
      const mapaAlunosNovos = {};

      // Criar Alunos
      snapAlunosV1.docs.forEach((docAlu) => {
        const aluV1 = docAlu.data();
        const novoAluRef = doc(collection(db, 'alunos'));
        batch.set(novoAluRef, {
          nome: aluV1.nome || "Aluno Sem Nome",
          matricula: aluV1.matricula || "",
          turmaId: turmaRef.id,
          instituicaoId: instRef.id,
          status: 'ativo'
        });
        mapaAlunosNovos[aluV1.nome] = novoAluRef.id;
      });

      // Criar Atividades Vinculadas
      snapAtivV1.docs.forEach((docAtiv) => {
        const ativV1 = docAtiv.data();
        const idDoNovoAluno = mapaAlunosNovos[ativV1.nomeAluno];

        if (idDoNovoAluno) {
          const novaAtivRef = doc(collection(db, 'atividades'));
          batch.set(novaAtivRef, {
            alunoId: idDoNovoAluno,
            tarefaId: tarefaRef.id,
            turmaId: turmaRef.id,
            instituicaoId: instRef.id,
            resposta: ativV1.resposta || "",
            feedbackSugerido: ativV1.feedbackIA || "",
            feedbackFinal: ativV1.feedbackFinal || ativV1.feedbackIA || "",
            status: 'aprovado',
            postado: true,
            dataAprovacao: serverTimestamp()
          });
        }
      });

      await batch.commit();
      alert("🚀 Sucesso total! Dados migrados para a estrutura V3.");
    } catch (e) {
      console.error(e);
      alert("Erro na migração. Verifique se os nomes das coleções V1 estão corretos.");
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
    } catch (error) {
      alert("Erro ao atualizar usuário.");
    } finally {
      setAtualizando(null);
    }
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-slate-900"></div></div>;
  if (!isAdmin) return <Navigate to="/" />;

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
            <p className="text-sm font-medium text-gray-500 mt-1">Gestão de acessos, assinaturas e migração de dados.</p>
          </div>
        </div>
      </div>

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
            <div className="flex items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase tracking-widest text-gray-500 border-b border-gray-200">
                <th className="p-4 font-bold">Usuário</th>
                <th className="p-4 font-bold">Plano SaaS</th>
                <th className="p-4 font-bold">Nível (Role)</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-center">Ações Especiais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuariosFiltrados.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-gray-900">{user.nome || 'Sem Nome'}</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">{user.email}</p>
                  </td>
                  <td className="p-4">
                    <select 
                      className="text-sm font-bold p-2.5 rounded-lg border outline-none bg-white"
                      value={user.plano || 'basico'}
                      onChange={(e) => handleUpdateUser(user.id, 'plano', e.target.value)}
                    >
                      <option value="basico">Tier 1: Básico</option>
                      <option value="intermediario">Tier 2: Intermediário</option>
                      <option value="premium">Tier 3: Premium (IA)</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <select 
                      className="text-sm font-bold p-2.5 rounded-lg border outline-none bg-white"
                      value={user.role || 'professor'}
                      onChange={(e) => handleUpdateUser(user.id, 'role', e.target.value)}
                    >
                      <option value="professor">Professor</option>
                      <option value="admin">Gestor (Admin)</option>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleUpdateUser(user.id, 'status', user.status === 'bloqueado' ? 'ativo' : 'bloqueado')}
                      className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider border ${user.status === 'bloqueado' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}
                    >
                      {user.status === 'bloqueado' ? 'Bloqueado' : 'Liberado'}
                    </button>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleMigrarDados(user.email, user.id)}
                      disabled={migrando === user.id}
                      className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-purple-700 transition-all disabled:opacity-50 shadow-md active:scale-95"
                    >
                      {migrando === user.id ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
                      {migrando === user.id ? 'Migrando...' : 'Migrar Dados V1'}
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
