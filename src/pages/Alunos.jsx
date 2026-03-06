import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Search, GraduationCap, Trash2, Pencil, Check, X } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Alunos() {
  const { currentUser, escolaSelecionada } = useAuth();
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [novoAluno, setNovoAluno] = useState({ nome: '', turmaId: '' });
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!currentUser || !escolaSelecionada?.id) return;
      try {
        // Busca Turmas usando o ID da Instituição
        const qT = query(collection(db, 'turmas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const snapT = await getDocs(qT);
        const turmasData = snapT.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);

        // Busca Alunos usando o ID da Instituição
        const qA = query(collection(db, 'alunos'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapA = await getDocs(qA);
        const alunosData = snapA.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira');
        setAlunos(alunosData);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentUser, escolaSelecionada]);

  async function handleCadastrar(e) {
    e.preventDefault();
    if (!novoAluno.nome || !novoAluno.turmaId) return;

    try {
      setSalvando(true);
      const docRef = await addDoc(collection(db, 'alunos'), {
        nome: novoAluno.nome,
        turmaId: novoAluno.turmaId,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativo',
        dataCriacao: serverTimestamp()
      });

      setAlunos([{ id: docRef.id, ...novoAluno }, ...alunos]);
      setNovoAluno({ nome: '', turmaId: '' });
    } catch (error) {
      console.error("Erro ao cadastrar aluno:", error);
    } finally {
      setSalvando(false);
    }
  }

  const alunosFiltrados = alunos.filter(a => 
    a.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Alunos' }]} />
      
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-green-100 text-green-700 p-3 rounded-xl">
          <Users size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-800">Gestão de Alunos</h1>
          <p className="text-gray-500 text-sm font-medium">{escolaSelecionada?.nome}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-500 uppercase mb-4">Novo Aluno</h2>
            <form onSubmit={handleCadastrar} className="space-y-4">
              <input
                type="text" placeholder="Nome do aluno" required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                value={novoAluno.nome} onChange={e => setNovoAluno({...novoAluno, nome: e.target.value})}
              />
              <select 
                required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                value={novoAluno.turmaId} onChange={e => setNovoAluno({...novoAluno, turmaId: e.target.value})}
              >
                <option value="">Selecionar Turma</option>
                {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
              <button disabled={salvando} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                <UserPlus size={18}/> {salvando ? 'Salvando...' : 'Cadastrar'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                  <input 
                    type="text" placeholder="Buscar aluno..." 
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={busca} onChange={e => setBusca(e.target.value)}
                  />
                </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-gray-50 text-gray-400 text-xs uppercase font-bold">
                     <th className="px-6 py-4">Nome do Aluno</th>
                     <th className="px-6 py-4">Turma</th>
                     <th className="px-6 py-4 text-right">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {alunosFiltrados.map(aluno => (
                     <tr key={aluno.id} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4 font-bold text-gray-700">{aluno.nome}</td>
                       <td className="px-6 py-4">
                         <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs font-bold">
                           {turmas.find(t => t.id === aluno.turmaId)?.nome || 'Turma não encontrada'}
                         </span>
                       </td>
                       <td className="px-6 py-4 text-right">
                         <button className="text-gray-400 hover:text-red-600 p-2"><Trash2 size={18}/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               {alunosFiltrados.length === 0 && !loading && (
                 <div className="p-10 text-center text-gray-400 font-medium">Nenhum aluno encontrado.</div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
