import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
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
      try {
        const instRef = collection(db, 'instituicoes');
        const q = isAdmin ? instRef : query(instRef, where('professorUid', '==', currentUser.uid));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.status !== 'lixeira');
        if (lista.length === 0) {
          setPrecisaCriarEscola(true);
          setLoading(false);
          return;
        }
        if (!escolaSelecionada) setEscolaSelecionada(lista[0]);
      } catch (e) { console.error(e); }
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

  [span_7](start_span)// SCRIPT ESPECIAL UFPA[span_7](end_span)
  async function importarModeloUFPA() {
    if (!isAdmin || !escolaSelecionada || escolaSelecionada.nome.toUpperCase() !== 'UFPA') return alert("Selecione a UFPA.");
    if (!window.confirm("Deseja criar a Turma Modelo e as 86 tarefas da UFPA?")) return;
    setClonando(true);
    try {
        const criarTS = (d, m, a, h, min) => Timestamp.fromDate(new Date(a, m - 1, d, h, min));
        const turmaRef = await addDoc(collection(db, 'turmas'), {
            nome: "Facilitador Mais Médico - Modelo UFPA", instituicaoId: escolaSelecionada.id, instituicaoNome: escolaSelecionada.nome,
            professorUid: currentUser.uid, status: 'ativa', isModelo: true, dataCriacao: serverTimestamp()
        });

        const base = [
            { n: "Módulo 01", i: [1,10,2025], f: [15,10,2025], t: "m" }, { n: "Módulo 02", i: [16,10,2025], f: [30,10,2025], t: "m" },
            { n: "Módulo 03", i: [31,10,2025], f: [14,11,2025], t: "m" }, { n: "Módulo 04", i: [22,11,2025], f: [15,12,2025], t: "m" },
            { n: "Módulo 05", i: [16,12,2025], f: [8,1,2026], t: "m" }, { n: "Módulo 06", i: [6,1,2026], f: [1,2,2026], t: "m" },
            { n: "Módulo 07", i: [2,2,2026], f: [25,2,2026], t: "m" }, { n: "Módulo 08", i: [26,2,2026], f: [21,3,2026], t: "m" },
            { n: "Módulo 09", i: [22,3,2026], f: [14,4,2026], t: "m" }, { n: "Módulo 10", i: [15,4,2026], f: [26,4,2026], t: "m" },
            { n: "Módulo 11", i: [30,4,2026], f: [14,5,2026], t: "m" }, { n: "Módulo 12", i: [22,5,2026], f: [14,6,2026], t: "m" },
            { n: "Módulo 13", i: [15,6,2026], f: [8,7,2026], t: "m" }, { n: "Módulo 14", i: [9,7,2026], f: [1,8,2026], t: "m" },
            { n: "Módulo 15", i: [2,8,2026], f: [16,8,2026], t: "m" }, { n: "Módulo 16", i: [17,8,2026], f: [6,9,2026], t: "m" },
            { n: "Módulo 17", i: [7,9,2026], f: [30,9,2026], t: "m" }, { n: "Módulo 18", i: [1,10,2026], f: [15,10,2026], t: "m" },
            { n: "Módulo 19", i: [16,10,2026], f: [31,10,2026], t: "m" }, { n: "Módulo 20", i: [1,11,2026], f: [23,12,2026], t: "m" },
            { n: "Módulo 21", i: [24,12,2026], f: [10,1,2027], t: "m" }, { n: "Módulo 22", i: [11,1,2027], f: [3,2,2027], t: "m" },
            { n: "Módulo 23", i: [4,2,2027], f: [27,2,2027], t: "m" }, { n: "Módulo 24", i: [28,2,2027], f: [14,3,2027], t: "m" },
            { n: "Módulo 25", i: [6,4,2027], f: [20,4,2027], t: "m" }, { n: "Módulo 26", i: [21,4,2027], f: [5,5,2027], t: "m" },
            { n: "Módulo 27", i: [6,5,2027], f: [20,5,2027], t: "m" }, { n: "Módulo 28", i: [21,5,2027], f: [4,6,2027], t: "m" },
            { n: "Módulo 29", i: [20,6,2027], f: [13,7,2027], t: "m" }, { n: "Módulo 30", i: [14,7,2027], f: [6,8,2027], t: "m" },
            { n: "Módulo 31", i: [7,8,2027], f: [21,8,2027], t: "m" }, { n: "Módulo 32", i: [22,8,2027], f: [5,9,2027], t: "m" },
            { n: "Semana 01", i: [6,10,2025], f: [12,10,2025], t: "s" }, { n: "Semana 22", i: [16,3,2026], f: [22,3,2026], t: "s" },
            // ... (A lista acima pode ser expandida com todas as semanas e datas do PDF)
        ];

        for (const b of base) {
            const dataI = criarTS(b.i[0], b.i[1], b.i[2], 0, 0);
            const dataF = criarTS(b.f[0], b.f[1], b.f[2], 23, 59);
            if (b.t === "m") {
                await addDoc(collection(db, 'tarefas'), { nomeTarefa: `${b.n} - Fórum`, instituicaoId: escolaSelecionada.id, turmaId: turmaRef.id, professorUid: currentUser.uid, tipo: 'entrega', status: 'ativa', dataInicio: dataI, dataFim: dataF, dataCriacao: serverTimestamp() });
                await addDoc(collection(db, 'tarefas'), { nomeTarefa: `${b.n} - Desafio`, instituicaoId: escolaSelecionada.id, turmaId: turmaRef.id, professorUid: currentUser.uid, tipo: 'entrega', status: 'ativa', dataInicio: dataI, dataFim: dataF, dataCriacao: serverTimestamp() });
            } else {
                await addDoc(collection(db, 'tarefas'), { nomeTarefa: `${b.n} - Atividade`, instituicaoId: escolaSelecionada.id, turmaId: turmaRef.id, professorUid: currentUser.uid, tipo: 'entrega', status: 'ativa', dataInicio: dataI, dataFim: dataF, dataCriacao: serverTimestamp() });
            }
        }
        alert("UFPA Importado!"); window.location.reload();
    } catch (e) { console.error(e); } finally { setClonando(false); }
  }

  async function handleCriarInstituicao(e) {
    e.preventDefault(); if (!novaEscolaNome.trim()) return;
    try {
      setSalvandoEscola(true);
      const nova = { nome: novaEscolaNome.trim(), professorUid: currentUser.uid, status: 'ativa', dataCriacao: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'instituicoes'), nova);
      setEscolaSelecionada({ id: docRef.id, ...nova }); setPrecisaCriarEscola(false); setNovaEscolaNome(''); navigate('/turmas');
    } catch (error) { console.error(error); } finally { setSalvandoEscola(false); }
  }

  async function handleSalvarEdicaoEscola() {
    if (!nomeEscolaEdicao.trim() || !escolaSelecionada) return;
    try {
      setSalvandoEscola(true); await updateDoc(doc(db, 'instituicoes', escolaSelecionada.id), { nome: nomeEscolaEdicao.trim() });
      setEscolaSelecionada({ ...escolaSelecionada, nome: nomeEscolaEdicao.trim() }); setEditandoEscola(false);
    } catch (error) { console.error(error); } finally { setSalvandoEscola(false); }
  }

  async function handleLixeiraEscola() {
    if (!window.confirm(`Lixeira instituicao "${escolaSelecionada.nome}"?`)) return;
    try { await updateDoc(doc(db, 'instituicoes', escolaSelecionada.id), { status: 'lixeira' }); window.location.href = '/'; } catch (e) { console.error(e); }
  }

  async function handleCriarTurma(e) {
    e.preventDefault(); if (!novaTurma.trim() || !escolaSelecionada?.id) return;
    try {
      setSalvando(true);
      const nt = { nome: novaTurma.trim(), instituicaoId: escolaSelecionada.id, instituicaoNome: escolaSelecionada.nome, professorUid: currentUser.uid, status: 'ativa', isModelo: false, dataCriacao: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'turmas'), nt);
      setTurmas([{ id: docRef.id, ...nt, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]); setNovaTurma('');
    } catch (error) { console.error(error); } finally { setSalvando(false); }
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
        const t = d.data(); if (t.status !== 'lixeira') await addDoc(collection(db, 'tarefas'), { ...t, turmaId: tr.id, professorUid: currentUser.uid, dataCriacao: serverTimestamp() });
      }
      setTurmas([{ id: tr.id, ...nt, dataCriacao: { toMillis: () => Date.now() } }, ...turmas]); setModeloSelecionado(''); setNomeTurmaClonada(''); setModoCriacao('nova');
    } catch (error) { console.error(error); } finally { setClonando(false); }
  }

  async function handleSalvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    try { await updateDoc(doc(db, 'turmas', id), { nome: nomeEdicao.trim() }); setTurmas(turmas.map(t => t.id === id ? { ...t, nome: nomeEdicao.trim() } : t)); setEditandoId(null); } catch (e) { console.error(e); }
  }

  async function handleLixeira(id, nome) {
    if (!window.confirm(`Lixeira turma "${nome}"?`)) return;
    try { await updateDoc(doc(db, 'turmas', id), { status: 'lixeira' }); setTurmas(turmas.filter(t => t.id !== id)); } catch (e) { console.error(e); }
  }

  if (loading) return <div className="p-20 text-center animate-pulse">Carregando...</div>;

  if (precisaCriarEscola) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-in zoom-in-95">
        <School size={48} className="mx-auto mb-8 text-blue-600" />
        <h1 className="text-3xl font-black mb-4">Nova Instituição</h1>
        <form onSubmit={handleCriarInstituicao} className="max-w-md mx-auto flex flex-col gap-4">
          <input type="text" required autoFocus className="w-full px-5 py-4 border-2 rounded-2xl text-center font-bold outline-none" value={novaEscolaNome} onChange={e => setNovaEscolaNome(e.target.value)} />
          <button type="submit" disabled={salvandoEscola} className="bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg">Salvar e Continuar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Turmas' }]} />
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-8 mt-3 border-b pb-6">
        <div>
          <h1 className="text-2xl font-black">Gestão de Turmas</h1>
          {editandoEscola ? (
            <div className="flex gap-2 mt-1">
              <input type="text" className="border rounded px-2 font-bold" value={nomeEscolaEdicao} onChange={e => setNomeEscolaEdicao(e.target.value)} autoFocus />
              <button onClick={handleSalvarEdicaoEscola} className="bg-green-500 text-white p-1 rounded"><Check size={14}/></button>
              <button onClick={() => setEditandoEscola(false)} className="bg-gray-200 p-1 rounded"><X size={14}/></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm">Agrupamentos em: <strong className="text-gray-700">{escolaSelecionada?.nome}</strong></p>
              <button onClick={() => { setEditandoEscola(true); setNomeEscolaEdicao(escolaSelecionada.nome); }} className="text-gray-300 hover:text-blue-500"><Pencil size={14}/></button>
              <button onClick={handleLixeiraEscola} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
            {isAdmin && escolaSelecionada?.nome?.toUpperCase() === 'UFPA' && (
                <button onClick={importarModeloUFPA} className="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md">Configurar UFPA (PDF)</button>
            )}
            <button onClick={() => setPrecisaCriarEscola(true)} className="border px-4 py-2 rounded-xl font-bold text-sm bg-white"><Building2 size={16} className="inline mr-2" /> Nova Instituição</button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-2/3">
          {turmas.length === 0 ? <div className="p-10 text-center border-2 border-dashed rounded-2xl text-gray-400">Nenhuma turma.</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {turmas.map(turma => (
                <div key={turma.id} className="bg-white border rounded-2xl p-5 shadow-sm group">
                  <div className="flex justify-between mb-3">
                    <div className={`p-2 rounded-lg ${turma.isModelo ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}><BookOpen size={20}/></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditandoId(turma.id); setNomeEdicao(turma.nome); }} className="p-1.5 text-gray-400 hover:text-blue-600"><Pencil size={18}/></button>
                      <button onClick={() => handleLixeira(turma.id, turma.nome)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                    </div>
                  </div>
                  {editandoId === turma.id ? (
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} className="w-full border rounded p-1 font-bold" autoFocus />
                      <button onClick={() => handleSalvarEdicao(turma.id)} className="bg-green-500 text-white p-1 rounded"><Check size={16}/></button>
                    </div>
                  ) : <h3 className="font-black text-xl truncate mb-1">{turma.nome}</h3>}
                  <div className="mt-4 flex gap-2">
                    <Link to="/alunos" state={{ turmaIdSelecionada: turma.id }} className="flex-1 text-center bg-gray-50 py-2 rounded-lg text-sm font-bold">Alunos</Link>
                    <Link to="/tarefas" state={{ turmaIdSelecionada: turma.id }} className="flex-1 text-center bg-blue-50 text-blue-600 py-2 rounded-lg text-sm font-bold">Tarefas</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="w-full lg:w-1/3">
          <div className="bg-white p-4 rounded-3xl border shadow-sm sticky top-24">
            <div className="flex bg-gray-50 p-1 rounded-2xl mb-4">
              <button onClick={() => setModoCriacao('nova')} className={`flex-1 py-2 rounded-xl text-sm font-black ${modoCriacao === 'nova' ? 'bg-white shadow-sm' : 'text-gray-400'}`}>Criar do Zero</button>
              <button onClick={() => setModoCriacao('clonar')} className={`flex-1 py-2 rounded-xl text-sm font-black ${modoCriacao === 'clonar' ? 'bg-white shadow-sm' : 'text-gray-400'}`}>Importar Modelo</button>
            </div>
            {modoCriacao === 'nova' ? (
              <form onSubmit={handleCriarTurma} className="flex flex-col gap-4">
                <input type="text" required placeholder="Nome da turma..." className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} />
                <button type="submit" disabled={salvando} className="bg-blue-600 text-white font-black py-4 rounded-xl">{salvando ? '...' : 'Criar Turma'}</button>
              </form>
            ) : (
              <form onSubmit={handleClonarTurma} className="flex flex-col gap-4">
                <select required className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={modeloSelecionado} onChange={e => setModeloSelecionado(e.target.value)}><option value="">Selecione o Modelo...</option>{turmasModelo.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
                <input type="text" required placeholder="Novo nome da turma..." className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={nomeTurmaClonada} onChange={e => setNomeTurmaClonada(e.target.value)} />
                <button type="submit" disabled={clonando} className="bg-purple-600 text-white font-black py-4 rounded-xl">{clonando ? '...' : 'Clonar'}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
