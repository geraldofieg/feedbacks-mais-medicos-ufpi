import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  getDoc, serverTimestamp, query, where
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import {
  Stethoscope, Plus, Pencil, Trash2, Save, X,
  LogOut, CheckCircle2, AlertTriangle, RefreshCw,
  User, MapPin, Hash, Phone, Mail, Users, FileText, Copy, Check
} from 'lucide-react';

// ── Guard: verifica se é supervisor ativo ────────────────────────────────────
async function verificarAcesso(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return { ok: false, motivo: 'Conta não encontrada.' };
  const p = snap.data();
  if (p.role !== 'supervisor') return { ok: false, motivo: 'Conta sem permissão de supervisor.' };
  if (p.status === 'bloqueado') return { ok: false, motivo: 'Conta suspensa. Entre em contato.' };
  if (p.isVitalicio) return { ok: true, perfil: p };
  if (p.dataExpiracao) {
    const exp = p.dataExpiracao.toDate ? p.dataExpiracao.toDate() : new Date(p.dataExpiracao.seconds * 1000);
    if (new Date() > exp) return { ok: false, motivo: 'Sua assinatura venceu. Renove para continuar.' };
  }
  return { ok: true, perfil: p };
}

const CAMPOS = [
  { key: 'nome',               label: 'Nome do médico',         ph: 'Nome completo',          tipo: 'text',   col: 2 },
  { key: 'cidade',             label: 'Cidade',                  ph: 'Ex: Porto Nacional',     tipo: 'text',   col: 1 },
  { key: 'regiao',             label: 'Região / Núcleo',         ph: 'Ex: Amor Perfeito',      tipo: 'text',   col: 1 },
  { key: 'cnes',               label: 'CNES',                    ph: '0000000',                tipo: 'text',   col: 1 },
  { key: 'telefoneUnidade',    label: 'Telefone da Unidade',     ph: '63 9 9999-0000',         tipo: 'text',   col: 1 },
  { key: 'email',              label: 'E-mail da Unidade',       ph: 'ubs@gmail.com',          tipo: 'email',  col: 2 },
  { key: 'populacao',          label: 'População coberta',       ph: '3500',                   tipo: 'text',   col: 1 },
  { key: 'responsavel',        label: 'Responsável pela UBS',    ph: 'Nome do responsável',    tipo: 'text',   col: 1 },
  { key: 'telefoneResponsavel',label: 'Telefone do Responsável', ph: '63 9 9999-0000',         tipo: 'text',   col: 1 },
  { key: 'numEquipes',         label: 'Nº de Equipes',           ph: '2',                      tipo: 'text',   col: 1 },
  { key: 'zona',               label: 'Zona',                    ph: '',                       tipo: 'select', col: 1, opts: ['URBANA','RURAL','MISTA'] },
  { key: 'obs',                label: 'Observações',             ph: 'Férias, segunda unidade...',tipo:'textarea',col:2},
];

const EMPTY = Object.fromEntries(CAMPOS.map(c => [c.key, '']));

