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
  const [novaTurma, setNovaTurma] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [modoCriacao, setModoCriacao] = useState('nova');
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

      // 🔥 CORREÇÃO AQUI: Se já existe uma escola selecionada vinda do Dashboard, confia nela!
      if (escolaSelecionada) {
         setPrecisaCriarEscola(false);
         setLoading(false);
         return;
      }

      try {
        const instRef = collection(db, 'instituicoes');
        // Removemos a trava de UID. Agora ele verifica se a faculdade existe globalmente.
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
      setNomeTurmaClonada(''); setModoCriacao('nova');
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
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-8 mt-3 border-b pb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Gestão de Turmas</h1>
          {editandoEscola ? (
            <div className="flex gap-2 mt-1">
             
              <input type="text" className="border rounded-lg px-2 py-1 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500" value={nomeEscolaEdicao} onChange={e => setNomeEscolaEdicao(e.target.value)} autoFocus />
              <button onClick={handleSalvarEdicaoEscola} className="bg-green-500 text-white p-1 rounded-md hover:bg-green-600"><Check size={14}/></button>
              <button onClick={() => setEditandoEscola(false)} className="bg-gray-200 text-gray-600 p-1 rounded-md hover:bg-gray-300"><X size={14}/></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm font-medium text-gray-500">Agrupamentos em: <strong className="text-gray-700">{escolaSelecionada?.nome}</strong></p>
              <button onClick={() => { setEditandoEscola(true);
              setNomeEscolaEdicao(escolaSelecionada.nome); }} className="text-gray-300 hover:text-blue-500 transition-colors"><Pencil size={14}/></button>
              <button onClick={handleLixeiraEscola} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
            </div>
          )}
        </div>
        <button onClick={() => setPrecisaCriarEscola(true)} className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"><Building2 size={16} /> Nova Instituição</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-2/3">
          {turmas.length === 0 ?
            <div className="p-10 text-center border-2 border-dashed rounded-2xl text-gray-400 font-bold bg-gray-50">Nenhuma sala de aula criada ainda.</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {turmas.map(turma => (
                <div key={turma.id} className="bg-white border rounded-2xl p-5 shadow-sm group hover:border-blue-300 transition-all">
                  <div className="flex justify-between mb-3">
       
                    <div className={`p-2 rounded-lg ${turma.isModelo ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}><BookOpen size={20}/></div>
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditandoId(turma.id); setNomeEdicao(turma.nome); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={18}/></button>
                 
                      <button onClick={() => handleLixeira(turma.id, turma.nome)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                    </div>
                  </div>
                  {editandoId === turma.id ?
                  (
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} className="w-full border rounded-lg p-2 font-bold focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
                      <button onClick={() => handleSalvarEdicao(turma.id)} className="bg-green-500 text-white px-2 rounded-lg hover:bg-green-600"><Check size={18}/></button>
         
                    </div>
                  ) : <h3 className="font-black text-xl truncate mb-1 text-gray-800">{turma.nome}</h3>}
                  <div className="mt-4 flex gap-2">
                    <Link to="/alunos" state={{ turmaIdSelecionada: turma.id }} className="flex-1 text-center bg-gray-50 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Alunos</Link>
        
                    <Link to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="flex-1 text-center bg-blue-50 text-blue-600 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">Tarefas</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
   
        </div>
        
        <div className="w-full lg:w-1/3">
          <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-sm sticky top-24">
            <div className="flex bg-gray-50 p-1 rounded-2xl mb-4">
              <button onClick={() => setModoCriacao('nova')} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${modoCriacao === 'nova' ?
              'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>Criar do Zero</button>
              
              {/* 🔥 BOTÃO RENOMEADO AQUI */}
              <button onClick={() => setModoCriacao('clolar')} className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${modoCriacao === 'clolar' ?
              'bg-white text-purple-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}>Copiar turma existente</button>
            </div>
            
            {modoCriacao === 'nova' ?
            (
              <form onSubmit={handleCriarTurma} className="flex flex-col gap-4 p-2">
                <input type="text" required placeholder="Ex: Odontologia 3º Período..." className="w-full p-4 bg-gray-50 border rounded-xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} />
                <button type="submit" disabled={salvando} className="bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all">{salvando ? 'Criando...' : 'Criar Turma'}</button>
            
              </form>
            ) : (
              // 🔥 FORMULÁRIO DE CÓPIA COM SUBTÍTULO E TEXTOS ATUALIZADOS
              <form onSubmit={handleClonarTurma} className="flex flex-col gap-4 p-4 bg-purple-50/50 rounded-2xl border border-purple-100 mt-2">
                <p className="text-xs text-purple-700 text-center font-medium leading-relaxed px-2">
               
                  Aproveite a estrutura e as tarefas de uma turma já configurada na instituição.
                </p>
                <select required className="w-full p-4 bg-white border border-purple-200 rounded-xl font-bold outline-none cursor-pointer focus:ring-2 focus:ring-purple-500 text-gray-700" value={modeloSelecionado} onChange={e => setModeloSelecionado(e.target.value)}>
                  <option value="">Selecione a turma base...</option>
                  {turmasModelo.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
       
                <input type="text" required placeholder="Novo nome da sua turma..." className="w-full p-4 bg-white border border-purple-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-purple-500 text-gray-700" value={nomeTurmaClonada} onChange={e => setNomeTurmaClonada(e.target.value)} />
                <button type="submit" disabled={clonando ||
                !modeloSelecionado} className="bg-purple-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-purple-700 transition-all">{clonando ?
                'Copiando...' : 'Copiar estrutura'}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
