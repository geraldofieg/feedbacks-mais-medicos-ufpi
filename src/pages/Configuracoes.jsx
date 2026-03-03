import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, deleteDoc, doc, query, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Plus, Trash2, Settings, Building2, Users } from 'lucide-react';

export default function Configuracoes() {
  // Nível 1: Instituições (Workspaces)
  const [instituicoes, setInstituicoes] = useState([]);
  const [novaInstituicao, setNovaInstituicao] = useState('');

  // Nível 2: Turmas
  const [turmas, setTurmas] = useState([]);
  const [novaTurma, setNovaTurma] = useState('');
  const [instituicaoSelecionadaParaTurma, setInstituicaoSelecionadaParaTurma] = useState('');
  
  const [salvando, setSalvando] = useState(false);

  // 1. Busca as Instituições (Nível 1)
  useEffect(() => {
    const qInst = query(collection(db, 'saas_instituicoes'), orderBy('dataCriacao', 'desc'));
    const unsubInst = onSnapshot(qInst, (snap) => {
      setInstituicoes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubInst();
  }, []);

  // 2. Busca as Turmas (Nível 2)
  useEffect(() => {
    const qTurmas = query(collection(db, 'saas_turmas'), orderBy('dataCriacao', 'desc'));
    const unsubTurmas = onSnapshot(qTurmas, (snap) => {
      setTurmas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubTurmas();
  }, []);

  // ==========================================
  // AÇÕES NÍVEL 1: INSTITUIÇÃO
  // ==========================================
  async function handleAddInstituicao(e) {
    e.preventDefault();
    if (salvando || !novaInstituicao.trim()) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'saas_instituicoes'), { 
        nome: novaInstituicao.trim(),
        dataCriacao: serverTimestamp()
      });
      setNovaInstituicao('');
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  async function handleExcluirInstituicao(id) {
    if (window.confirm('Excluir esta Instituição? (Isso deixará as turmas dela órfãs no futuro)')) {
      setSalvando(true);
      try { await deleteDoc(doc(db, 'saas_instituicoes', id)); } finally { setSalvando(false); }
    }
  }

  // ==========================================
  // AÇÕES NÍVEL 2: TURMA
  // ==========================================
  async function handleAddTurma(e) {
    e.preventDefault();
    if (salvando || !novaTurma.trim() || !instituicaoSelecionadaParaTurma) return;
    setSalvando(true);
    try {
      await addDoc(collection(db, 'saas_turmas'), { 
        idInstituicao: instituicaoSelecionadaParaTurma,
        nome: novaTurma.trim(),
        dataCriacao: serverTimestamp()
      });
      setNovaTurma('');
    } catch (error) { console.error("Erro:", error); } finally { setSalvando(false); }
  }

  async function handleExcluirTurma(id) {
    if (window.confirm('Excluir esta Turma?')) {
      setSalvando(true);
      try { await deleteDoc(doc(db, 'saas_turmas', id)); } finally { setSalvando(false); }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors"><ArrowLeft size={24} /></Link>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="text-blue-600" /> Configurações V2 (SaaS)
          </h2>
        </div>

        {/* ================= NÍVEL 1 ================= */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-indigo-900 mb-6 flex items-center gap-2 border-b pb-4">
            <Building2 size={24} className="text-indigo-600" /> Nível 1: Instituições (Workspaces)
          </h3>
          
          <form onSubmit={handleAddInstituicao} className="mb-6 flex gap-2">
            <input required type="text" placeholder="Ex: UFPI, USP, Mentoria Particular..." className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={novaInstituicao} onChange={e => setNovaInstituicao(e.target.value)} />
            <button type="submit" disabled={salvando} className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-bold disabled:opacity-50 flex items-center gap-2">
              <Plus size={20} /> Adicionar
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {instituicoes.length === 0 && <p className="text-sm text-gray-400 italic col-span-3">Nenhuma instituição cadastrada.</p>}
            {instituicoes.map(inst => (
              <div key={inst.id} className="border border-indigo-100 bg-indigo-50 p-4 rounded-xl flex justify-between items-center shadow-sm">
                <span className="font-bold text-indigo-900">{inst.nome}</span>
                <button onClick={() => handleExcluirInstituicao(inst.id)} disabled={salvando} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* ================= NÍVEL 2 ================= */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-black text-teal-900 mb-6 flex items-center gap-2 border-b pb-4">
            <Users size={24} className="text-teal-600" /> Nível 2: Turmas / Disciplinas
          </h3>
          
          <form onSubmit={handleAddTurma} className="mb-6 space-y-4 bg-teal-50 p-5 rounded-xl border border-teal-100">
            <div>
              <label className="block text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">Vincular a qual Instituição? *</label>
              <select required className="w-full p-3 border border-teal-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white" value={instituicaoSelecionadaParaTurma} onChange={e => setInstituicaoSelecionadaParaTurma(e.target.value)}>
                <option value="">Selecione uma Instituição...</option>
                {instituicoes.map(inst => <option key={inst.id} value={inst.id}>{inst.nome}</option>)}
              </select>
            </div>
            
            <div className="flex gap-2">
              <input required type="text" placeholder="Ex: Turma Matutino - 2026/1" className="flex-1 p-3 border border-teal-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500" value={novaTurma} onChange={e => setNovaTurma(e.target.value)} disabled={!instituicaoSelecionadaParaTurma} />
              <button type="submit" disabled={salvando || !instituicaoSelecionadaParaTurma} className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors font-bold disabled:opacity-50 flex items-center gap-2">
                <Plus size={20} /> Criar Turma
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {turmas.length === 0 && <p className="text-sm text-gray-400 italic col-span-2">Nenhuma turma cadastrada.</p>}
            {turmas.map(turma => {
              const instPai = instituicoes.find(i => i.id === turma.idInstituicao);
              return (
                <div key={turma.id} className="border border-gray-200 bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                  <div>
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block mb-1">{instPai ? instPai.nome : 'Instituição Órfã'}</span>
                    <span className="font-bold text-gray-800 block leading-tight">{turma.nome}</span>
                  </div>
                  <button onClick={() => handleExcluirTurma(turma.id)} disabled={salvando} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