export default function SupervisorPainel() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [bloqueado, setBloqueado] = useState(null);
  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState(false);
  const [copiado, setCopiado] = useState('');

  const uid = auth.currentUser?.uid;
  const colRef = uid ? collection(db, 'medicosSupervisionados', uid, 'medicos') : null;

  useEffect(() => {
    if (!uid) { navigate('/supervisor/login'); return; }
    verificarAcesso(uid).then(({ ok, motivo, perfil: p }) => {
      if (!ok) { setBloqueado(motivo); setLoading(false); return; }
      setPerfil(p);
      getDocs(colRef).then(snap => {
        setMedicos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nome?.localeCompare(b.nome)));
        setLoading(false);
      });
    });
  }, [uid]);

  function abrirNovo() { setForm(EMPTY); setEditandoId(null); setModal(true); }
  function abrirEdicao(m) { setForm({ ...EMPTY, ...m }); setEditandoId(m.id); setModal(true); }
  function fecharModal() { setModal(false); setForm(EMPTY); setEditandoId(null); }

  async function handleSalvar() {
    if (!form.nome?.trim()) return alert('Nome obrigatório.');
    setSalvando(true);
    try {
      const payload = { ...form, multipleUnits: false, updatedAt: serverTimestamp() };
      if (editandoId) {
        await updateDoc(doc(db, 'medicosSupervisionados', uid, 'medicos', editandoId), payload);
        setMedicos(prev => prev.map(m => m.id === editandoId ? { ...m, ...payload } : m));
      } else {
        payload.createdAt = serverTimestamp();
        const ref = await addDoc(colRef, payload);
        setMedicos(prev => [...prev, { id: ref.id, ...payload }].sort((a, b) => a.nome?.localeCompare(b.nome)));
      }
      fecharModal();
    } catch (e) { console.error(e); alert('Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  async function handleExcluir(id, nome) {
    if (!window.confirm(`Remover ${nome}?`)) return;
    await deleteDoc(doc(db, 'medicosSupervisionados', uid, 'medicos', id));
    setMedicos(prev => prev.filter(m => m.id !== id));
  }

  function copiarJSON() {
    const data = medicos.map(({ id, createdAt, updatedAt, ...rest }) => rest);
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiado('json'); setTimeout(() => setCopiado(''), 2000);
  }

  async function handleLogout() {
    await signOut(auth); navigate('/supervisor/login');
  }

  // Calcular dias restantes
  let diasRestantes = null;
  if (perfil && !perfil.isVitalicio && perfil.dataExpiracao) {
    const exp = perfil.dataExpiracao.toDate ? perfil.dataExpiracao.toDate() : new Date(perfil.dataExpiracao.seconds * 1000);
    diasRestantes = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold animate-pulse">Carregando...</div>;

  if (bloqueado) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-200">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-black text-gray-800 mb-3">Acesso bloqueado</h2>
        <p className="text-gray-600 font-medium mb-6">{bloqueado}</p>
        <button onClick={handleLogout} className="text-sm text-blue-600 font-bold hover:underline">Sair</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl"><Stethoscope size={22}/></div>
            <div>
              <h1 className="font-black text-gray-800 text-lg leading-none">Portal do Supervisor</h1>
              <p className="text-[11px] text-gray-400 font-medium">Mais Médicos · {perfil?.nome || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {diasRestantes !== null && (
              <span className={`text-[11px] font-black px-3 py-1.5 rounded-full ${diasRestantes <= 5 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {diasRestantes > 0 ? `Trial: ${diasRestantes} dias` : 'Trial vencido'}
              </span>
            )}
            {perfil?.isVitalicio && <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-green-50 text-green-600">Vitalício</span>}
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 text-sm font-bold transition-colors">
              <LogOut size={16}/> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Aviso de vencimento próximo */}
        {diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5"/>
            <p className="text-sm font-bold text-amber-700">Seu trial vence em {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''}. Entre em contato para renovar e não perder o acesso.</p>
          </div>
        )}

        {/* TOPO COM AÇÕES */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-gray-800">Médicos Supervisionados</h2>
            <p className="text-gray-500 text-sm font-medium">{medicos.length} médico{medicos.length !== 1 ? 's' : ''} cadastrado{medicos.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={copiarJSON}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
              title="Copiar dados em JSON para uso na extensão">
              {copiado === 'json' ? <><Check size={14}/> Copiado!</> : <><Copy size={14}/> Exportar JSON</>}
            </button>
            <button onClick={abrirNovo}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-md">
              <Plus size={16}/> Adicionar Médico
            </button>
          </div>
        </div>

        {/* INSTRUÇÃO DA EXTENSÃO */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-800 font-medium">
          <strong>Como usar com a extensão:</strong> Os dados aqui ficam sincronizados com a extensão do Chrome automaticamente. Se ainda não instalou, entre em contato para receber o link.
        </div>

        {/* LISTA DE MÉDICOS */}
        {medicos.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center">
            <Stethoscope size={48} className="mx-auto text-gray-200 mb-4"/>
            <p className="text-gray-500 font-bold mb-2">Nenhum médico cadastrado ainda</p>
            <p className="text-gray-400 text-sm mb-6">Adicione os médicos que você supervisiona para usar com a extensão.</p>
            <button onClick={abrirNovo} className="bg-blue-600 text-white font-black px-8 py-3 rounded-xl hover:bg-blue-700 transition-all">
              Adicionar primeiro médico
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {medicos.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-xl shrink-0"><User size={18}/></div>
                    <div>
                      <p className="font-black text-gray-800 leading-snug">{m.nome}</p>
                      <p className="text-xs text-gray-500 font-medium">{m.cidade} · {m.regiao}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => abrirEdicao(m)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={15}/></button>
                    <button onClick={() => handleExcluir(m.id, m.nome)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-600">
                  {m.cnes && <span className="flex items-center gap-1"><Hash size={11}/> CNES: {m.cnes}</span>}
                  {m.numEquipes && <span className="flex items-center gap-1"><Users size={11}/> {m.numEquipes} equipe(s)</span>}
                  {m.zona && <span className="flex items-center gap-1"><MapPin size={11}/> {m.zona}</span>}
                  {m.populacao && <span className="flex items-center gap-1"><Users size={11}/> Pop: {m.populacao}</span>}
                  {m.responsavel && <span className="flex items-center gap-1 col-span-2"><User size={11}/> {m.responsavel}</span>}
                </div>
                {m.obs && (
                  <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
                    ⚠️ {m.obs}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* MODAL CADASTRO/EDIÇÃO */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <h3 className="font-black text-gray-800 text-lg">{editandoId ? 'Editar Médico' : 'Novo Médico'}</h3>
              <button onClick={fecharModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X size={18}/></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {CAMPOS.map(({ key, label, ph, tipo, col, opts }) => (
                <div key={key} className={col === 2 ? 'col-span-2' : 'col-span-1'}>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">{label}</label>
                  {tipo === 'select' ? (
                    <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm">
                      <option value="">Selecione...</option>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : tipo === 'textarea' ? (
                    <textarea rows="2" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm resize-none"/>
                  ) : (
                    <input type={tipo} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"/>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={fecharModal} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando}
                className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {salvando ? <><RefreshCw size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
                        }
      
