import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Search, Pencil, Trash2, Check, X, GraduationCap, Phone } from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Alunos() {
  const { currentUser, escolaSelecionada } = useAuth();
  const location = useLocation();
  
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const [filtroTurma, setFiltroTurma] = useState(location.state?.turmaIdSelecionada || 'todas');

  const [novoAluno, setNovoAluno] = useState({ nome: '', whatsapp: '', turmaId: '' });
  const [salvando, setSalvando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [whatsappEdicao, setWhatsappEdicao] = useState('');
  const [turmaIdEdicao, setTurmaIdEdicao] = useState('');

  useEffect(() => {
    async function fetchData() {
      if (!currentUser || !escolaSelecionada?.id) return;
      setLoading(true);
      try {
        const qTurmas = query(collection(db, 'turmas'), 
          where('instituicaoId', '==', escolaSelecionada.id),
          where('professorUid', '==', currentUser.uid)
        );
        const snapTurmas = await getDocs(qTurmas);
        const turmasData = snapTurmas.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira');
        setTurmas(turmasData);
        
        if (turmasData.length > 0) {
          setNovoAluno(prev => ({ ...prev, turmaId: turmasData[0].id }));
        }

        const qAlunos = query(collection(db, 'alunos'), 
          where('instituicaoId', '==', escolaSelecionada.id)
        );
        const snapAlunos = await getDocs(qAlunos);
        const alunosData = snapAlunos.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'lixeira');
        
        setAlunos(alunosData.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentUser, escolaSelecionada]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!novoAluno.nome.trim() || !novoAluno.turmaId) return;

    try {
      setSalvando(true);
      const alunoData = {
        nome: novoAluno.nome.trim(),
        whatsapp: novoAluno.whatsapp.trim(),
        turmaId: novoAluno.turmaId,
        instituicaoId: escolaSelecionada.id,
        professorUid: currentUser.uid,
        status: 'ativo',
        dataCadastro: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'alunos'), alunoData);
      
      const novaLista = [{ id: docRef.id, ...alunoData }, ...alunos];
      setAlunos(novaLista.sort((a, b) => a.nome.localeCompare(b.nome)));
      
      setNovoAluno(prev => ({ ...prev, nome: '', whatsapp: '' }));
    } catch (error) {
      console.error("Erro ao criar aluno:", error);
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim() || !turmaIdEdicao) return;
    try {
      await updateDoc(doc(db, 'alunos', id), { 
        nome: nomeEdicao.trim(),
        whatsapp: whatsappEdicao.trim(),
        turmaId: turmaIdEdicao
      });
      
      const novaLista = alunos.map(a => a.id === id ? { 
        ...a, 
        nome: nomeEdicao.trim(), 
        whatsapp: whatsappEdicao.trim(),
        turmaId: turmaIdEdicao
      } : a);
      
      setAlunos(novaLista.sort((a, b) => a.nome.localeCompare(b.nome)));
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar:", error);
    }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Remover o aluno "${nome}"? (As notas dele serão mantidas no sistema, mas ele sumirá das listas).`)) return;
    try {
      await updateDoc(doc(db, 'alunos', id), { status: 'lixeira' });
      setAlunos(alunos.filter(a => a.id !== id));
    } catch (error) {
      console.error("Erro ao remover:", error);
    }
  }

  const alunosFiltrados = alunos.filter(a => {
    const bateNome = a.nome.toLowerCase().includes(busca.toLowerCase());
    const bateTurma = filtroTurma === 'todas' || a.turmaId === filtroTurma;
    return bateNome && bateTurma;
  });

  const getNomeTurma = (idTurma) => turmas.find(t => t.id === idTurma)?.nome || 'Turma não encontrada';
    return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Breadcrumb items={[{ label: 'Turmas', path: '/turmas' }, { label: 'Alunos' }]} />
        <h1 className="text-xl font-black text-gray-800 flex items-center gap-2 mt-3 tracking-tight">
          <Users className="text-green-600" size={22} /> Gestão de Alunos
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm sticky top-24">
            
            {turmas.length === 0 && !loading ? (
              <div className="text-center py-8">
                <GraduationCap className="mx-auto text-blue-300 mb-3" size={40} />
                <h3 className="font-bold text-gray-700 mb-2">Nenhuma turma criada</h3>
                <p className="text-xs text-gray-500 mb-4">Você precisa criar uma turma antes de matricular alunos.</p>
                <Link to="/turmas" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm block text-center">Criar Turma</Link>
              </div>
            ) : (
              <>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Matricular Novo Aluno</h2>
                <form onSubmit={handleCriar} className="space-y-4">
                  
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Turma de Destino</label>
                    <select 
                      className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-700 transition-colors cursor-pointer"
                      value={novoAluno.turmaId} onChange={e => setNovoAluno({...novoAluno, turmaId: e.target.value})}
                      required
                    >
                      {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome Completo</label>
                    <input
                      type="text" required placeholder="Ex: Maria da Silva..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-800"
                      value={novoAluno.nome} onChange={e => setNovoAluno({...novoAluno, nome: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1 flex items-center gap-1"><Phone size={12}/> WhatsApp (Opcional)</label>
                    <input
                      type="text" placeholder="Ex: 11999999999"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl mt-1 focus:ring-2 focus:ring-green-500 outline-none font-medium text-gray-800"
                      value={novoAluno.whatsapp} onChange={e => setNovoAluno({...novoAluno, whatsapp: e.target.value})}
                    />
                    <p className="text-[9px] text-gray-400 mt-1 ml-1 leading-tight">Apenas números. Usado para cobranças no WhatsApp.</p>
                  </div>

                  <button disabled={salvando || !novoAluno.turmaId} className="w-full bg-green-600 text-white font-black py-4 rounded-xl hover:bg-green-700 transition-all shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                    <Plus size={20}/> {salvando ? 'Salvando...' : 'Matricular Aluno'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18}/>
              <input 
                type="text" placeholder="Buscar aluno por nome..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm"
                value={busca} onChange={e => setBusca(e.target.value)}
              />
            </div>
            
            <select 
              className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold shadow-sm text-gray-600 cursor-pointer"
              value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}
            >
              <option value="todas">Todas as Turmas</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between px-1 mt-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Alunos Cadastrados</h2>
            <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full">{alunosFiltrados.length}</span>
          </div>

          {loading ? (
            <div className="p-10 text-center animate-pulse font-bold text-gray-400">Carregando alunos...</div>
          ) : alunosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-medium">Nenhum aluno encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alunosFiltrados.map(aluno => (
                <div key={aluno.id} className={`bg-white p-5 rounded-2xl border transition-all group ${editandoId === aluno.id ? 'border-blue-400 shadow-md ring-2 ring-blue-50' : 'border-gray-200 shadow-sm hover:border-green-200'}`}>
                  
                  {editandoId === aluno.id ? (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Nome</label>
                        <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold outline-none" value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">WhatsApp</label>
                        <input className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold outline-none" value={whatsappEdicao} onChange={e => setWhatsappEdicao(e.target.value)}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Turma</label>
                        <select className="w-full border-2 border-blue-500 rounded-xl px-3 py-2 text-sm font-bold outline-none bg-white cursor-pointer" value={turmaIdEdicao} onChange={e => setTurmaIdEdicao(e.target.value)}>
                          {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={() => handleSalvarEdicao(aluno.id)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1 shadow-sm"><Check size={16}/> Salvar</button>
                        <button onClick={() => setEditandoId(null)} className="flex-1 bg-gray-100 text-gray-500 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1"><X size={16}/> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <div className="bg-green-50 text-green-600 p-2.5 rounded-xl shrink-0">
                          <Users size={20}/>
                        </div>
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => { setEditandoId(aluno.id); setNomeEdicao(aluno.nome); setWhatsappEdicao(aluno.whatsapp || ''); setTurmaIdEdicao(aluno.turmaId); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar"
                          ><Pencil size={18}/></button>
                          <button 
                            onClick={() => handleLixeira(aluno.id, aluno.nome)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remover"
                          ><Trash2 size={18}/></button>
                        </div>
                      </div>

                      <h3 className="font-black text-gray-800 text-lg leading-tight truncate mb-3" title={aluno.nome}>{aluno.nome}</h3>
                      
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider truncate max-w-full">
                          <GraduationCap size={12} className="shrink-0"/> <span className="truncate">{getNomeTurma(aluno.turmaId)}</span>
                        </div>
                        
                        {aluno.whatsapp && (
                          <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold mt-1 bg-gray-50 p-1.5 rounded-md border border-gray-100">
                            <Phone size={12} className="text-green-500"/> {aluno.whatsapp}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
