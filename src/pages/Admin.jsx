import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, query, getDocs, doc, updateDoc, addDoc, serverTimestamp, writeBatch, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Users, Crown, Search, CheckCircle2, AlertCircle, Rocket } from 'lucide-react';

export default function Admin() {
  const { currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrando, setMigrando] = useState(false);

  // BUSCA USUÁRIOS
  useEffect(() => {
    async function fetchUsuarios() {
      try {
        const q = query(collection(db, 'usuarios'));
        const snap = await getDocs(q);
        setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    fetchUsuarios();
  }, []);

  // FUNÇÃO MÁGICA DE MIGRAÇÃO
  async function handleMigrarDados(userEmail, userUid) {
    if (!window.confirm(`Iniciar migração de dados da V1 para ${userEmail}? Isso criará novas instituições e turmas na V3.`)) return;
    
    setMigrando(true);
    try {
      // 1. DEFINA AQUI OS NOMES DAS SUAS COLEÇÕES DA V1
      const NOME_COLECAO_ALUNOS_V1 = 'alunos'; 
      const NOME_COLECAO_ATIVIDADES_V1 = 'atividades';

      // 2. BUSCA TUDO DA V1 NO FIREBASE
      const snapAlunosV1 = await getDocs(collection(db, NOME_COLECAO_ALUNOS_V1));
      const snapAtivV1 = await getDocs(collection(db, NOME_COLECAO_ATIVIDADES_V1));

      // 3. CRIA A INSTITUIÇÃO "MÃE" NA V3
      const instRef = await addDoc(collection(db, 'instituicoes'), {
        nome: "Unasus Piauí (Migrado V1)",
        professorUid: userUid,
        status: 'ativa',
        dataCriacao: serverTimestamp()
      });

      // 4. CRIA UMA TURMA PADRÃO
      const turmaRef = await addDoc(collection(db, 'turmas'), {
        nome: "Turma Migrada V1",
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa'
      });

      // 5. CRIA UMA TAREFA "MÃE" PARA AS ATIVIDADES
      const tarefaRef = await addDoc(collection(db, 'tarefas'), {
        nomeTarefa: "Atividades Consolidadas V1",
        turmaId: turmaRef.id,
        instituicaoId: instRef.id,
        professorUid: userUid,
        status: 'ativa',
        tipo: 'entrega'
      });

      // 6. MIGRA OS ALUNOS E ATIVIDADES (Batch para ser rápido e seguro)
      const batch = writeBatch(db);
      
      // Mapeamento para não duplicar alunos
      const mapaAlunosNovos = {};

      for (const docAlu of snapAlunosV1.docs) {
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
      }

      for (const docAtiv of snapAtivV1.docs) {
        const ativV1 = docAtiv.data();
        const idDoNovoAluno = mapaAlunosNovos[ativV1.nomeAluno] || null;

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
      }

      await batch.commit();
      alert("🚀 Sucesso! Dados migrados. Patrícia já pode ver tudo no Dashboard dela.");
    } catch (e) {
      console.error(e);
      alert("Erro na migração. Verifique o console.");
    } finally {
      setMigrando(false);
    }
  }

  // TROCA DE PLANO
  async function handleMudarPlano(id, novoPlano) {
    try {
      await updateDoc(doc(db, 'usuarios', id), { plano: novoPlano });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, plano: novoPlano } : u));
    } catch (e) { alert("Erro ao mudar plano"); }
  }

  if (loading) return <div className="p-10 text-center font-bold">Carregando Painel...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg"><ShieldCheck size={28} /></div>
        <div>
          <h1 className="text-2xl font-black text-gray-800">Painel SaaS (Super Admin)</h1>
          <p className="text-sm text-gray-500 font-medium">Gestão de acessos e migração de dados.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs font-black text-gray-400 uppercase">Usuário</th>
              <th className="p-4 text-xs font-black text-gray-400 uppercase">Plano SaaS</th>
              <th className="p-4 text-xs font-black text-gray-400 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(user => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-4">
                  <p className="font-black text-gray-800">{user.nome || 'Sem nome'}</p>
                  <p className="text-xs text-gray-400 font-medium">{user.email}</p>
                </td>
                <td className="p-4">
                  <select 
                    value={user.plano} 
                    onChange={(e) => handleMudarPlano(user.id, e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg py-1.5 px-3 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="basico">Tier 1: Básico</option>
                    <option value="intermediario">Tier 2: Intermediário</option>
                    <option value="premium">Tier 3: Premium</option>
                  </select>
                </td>
                <td className="p-4">
                  {/* BOTÃO DE MIGRAÇÃO SÓ PARA A PATRÍCIA (Ou outros usuários legados) */}
                  <button 
                    onClick={() => handleMigrarDados(user.email, user.id)}
                    disabled={migrando}
                    className="flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-black text-xs hover:bg-purple-200 transition-all disabled:opacity-50"
                  >
                    <Rocket size={14} /> {migrando ? 'Migrando...' : 'MIGRAR V1'}
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
