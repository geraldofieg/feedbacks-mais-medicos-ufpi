import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Plus, Trash2, Search, X, BookOpen, AlertCircle, Pencil, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Alunos() {
  const { currentUser, escolaSelecionada } = useAuth();
  
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Controle do Modal de Criação
  const [showModal, setShowModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nomeAluno, setNomeAluno] = useState('');
  
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [modoNovaTurma, setModoNovaTurma] = useState(false);
  const [nomeNovaTurma, setNomeNovaTurma] = useState('');

  // Controle de Edição (Inline)
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!currentUser || !escolaSelecionada) return;

      try {
        // Busca turmas do professor nesta instituição
        const qTurmas = query(collection(db, 'turmas'), where('instituicao', '==', escolaSelecionada), where('professorUid', '==', currentUser.uid));
        const turmasSnap = await getDocs(qTurmas);
        // Só pega turmas que não estão na lixeira
        const turmasData = turmasSnap.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);

        if (turmasData.length > 0) {
          const turmasIds = turmasData.map(t => t.id);
          const qAlunos = query(collection(db, 'alunos'), where('instituicao', '==', escolaSelecionada));
          const alunosSnap = await getDocs(qAlunos);
          
          // A MÁGICA DA LIXEIRA: Só exibe alunos que pertencem às turmas ativas E que não estão na lixeira
          const alunosData = alunosSnap.docs
            .map(a => ({ id: a.id, ...a.data() }))
            .filter(a => turmasIds.includes(a.turmaId) && a.status !== 'lixeira')
            .sort((a, b) => a.nome.localeCompare(b.nome)); 
            
          setAlunos(alunosData);
          setTurmaSelecionada(turmasData[0].id);
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentUser, escolaSelecionada]);

  // Criação de Aluno
  async function handleSalvarAluno(e) {
    e.preventDefault();
    if (!nomeAluno.trim()) return;

    try {
      setSalvando(true);
      let idDaTurmaParaVincular = turmaSelecionada;

      if (modoNovaTurma && nomeNovaTurma.trim()) {
        const novaTurmaObj = {
          nome: nomeNovaTurma.trim(),
          instituicao: escolaSelecionada,
          professorUid: currentUser.uid,
          status: 'ativa',
          dataCriacao: serverTimestamp()
        };
        const turmaRef = await addDoc(collection(db, 'turmas'), novaTurmaObj);
        idDaTurmaParaVincular = turmaRef.id;
        setTurmas([...turmas, { id: turmaRef.id, ...novaTurmaObj }]);
      }

      const novoAlunoObj = {
        nome: nomeAluno.trim(),
        turmaId: idDaTurmaParaVincular,
        instituicao: escolaSelecionada,
        status: 'ativa', // Importante para a lixeira funcionar
        dataCadastro: serverTimestamp()
      };
      const alunoRef = await addDoc(collection(db, 'alunos'), novoAlunoObj);

      setAlunos([...alunos, { id: alunoRef.id, ...novoAlunoObj }].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNomeAluno('');
      setNomeNovaTurma('');
      setModoNovaTurma(false);
      setShowModal(false);

    } catch (error) {
      console.error("Erro ao salvar aluno:", error);
      alert("Falha ao cadastrar aluno.");
    } finally {
      setSalvando(false);
    }
  }

  // Edição Rápida (Lápis)
  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    try {
      await updateDoc(doc(db, 'alunos', id), { nome: nomeEdicao.trim() });
      setAlunos(alunos.map(a => a.id === id ? { ...a, nome: nomeEdicao.trim() } : a).sort((a, b) => a.nome.localeCompare(b.nome)));
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar aluno:", error);
      alert("Erro ao alterar o nome do aluno.");
    }
  }

  // Soft Delete (Mover para Lixeira)
  async function handleLixeira(id, nome) {
    if (!window.confirm(`Tem certeza que deseja enviar o aluno "${nome}" para a lixeira?`)) return;
    try {
      await updateDoc(doc(db, 'alunos', id), { status: 'lixeira' });
      setAlunos(alunos.filter(a => a.id !== id));
    } catch (error) {
      console.error("Erro ao enviar para lixeira:", error);
    }
  }

  const alunosFiltrados = alunos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()));
  const getNomeTurma = (id) => turmas.find(t => t.id === id)?.nome || 'Turma Desconhecida';

  if (loading) return <div className="text-center py-20 text-gray-500 font-medium animate-pulse">Carregando base de alunos...</div>;

  // ESTADO VAZIO EDUCATIVO
  if (turmas.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: 'Alunos' }]} />
        
        <div className="text-center mt-12">
          <div className="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="text-blue-500 w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-gray-800 mb-4">Quase lá!</h2>
          <p className="text-gray-600 text-lg mb-8 max-w-lg mx-auto">
            Para cadastrar seus alunos, você precisa primeiro criar uma <strong>Turma</strong>.
          </p>
          <Link to="/turmas" className="inline-flex items-center gap-2 bg-blue-600 text-white font-black py-4 px-8 rounded-xl hover:bg-blue-700 transition-all shadow-lg transform hover:-translate-y-1">
            <Plus size={20} /> Criar Minha Primeira Turma
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Alunos' }]} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 text-green-700 p-3 rounded-xl shadow-sm">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 leading-tight">Gestão de Alunos</h1>
            <p className="text-gray-500 text-sm font-medium mt-0.5">Instituição: <strong className="text-gray-700">{escolaSelecionada}</strong></p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="w-full md:w-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <UserPlus size={20} /> Cadastrar Aluno
        </button>
      </div>

      {alunos.length > 0 && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex items-center gap-3">
          <Search className="text-gray-400" size={20} />
          <input 
            type="text" placeholder="Buscar aluno pelo nome..." 
            className="w-full bg-transparent border-none focus:ring-0 text-gray-700 font-medium placeholder-gray-400"
            value={busca} onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      )}

      {alunos.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <Users className="text-gray-300 w-16 h-16 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-700 mb-2">Sua base de alunos está vazia</h3>
          <p className="text-gray-500 mb-6">Você já tem turmas criadas. Agora, adicione seu primeiro aluno.</p>
          <button onClick={() => setShowModal(true)} className="bg-white border border-gray-200 text-blue-600 font-bold py-2.5 px-6 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            Adicionar Primeiro Aluno
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider font-bold">
                  <th className="p-4 pl-6 w-1/2">Nome do Aluno</th>
                  <th className="p-4">Turma Vinculada</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alunosFiltrados.map(aluno => (
                  <tr key={aluno.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 pl-6">
                      {/* MODO EDIÇÃO INLINE */}
                      {editandoId === aluno.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={nomeEdicao} 
                            onChange={(e) => setNomeEdicao(e.target.value)} 
                            className="w-full max-w-xs border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800" 
                            autoFocus 
                          />
                          <button onClick={() => handleSalvarEdicao(aluno.id)} className="bg-green-500 text-white p-1.5 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                          <button onClick={() => setEditandoId(null)} className="bg-gray-200 text-gray-600 p-1.5 rounded-lg hover:bg-gray-300"><X size={16}/></button>
                        </div>
                      ) : (
                        <span className="font-bold text-gray-800 block">{aluno.nome}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold border border-blue-100">
                        <BookOpen size={12}/> {getNomeTurma(aluno.turmaId)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditandoId(aluno.id); setNomeEdicao(aluno.nome); }} 
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar Nome"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleLixeira(aluno.id, aluno.nome)} 
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Mover para Lixeira"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><UserPlus className="text-blue-600"/> Novo Aluno</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSalvarAluno} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Nome Completo</label>
                <input type="text" required autoFocus placeholder="Ex: João da Silva" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors font-medium" value={nomeAluno} onChange={(e) => setNomeAluno(e.target.value)} />
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-end mb-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">Vincular à Turma</label>
                  {!modoNovaTurma && (
                    <button type="button" onClick={() => setModoNovaTurma(true)} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <Plus size={12}/> Nova Turma
                    </button>
                  )}
                </div>
                {modoNovaTurma ? (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-orange-600 uppercase bg-orange-50 p-1.5 rounded-lg border border-orange-100 mb-2">
                      <AlertCircle size={12}/> Criando turma e aluno simultaneamente
                    </div>
                    <input type="text" required placeholder="Nome da nova turma..." className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={nomeNovaTurma} onChange={(e) => setNomeNovaTurma(e.target.value)} />
                    <button type="button" onClick={() => {setModoNovaTurma(false); setNomeNovaTurma('');}} className="text-xs font-bold text-gray-500 hover:text-gray-700 w-full text-right mt-1">Cancelar e escolher existente</button>
                  </div>
                ) : (
                  <select required className="w-full px-3 py-2.5 bg-white border border-gray-200 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" value={turmaSelecionada} onChange={(e) => setTurmaSelecionada(e.target.value)}>
                    {turmas.map(t => (<option key={t.id} value={t.id}>{t.nome}</option>))}
                  </select>
                )}
              </div>
              <div className="pt-2">
                <button type="submit" disabled={salvando} className="w-full bg-blue-600 text-white font-black py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Cadastrar Aluno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
            }
                          
