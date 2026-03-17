import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Users, Plus, ArrowRight, Pencil, Trash2, X, Check, FileText, School, Star, Copy, RefreshCw, Building2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

export default function Turmas() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [turmas, setTurmas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Criação
  const [novaTurma, setNovaTurma] = useState('');
  const [salvando, setSalvando] = useState(false);
  
  // Estados de Cópia
  const [turmasModelo, setTurmasModelo] = useState([]);
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [nomeTurmaClonada, setNomeTurmaClonada] = useState('');
  const [clonando, setClonando] = useState(false);

  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [editandoEscola, setEditandoEscola] = useState(false);
  const [nomeEscolaEdicao, setNomeEscolaEdicao] = useState('');
  const [precisaCriarEscola, setPrecisaCriarEscola] = useState(false);
  const [novaEscolaNome, setNovaEscolaNome] = useState('');
  const [salvandoEscola, setSalvandoEscola] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';

  useEffect(() => {
    async function checkInstituicao() {
      if (!currentUser) return;
      if (location.state?.abrirModalInstituicao) {
         setPrecisaCriarEscola(true);
         setLoading(false);
         window.history.replaceState({}, document.title);
         return;
      }

      if (escolaSelecionada) {
         setPrecisaCriarEscola(false);
         setLoading(false);
         return;
      }

      try {
        const instRef = collection(db, 'instituicoes');
        const snap = await getDocs(instRef);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
        
        if (lista.length === 0) {
          setPrecisaCriarEscola(true);
          setLoading(false);
          return;
        }
        
        if (!escolaSelecionada) setEscolaSelecionada(lista[0]);
  
      } catch (e) { 
        console.error("Erro ao verificar instituição:", e); 
      } finally {
        setLoading(false);
      }
    }
    checkInstituicao();
  }, [currentUser, isAdmin, escolaSelecionada, setEscolaSelecionada, location.state]);

  useEffect(() => {
    async function fetchTurmas() {
      if (!currentUser || !escolaSelecionada?.id || precisaCriarEscola) {
         if (!precisaCriarEscola) setLoading(false);
         return;
      }
      try {
        const turmasRef = collection(db, 'turmas');
        const q = isAdmin
          ? query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id))
          : query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        
        const querySnapshot = await getDocs(q);
        const turmasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const turmasAtivas = turmasData.filter(t => t.status !== 'lixeira');
        setTurmas(turmasAtivas.sort((a, b) => (b.dataCriacao?.toMillis() || 0) - (a.dataCriacao?.toMillis() || 0)));

        const qModelos = query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id), where('isModelo', '==', true));
      
        const snapModelos = await getDocs(qModelos);
        setTurmasModelo(snapModelos.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.status !== 'lixeira'));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchTurmas();
  }, [currentUser, escolaSelecionada, isAdmin, precisaCriarEscola]);

  async function handleCriarInstituicao(e) {
    e.preventDefault(); if (!novaEscolaNome.trim()) return;
    try {
      setSalvandoEscola(true);
      const nova = { nome: novaEscolaNome.trim(), professorUid: currentUser.uid, status: 'ativa', dataCriacao: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'instituicoes'), nova);
      setEscolaSelecionada({ id: docRef.id, ...nova }); setPrecisaCriarEscola(false); setNovaEscolaNome(''); navigate('/turmas');
    } catch (error) { console.error(error);
    } finally { setSalvandoEscola(false); }
  }

  async function handleSalvarEdicaoEscola() {
    if (!nomeEscolaEdicao.trim() || !escolaSelecionada) return;
    try {
      setSalvandoEscola(true); await updateDoc(doc(db, 'instituicoes', escolaSelecionada.id), { nome: nomeEscolaEdicao.trim() });
      setEscolaSelecionada({ ...escolaSelecionada, nome: nomeEscolaEdicao.trim() }); setEditandoEscola(false);
    } catch (error) { console.error(error); } finally { setSalvandoEscola(false);
    }
  }

  async function handleLixeiraEscola() {
    if (!window.confirm(`Tem certeza que deseja enviar a instituição "${escolaSelecionada.nome}" para a lixeira?`)) return;
    try { 
      await updateDoc(doc(db, 'instituicoes', escolaSelecionada.id), { status: 'lixeira' });
      localStorage.removeItem('@SaaS_EscolaSelecionada');
      setEscolaSelecionada(null);
      window.location.href = '/'; 
    } catch (e) { console.error(e); }
  }

  async function handleCriarTurma(e) {
    e.preventDefault();
    if (!novaTurma.trim() || !escolaSelecionada?.id) return;
    try {
      setSalvando(true);
      const nt = { nome: novaTurma.trim(), instituicaoId: escolaSelecionada.id, instituicaoNome: escolaSelecionada.nome, professorUid: currentUser.uid, status: 'ativa', isModelo: false, dataCriacao: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'turmas'), nt);
      setTurmas([{ id: docRef.id, ...nt, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]);
      setNovaTurma('');
    } catch (error) { console.error(error); } finally { setSalvando(false);
    }
  }

  async function handleClonarTurma(e) {
    e.preventDefault(); if (!modeloSelecionado || !nomeTurmaClonada.trim() || !escolaSelecionada?.id) return;
    try {
      setClonando(true);
      const nt = { nome: nomeTurmaClonada.trim(), instituicaoId: escolaSelecionada.id, instituicaoNome: escolaSelecionada.nome, professorUid: currentUser.uid, status: 'ativa', isModelo: false, dataCriacao: serverTimestamp() };
      const tr = await addDoc(collection(db, 'turmas'), nt);
      const q = query(collection(db, 'tarefas'), where('turmaId', '==', modeloSelecionado));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        const t = d.data();
        if (t.status !== 'lixeira') await addDoc(collection(db, 'tarefas'), { ...t, turmaId: tr.id, professorUid: currentUser.uid, dataCriacao: serverTimestamp() });
      }
      setTurmas([{ id: tr.id, ...nt, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]); setModeloSelecionado('');
      setNomeTurmaClonada('');
    } catch (error) { console.error(error); } finally { setClonando(false);
    }
  }

  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    try { await updateDoc(doc(db, 'turmas', id), { nome: nomeEdicao.trim() });
    setTurmas(turmas.map(t => t.id === id ? { ...t, nome: nomeEdicao.trim() } : t)); setEditandoId(null); } catch (e) { console.error(e);
    }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Lixeira turma "${nome}"?`)) return;
    try { await updateDoc(doc(db, 'turmas', id), { status: 'lixeira' }); setTurmas(turmas.filter(t => t.id !== id)); } catch (e) { console.error(e);
    }
  }

  if (loading) return <div className="p-20 text-center animate-pulse font-bold text-gray-400">Sincronizando painel...</div>;

  if (precisaCriarEscola) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in zoom-in-95 duration-500">
        <School size={48} className="mx-auto mb-8 text-blue-600" />
        <h1 className="text-3xl font-black mb-4 tracking-tight text-gray-800">Onde você ensina?</h1>
        <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto font-medium">Digite o nome da sua escola ou ambiente de ensino para começarmos.</p>
        <form onSubmit={handleCriarInstituicao} className="max-w-md mx-auto flex flex-col gap-4">
          <input type="text" 
            required autoFocus placeholder="Nome da Instituição..." className="w-full px-5 py-4 border-2 rounded-2xl text-center font-bold outline-none shadow-sm focus:border-blue-500 text-gray-800" value={novaEscolaNome} onChange={e => setNovaEscolaNome(e.target.value)} />
          <button type="submit" disabled={salvandoEscola} className="bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">Salvar e Continuar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Turmas' }]} />
      
      {/* HEADER MELHORADO (Instituição à esquerda, Ação de Nova Instituição Discreta à Direita) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 mt-3 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">Gestão de Turmas</h1>
          {editandoEscola ? (
            <div className="flex gap-2 mt-1 animate-in fade-in duration-200">
              <input type="text" className="border-2 border-blue-200 rounded-lg px-3 py-1.5 font-bold text-gray-700 outline-none focus:border-blue-500" value={nomeEscolaEdicao} onChange={e => setNomeEscolaEdicao(e.target.value)} autoFocus />
              <button onClick={handleSalvarEdicaoEscola} className="bg-green-500 text-white px-3 rounded-md hover:bg-green-600 shadow-sm"><Check size={16}/></button>
              <button onClick={() => setEditandoEscola(false)} className="bg-gray-100 text-gray-500 px-3 rounded-md hover:bg-gray-200"><X size={16}/></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-500">Agrupamentos em: <strong className="text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md ml-1">{escolaSelecionada?.nome}</strong></p>
              <button onClick={() => { setEditandoEscola(true); setNomeEscolaEdicao(escolaSelecionada.nome); }} className="text-gray-400 hover:text-blue-500 transition-colors p-1" title="Renomear Instituição"><Pencil size={14}/></button>
              <button onClick={handleLixeiraEscola} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Excluir Instituição"><Trash2 size={14}/></button>
            </div>
          )}
        </div>
        
        {/* BOTÃO SECUNDÁRIO E DISCRETO PARA NOVA INSTITUIÇÃO */}
        <button onClick={() => setPrecisaCriarEscola(true)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 hover:bg-blue-50 px-4 py-2 rounded-xl">
          <Building2 size={14} /> Cadastrar outra Instituição
        </button>
      </div>

      {/* BLOCO SUPERIOR: CARTÕES DE CRIAÇÃO LADO A LADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        
        {/* CARTÃO 1: CRIAR DO ZERO */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
           <div className="flex items-center gap-3 mb-5">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-xl"><Plus size={22}/></div>
              <div>
                 <h2 className="text-lg font-black text-gray-800 leading-tight">Criar turma do zero</h2>
                 <p className="text-xs font-medium text-gray-500 mt-0.5">Inicie uma nova sala de aula limpa.</p>
              </div>
           </div>
           <form onSubmit={handleCriarTurma} className="flex flex-col sm:flex-row gap-3">
              <input type="text" required placeholder="Ex: Odontologia 3º Período..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} />
              <button type="submit" disabled={salvando} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl shadow-md hover:bg-blue-700 transition-all whitespace-nowrap text-sm disabled:opacity-50">
                {salvando ? 'Criando...' : 'Criar Turma'}
              </button>
           </form>
        </div>

        {/* CARTÃO 2: COPIAR EXISTENTE */}
        <div className="bg-purple-50/30 border border-purple-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
           <div className="absolute -right-6 -top-6 text-purple-100 opacity-50 pointer-events-none"><Copy size={100} /></div>
           <div className="relative z-10">
             <div className="flex items-center gap-3 mb-5">
                <div className="bg-purple-100 text-purple-600 p-3 rounded-xl"><Copy size={22}/></div>
                <div>
                   <h2 className="text-lg font-black text-purple-900 leading-tight">Copiar turma existente</h2>
                   <p className="text-xs font-medium text-purple-600/80 mt-0.5">Aproveite tarefas e estrutura já prontas.</p>
                </div>
             </div>
             <form onSubmit={handleClonarTurma} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <select required className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl font-bold outline-none cursor-pointer focus:ring-2 focus:ring-purple-500 text-sm text-gray-700 shadow-sm" value={modeloSelecionado} onChange={e => setModeloSelecionado(e.target.value)}>
                    <option value="">Selecione a turma base...</option>
                    {turmasModelo.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <input type="text" required placeholder="Nome da nova turma..." className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-purple-500 text-sm text-gray-700 shadow-sm" value={nomeTurmaClonada} onChange={e => setNomeTurmaClonada(e.target.value)} />
                </div>
                <button type="submit" disabled={clonando || !modeloSelecionado} className="w-full bg-purple-600 text-white font-black py-3 rounded-xl shadow-md hover:bg-purple-700 transition-all text-sm disabled:opacity-50">
                  {clonando ? 'Copiando...' : 'Copiar estrutura da turma'}
                </button>
             </form>
           </div>
        </div>

      </div>

      {/* BLOCO INFERIOR: GRELHA DE TURMAS ATIVAS */}
      <div>
        <h2 className="text-lg font-black text-gray-800 mb-4">Salas de Aula Ativas</h2>
        
        {turmas.length === 0 ? (
          <div className="p-16 text-center border-2 border-dashed border-gray-200 rounded-3xl text-gray-400 font-bold bg-gray-50 flex flex-col items-center justify-center">
             <BookOpen size={40} className="mb-4 text-gray-300" />
             <p className="text-lg text-gray-500">Nenhuma sala de aula criada ainda.</p>
             <p className="text-sm font-medium mt-2">Use um dos cartões acima para começar!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {turmas.map(turma => (
              <div key={turma.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col h-full">
                
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2.5 rounded-xl shrink-0 ${turma.isModelo ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                    <BookOpen size={20}/>
                  </div>
                  <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditandoId(turma.id); setNomeEdicao(turma.nome); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Renomear"><Pencil size={16}/></button>
                    <button onClick={() => handleLixeira(turma.id, turma.nome)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir"><Trash2 size={16}/></button>
                  </div>
                </div>

                <div className="mb-4 flex-1">
                  {editandoId === turma.id ? (
                    <div className="flex gap-2 animate-in fade-in duration-200">
                      <input type="text" value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} className="w-full border-2 border-blue-200 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-gray-800" autoFocus />
                      <button onClick={() => handleSalvarEdicao(turma.id)} className="bg-green-500 text-white px-2 rounded-lg hover:bg-green-600 shadow-sm"><Check size={16}/></button>
                    </div>
                  ) : (
                    <h3 className="font-black text-lg text-gray-800 leading-tight line-clamp-2" title={turma.nome}>{turma.nome}</h3>
                  )}
                  {turma.isModelo && <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Serve como Modelo</span>}
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
                  <Link to="/alunos" state={{ turmaIdSelecionada: turma.id }} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors">
                    <Users size={14}/> Alunos
                  </Link>
                  <Link to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 py-2.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                    <FileText size={14}/> Tarefas
                  </Link>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
