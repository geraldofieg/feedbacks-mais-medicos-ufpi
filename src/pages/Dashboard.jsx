import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ArrowRight, GraduationCap, Building2, Pencil, Trash2, ChevronRight, CheckCheck, Clock, Calendar, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, userProfile, escolaSelecionada, setEscolaSelecionada } = useAuth();
  const isAdmin = currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const planoUsuario = userProfile?.plano || 'basico'; 
  const mostrarRevisao = isAdmin || planoUsuario === 'intermediario' || planoUsuario === 'premium';
  
  const [instituicoes, setInstituicoes] = useState([]);
  const [loadingInst, setLoadingInst] = useState(true);
  const [minhasTurmas, setMinhasTurmas] = useState([]);
  const [loadingDados, setLoadingDados] = useState(false);
  const [kanban, setKanban] = useState({ pendentes: 0, faltaLancar: 0, finalizados: 0 });

  // 1. BUSCA INSTITUIÇÕES (Ocultando a lixeira)
  useEffect(() => {
    async function fetchInstituicoes() {
      if (!currentUser) return;
      try {
        const instRef = collection(db, 'instituicoes');
        const qInst = isAdmin ? instRef : query(instRef, where('professorUid', '==', currentUser.uid));
        const snap = await getDocs(qInst);
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(inst => inst.status !== 'lixeira') // Filtro de segurança
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
        setInstituicoes(lista);
        if (lista.length > 0 && !escolaSelecionada) setEscolaSelecionada(lista[0]);
      } catch (e) { console.error(e); } finally { setLoadingInst(false); }
    }
    fetchInstituicoes();
  }, [currentUser, isAdmin, escolaSelecionada, setEscolaSelecionada]);

  // 2. BUSCA DADOS DO KANBAN
  useEffect(() => {
    async function fetchDados() {
      if (!currentUser || !escolaSelecionada?.id) return;
      
      setLoadingDados(true);
      setKanban({ pendentes: 0, faltaLancar: 0, finalizados: 0 });

      try {
        const turmasRef = collection(db, 'turmas');
        const qTurmas = query(turmasRef, where('instituicaoId', '==', escolaSelecionada.id));
        const snapT = await getDocs(qTurmas);
        const turmasVivas = snapT.docs.map(t => ({ id: t.id, ...t.data() })).filter(t => t.status !== 'lixeira');
        setMinhasTurmas(turmasVivas);

        if (turmasVivas.length > 0) {
          const tIds = turmasVivas.map(t => t.id);
          const qAtiv = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
          const snapA = await getDocs(qAtiv);
          
          let p = 0, f = 0, ok = 0;
          snapA.docs.forEach(doc => {
            const d = doc.data();
            if (tIds.includes(d.turmaId)) {
              if (d.postado) ok++;
              else if (d.status === 'aprovado') f++;
              else p++;
            }
          });
          setKanban({ pendentes: p, faltaLancar: f, finalizados: ok });
        }
      } catch (e) { console.error(e); } finally { setLoadingDados(false); }
    }
    fetchDados();
  }, [currentUser, escolaSelecionada]);

  async function handleLixeiraInstituicao(e, id) {
    e.stopPropagation();
    if (!window.confirm("Enviar esta instituição para a lixeira?")) return;
    await updateDoc(doc(db, 'instituicoes', id), { status: 'lixeira' });
    setInstituicoes(prev => prev.filter(i => i.id !== id));
    setEscolaSelecionada(null);
  }

  if (loadingInst) return <div className="p-10 text-center animate-pulse">Carregando...</div>;

  if (!escolaSelecionada) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center">
        <h1 className="text-2xl font-black mb-4">Selecione uma Instituição</h1>
        <div className="space-y-3">
          {instituicoes.map(inst => (
            <div key={inst.id} onClick={() => setEscolaSelecionada(inst)} className="p-5 bg-white border rounded-2xl cursor-pointer hover:bg-blue-50 flex justify-between items-center group shadow-sm">
              <span className="font-bold text-gray-700">{inst.nome}</span>
              <button onClick={(e) => handleLixeiraInstituicao(e, inst.id)} className="p-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
            </div>
          ))}
          {instituicoes.length === 0 && <p className="text-gray-400">Nenhuma instituição ativa encontrada.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b pb-6 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Centro de Comando</h1>
          <select className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg py-1.5 px-3 font-bold outline-none mt-2 cursor-pointer shadow-inner" 
            value={escolaSelecionada.id} 
            onChange={(e) => {
              if (e.target.value === 'NOVA') setEscolaSelecionada(null);
              else {
                const inst = instituicoes.find(i => i.id === e.target.value);
                if (inst) setEscolaSelecionada(inst);
              }
            }}
          >
            {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
            <option value="NOVA">+ Trocar/Nova Instituição</option>
          </select>
        </div>
      </div>

      {minhasTurmas.length === 0 && !loadingDados ? (
        <div className="bg-blue-50 border-2 border-dashed p-12 rounded-3xl text-center border-blue-200">
          <Building2 className="mx-auto text-blue-400 mb-4" size={48}/>
          <h2 className="text-xl font-black text-blue-900">Instituição Vazia</h2>
          <p className="text-blue-700 mb-6 font-medium">A migração criou a base, mas esta turma não tem dados ativos. Confira na aba Turmas.</p>
          <Link to="/turmas" className="bg-blue-600 text-white font-black py-3 px-10 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Ir para Turmas</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {mostrarRevisao && (
            <div className="bg-white border border-yellow-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                 <h3 className="text-xs font-black text-yellow-600 uppercase tracking-widest">Aguardando Revisão</h3>
                 <div className="bg-yellow-50 p-2 rounded-lg text-yellow-500"><Clock size={24}/></div>
              </div>
              <span className="text-5xl font-black text-gray-800">{loadingDados ? '...' : kanban.pendentes}</span>
              {kanban.pendentes > 0 && <Link to="/aguardandorevisao" className="mt-6 text-xs font-bold text-yellow-600 flex items-center gap-1 hover:underline">Ver Lista <ChevronRight size={14}/></Link>}
            </div>
          )}
          <div className="bg-white border border-green-200 p-8 rounded-3xl shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xs font-black text-green-600 uppercase tracking-widest">Finalizados (Migrados)</h3>
              <div className="bg-green-50 p-2 rounded-lg text-green-500"><CheckCheck size={24}/></div>
            </div>
            <span className="text-5xl font-black text-gray-800">{loadingDados ? '...' : (kanban.finalizados + kanban.faltaLancar)}</span>
            {(kanban.finalizados + kanban.faltaLancar) > 0 && <Link to="/historico" className="mt-6 text-xs font-bold text-green-600 flex items-center gap-1 hover:underline">Ver Histórico <ChevronRight size={14}/></Link>}
          </div>
        </div>
      )}
    </div>
  );
}
