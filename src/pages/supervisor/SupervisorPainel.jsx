import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  getDoc, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import {
  Stethoscope, Plus, Pencil, Trash2, Save, X,
  LogOut, AlertTriangle, RefreshCw,
  User, MapPin, Hash, Phone, Users, Download,
  Sparkles, FileText, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Guard ────────────────────────────────────────────────────────────────────
async function verificarAcesso(uid) {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return { ok: false, motivo: 'Conta não encontrada.' };
  const p = snap.data();
  const ehSupervisor = p.role === 'supervisor';
  const ehProfessorComAcesso = p.role === 'professor' && p.supervisorAccess === true;
  if (!ehSupervisor && !ehProfessorComAcesso) return { ok: false, motivo: 'Conta sem permissão de supervisor.' };
  if (p.status === 'bloqueado') return { ok: false, motivo: 'Conta suspensa. Entre em contato.' };
  if (ehSupervisor) {
    if (p.isVitalicio) return { ok: true, perfil: p };
    if (p.dataExpiracao) {
      const exp = p.dataExpiracao.toDate ? p.dataExpiracao.toDate() : new Date(p.dataExpiracao.seconds * 1000);
      if (new Date() > exp) return { ok: false, motivo: 'Sua assinatura venceu. Renove para continuar.' };
    }
    return { ok: true, perfil: p };
  }
  if (ehProfessorComAcesso) {
    if (p.supervisorDataExpiracao) {
      const exp = p.supervisorDataExpiracao.toDate
        ? p.supervisorDataExpiracao.toDate()
        : new Date(p.supervisorDataExpiracao.seconds ? p.supervisorDataExpiracao.seconds * 1000 : p.supervisorDataExpiracao);
      if (new Date() > exp) return { ok: false, motivo: 'Seu acesso ao Portal do Supervisor venceu. Renove para continuar.' };
    }
    return { ok: true, perfil: p };
  }
  return { ok: true, perfil: p };
}

const CAMPOS = [
  { key: 'nome',                label: 'Nome do médico',          ph: 'Nome completo',             tipo: 'text',     col: 2 },
  { key: 'cidade',              label: 'Cidade',                   ph: 'Ex: Porto Nacional',        tipo: 'text',     col: 1 },
  { key: 'regiao',              label: 'Região / Núcleo',          ph: 'Ex: Amor Perfeito',         tipo: 'text',     col: 1 },
  { key: 'cnes',                label: 'CNES',                     ph: '0000000',                   tipo: 'text',     col: 1 },
  { key: 'telefoneUnidade',     label: 'Telefone da Unidade',      ph: '63 9 9999-0000',            tipo: 'text',     col: 1 },
  { key: 'email',               label: 'E-mail da Unidade',        ph: 'ubs@gmail.com',             tipo: 'email',    col: 2 },
  { key: 'populacao',           label: 'População coberta',        ph: '3500',                      tipo: 'text',     col: 1 },
  { key: 'responsavel',         label: 'Responsável pela UBS',     ph: 'Nome do responsável',       tipo: 'text',     col: 1 },
  { key: 'telefoneResponsavel', label: 'Telefone do Responsável',  ph: '63 9 9999-0000',            tipo: 'text',     col: 1 },
  { key: 'numEquipes',          label: 'Nº de Equipes',            ph: '2',                         tipo: 'text',     col: 1 },
  { key: 'zona',                label: 'Zona',                     ph: '',                          tipo: 'select',   col: 1, opts: ['URBANA','RURAL','MISTA'] },
  { key: 'obs',                 label: 'Observações',              ph: 'Férias, segunda unidade...', tipo: 'textarea', col: 2 },
];
const EMPTY = Object.fromEntries(CAMPOS.map(c => [c.key, '']));

// ── URL do ZIP da extensão (substitua pelo link do Firebase Storage) ──────────
const URL_EXTENSAO_ZIP = 'COLE_AQUI_O_LINK_DO_ZIP';

export default function SupervisorPainel() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [bloqueado, setBloqueado] = useState(null);
  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal cadastro manual
  const [form, setForm] = useState(EMPTY);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState(false);

  // Importar via IA
  const [modalIA, setModalIA] = useState(false);
  const [etapaIA, setEtapaIA] = useState('entrada'); // 'entrada' | 'processando' | 'revisao' | 'salvando'
  const [textoColado, setTextoColado] = useState('');
  const [erroIA, setErroIA] = useState('');
  const [medicosParseados, setMedicosParseados] = useState([]); // [{...campos}]
  const [salvandoIA, setSalvandoIA] = useState(false);
  const fileInputRef = useRef(null);

  // Guia instalação
  const [guiaAberto, setGuiaAberto] = useState(false);

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

  // ── Cadastro manual ────────────────────────────────────────────────────────
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

  async function handleLogout() { await signOut(auth); navigate('/supervisor/login'); }

  // ── Importação via IA ─────────────────────────────────────────────────────
  function abrirModalIA() {
    setTextoColado(''); setErroIA(''); setMedicosParseados([]);
    setEtapaIA('entrada'); setModalIA(true);
  }
  function fecharModalIA() { setModalIA(false); }

  async function handleAnexo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'pdf') {
        // PDF via pdfjs
        const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let texto = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i);
          const content = await pg.getTextContent();
          texto += content.items.map(s => s.str).join(' ') + '\n';
        }
        setTextoColado(prev => prev + '\n' + texto);
      } else if (ext === 'docx') {
        const mammoth = await import('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        setTextoColado(prev => prev + '\n' + res.value);
      } else if (ext === 'txt') {
        const texto = await file.text();
        setTextoColado(prev => prev + '\n' + texto);
      } else {
        alert('Formatos aceitos: PDF, Word (.docx) ou texto (.txt). Para Excel, copie e cole o conteúdo das células.');
      }
    } catch (err) {
      console.error(err);
      alert('Não foi possível ler o arquivo. Tente copiar e colar o texto manualmente.');
    }
    e.target.value = '';
  }

  async function handleProcessarIA() {
    if (!textoColado.trim()) { setErroIA('Cole ou annexe algum conteúdo antes de continuar.'); return; }
    setErroIA('');
    setEtapaIA('processando');

    const prompt = `Você é um assistente de extração de dados médicos.
Analise o texto abaixo e extraia os dados de TODOS os médicos supervisionados mencionados.
Para cada médico, preencha um objeto JSON com os seguintes campos (use string vazia "" se não encontrar o dado):
- nome: nome completo do médico
- cidade: cidade onde trabalha
- regiao: região ou núcleo de supervisão
- cnes: código CNES da unidade (só números)
- telefoneUnidade: telefone da unidade de saúde
- email: e-mail da unidade
- populacao: população coberta (só números)
- responsavel: nome do responsável pela UBS
- telefoneResponsavel: telefone do responsável
- numEquipes: número de equipes de saúde (só números)
- zona: URBANA, RURAL ou MISTA (em maiúsculas)
- obs: observações relevantes sobre este médico

Responda SOMENTE com um array JSON válido, sem explicações, sem markdown, sem texto antes ou depois.
Exemplo: [{"nome":"João Silva","cidade":"Porto Nacional",...}]

TEXTO COM OS DADOS:
${textoColado}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      const textoResposta = data.content?.[0]?.text || '';
      const limpo = textoResposta.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(limpo);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Nenhum médico encontrado no texto.');
      setMedicosParseados(parsed.map(m => ({ ...EMPTY, ...m })));
      setEtapaIA('revisao');
    } catch (err) {
      console.error(err);
      setErroIA('A IA não conseguiu interpretar o texto. Verifique se o conteúdo está legível e tente novamente.');
      setEtapaIA('entrada');
    }
  }

  async function handleSalvarIA() {
    setSalvandoIA(true);
    setEtapaIA('salvando');
    try {
      const novos = [];
      for (const m of medicosParseados) {
        if (!m.nome?.trim()) continue;
        const payload = { ...m, multipleUnits: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        const ref = await addDoc(colRef, payload);
        novos.push({ id: ref.id, ...payload });
      }
      setMedicos(prev => [...prev, ...novos].sort((a, b) => a.nome?.localeCompare(b.nome)));
      fecharModalIA();
      alert(`✅ ${novos.length} médico(s) salvos com sucesso!`);
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar. Tente novamente.');
      setEtapaIA('revisao');
    } finally {
      setSalvandoIA(false);
    }
  }

  // Dias restantes
  let diasRestantes = null;
  if (perfil && !perfil.isVitalicio && perfil.dataExpiracao) {
    const exp = perfil.dataExpiracao.toDate ? perfil.dataExpiracao.toDate() : new Date(perfil.dataExpiracao.seconds * 1000);
    diasRestantes = Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 font-bold animate-pulse">Carregando...</div>;

  if (bloqueado) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-200">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4"/>
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

        {/* Aviso vencimento */}
        {diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5"/>
            <p className="text-sm font-bold text-amber-700">Seu trial vence em {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''}. Entre em contato para renovar.</p>
          </div>
        )}

        {/* ── GUIA DE INSTALAÇÃO DA EXTENSÃO ── */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
          <button
            onClick={() => setGuiaAberto(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-green-100 text-green-700 p-2 rounded-xl"><Download size={18}/></div>
              <div>
                <p className="font-black text-gray-800">Ainda não instalou a extensão do Chrome?</p>
                <p className="text-xs text-gray-500 font-medium">Baixe aqui e siga o passo a passo — leva menos de 5 minutos</p>
              </div>
            </div>
            {guiaAberto ? <ChevronUp size={18} className="text-gray-400 shrink-0"/> : <ChevronDown size={18} className="text-gray-400 shrink-0"/>}
          </button>

          {guiaAberto && (
            <div className="px-5 pb-6 border-t border-gray-100">
              <a href={URL_EXTENSAO_ZIP} download
                className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-black py-3 px-5 rounded-xl hover:bg-green-700 transition-all shadow-md mt-5 mb-6 text-sm">
                <Download size={16}/> Baixar extensão (arquivo .zip)
              </a>
              <ol className="space-y-4">
                {[
                  { n:1, titulo:'Baixe e salve em lugar seguro', texto:'Quando o download terminar, NÃO deixe na pasta Downloads — ela pode ser apagada acidentalmente. Mova o arquivo para Documentos ou crie uma pasta chamada "Extensão Mais Médicos" em qualquer lugar do seu computador.' },
                  { n:2, titulo:'Descompacte o arquivo', texto:'Clique com o botão direito no arquivo que você baixou e escolha "Extrair tudo" (no Windows) ou clique duas vezes (no Mac). Uma pasta será criada — guarde essa pasta no mesmo lugar seguro.' },
                  { n:3, titulo:'Abra o Google Chrome e acesse as extensões', texto:'Clique nos três pontinhos (⋮) no canto superior direito do Chrome → Extensões → Gerenciar extensões. Ou copie e cole na barra de endereço: chrome://extensions' },
                  { n:4, titulo:'Ative o Modo desenvolvedor', texto:'No canto superior direito da tela de extensões, ative a chave chamada Modo do desenvolvedor. Três botões novos vão aparecer.' },
                  { n:5, titulo:'Clique em "Carregar sem compactação"', texto:'Clique nesse botão e selecione a PASTA que foi criada no passo 2 (não o arquivo .zip em si, mas a pasta que ficou dentro dele após a extração).' },
                  { n:'✓', titulo:'Pronto! A extensão está instalada.', texto:'O ícone vai aparecer na barra do Chrome. Mas atenção: os médicos ainda não aparecem lá — você precisa cadastrá-los primeiro. Desça a página, use o botão "Importar com IA" ou "Adicionar manualmente" para incluir os médicos. Só depois de salvar é que eles aparecem automaticamente na extensão.', ok: true },
                ].map(({ n, titulo, texto, ok }) => (
                  <li key={n} className="flex items-start gap-3">
                    <span className={`w-7 h-7 min-w-[28px] rounded-full flex items-center justify-center text-xs font-black text-white ${ok ? 'bg-green-500' : 'bg-blue-600'}`}>{n}</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium">
                💡 <strong>Importante:</strong> Depois de instalar, você não precisa mais do arquivo .zip para o dia a dia. Seus dados ficam salvos aqui neste portal. Mas guarde a pasta em lugar seguro — se precisar reinstalar o Chrome no futuro, você vai precisar dela.
              </div>
            </div>
          )}
        </div>

        {/* ── TOPO COM AÇÕES ── */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-gray-800">Médicos Supervisionados</h2>
            <p className="text-gray-500 text-sm font-medium">{medicos.length} médico{medicos.length !== 1 ? 's' : ''} cadastrado{medicos.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={abrirModalIA}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl font-black text-sm hover:bg-purple-700 transition-all shadow-md">
              <Sparkles size={16}/> Importar com IA
            </button>
            <button onClick={abrirNovo}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-md">
              <Plus size={16}/> Adicionar manualmente
            </button>
          </div>
        </div>

        {/* LISTA */}
        {medicos.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center">
            <Stethoscope size={48} className="mx-auto text-gray-200 mb-4"/>
            <p className="text-gray-500 font-bold mb-2">Nenhum médico cadastrado ainda</p>
            <p className="text-gray-400 text-sm mb-6">Use o botão <strong>"Importar com IA"</strong> para cadastrar vários de uma vez, ou <strong>"Adicionar manualmente"</strong> para um por vez.</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <button onClick={abrirModalIA} className="bg-purple-600 text-white font-black px-6 py-3 rounded-xl hover:bg-purple-700 transition-all flex items-center gap-2 text-sm">
                <Sparkles size={15}/> Importar com IA
              </button>
              <button onClick={abrirNovo} className="bg-blue-600 text-white font-black px-6 py-3 rounded-xl hover:bg-blue-700 transition-all text-sm">
                Adicionar manualmente
              </button>
            </div>
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
                      <p className="text-xs text-gray-500 font-medium">{m.cidade}{m.regiao ? ` · ${m.regiao}` : ''}</p>
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
                  <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">⚠️ {m.obs}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ═══════════════════════════════════════════
          MODAL — CADASTRO MANUAL
      ═══════════════════════════════════════════ */}
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
                      placeholder={ph} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm resize-none"/>
                  ) : (
                    <input type={tipo} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"/>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={fecharModal} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando}
                className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {salvando ? <><RefreshCw size={16} className="animate-spin"/> Salvando...</> : <><CheckCircle2 size={16}/> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL — IMPORTAR VIA IA
      ═══════════════════════════════════════════ */}
      {modalIA && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 text-purple-700 p-2 rounded-xl"><Sparkles size={18}/></div>
                <div>
                  <h3 className="font-black text-gray-800">Importar médicos com Inteligência Artificial</h3>
                  <p className="text-xs text-gray-500">
                    {etapaIA === 'entrada' && 'Cole os dados ou anexe um arquivo — a IA interpreta automaticamente'}
                    {etapaIA === 'processando' && 'Analisando os dados...'}
                    {etapaIA === 'revisao' && `${medicosParseados.length} médico(s) encontrado(s) — revise antes de salvar`}
                    {etapaIA === 'salvando' && 'Salvando...'}
                  </p>
                </div>
              </div>
              {etapaIA !== 'processando' && etapaIA !== 'salvando' && (
                <button onClick={fecharModalIA} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X size={18}/></button>
              )}
            </div>

            {/* ETAPA: ENTRADA */}
            {etapaIA === 'entrada' && (
              <div className="p-6">
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-5 text-sm text-purple-800 font-medium">
                  <strong>Como funciona:</strong> Cole abaixo as informações dos seus médicos — pode ser texto de qualquer formato, de um arquivo Word, Excel, bloco de notas ou e-mail. A IA vai identificar o nome, CNES, cidade, telefone e todos os outros campos automaticamente.
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Cole o texto com os dados dos médicos</label>
                  <textarea
                    rows="10"
                    value={textoColado}
                    onChange={e => setTextoColado(e.target.value)}
                    placeholder={"Cole aqui qualquer texto com os dados dos seus médicos.\n\nExemplos do que funciona:\n• Tabela copiada do Excel\n• Texto de um e-mail\n• Lista do bloco de notas\n• Qualquer formato — a IA entende\n\nEx: Dr. João Silva, Porto Nacional, CNES 1234567, 2 equipes, responsável Maria..."}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-700 outline-none focus:border-purple-400 font-medium text-sm resize-none leading-relaxed"
                  />
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-gray-200"/>
                  <span className="text-xs text-gray-400 font-bold">ou</span>
                  <div className="flex-1 h-px bg-gray-200"/>
                </div>

                <div className="mb-5">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 text-gray-500 rounded-2xl py-4 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all font-bold text-sm">
                    <FileText size={18}/> Anexar arquivo (PDF, Word .docx ou .txt)
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-2">Para Excel: abra o arquivo, selecione as células e cole acima</p>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleAnexo}/>
                </div>

                {textoColado.trim() && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 text-xs text-green-700 font-bold flex items-center gap-2">
                    <CheckCircle2 size={14}/> Conteúdo pronto ({textoColado.length} caracteres). Clique em "Analisar com IA" para continuar.
                  </div>
                )}

                {erroIA && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700 font-bold flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5"/>{erroIA}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={fecharModalIA} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">Cancelar</button>
                  <button onClick={handleProcessarIA} disabled={!textoColado.trim()}
                    className="flex-1 py-3 bg-purple-600 text-white font-black rounded-xl hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-2">
                    <Sparkles size={16}/> Analisar com IA
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA: PROCESSANDO */}
            {etapaIA === 'processando' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <RefreshCw size={32} className="text-purple-600 animate-spin"/>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">Analisando os dados...</h3>
                <p className="text-gray-500 font-medium text-sm">A IA está lendo o texto e identificando os médicos. Isso leva alguns segundos.</p>
              </div>
            )}

            {/* ETAPA: REVISÃO */}
            {etapaIA === 'revisao' && (
              <div className="p-6">
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-black text-amber-800">Revise os dados antes de salvar</p>
                    <p className="text-xs text-amber-700 mt-0.5 font-medium">A IA pode ter cometido algum erro. Confira cada campo e corrija se necessário. Só depois clique em "Confirmar e Salvar" — você assume a responsabilidade pelos dados salvos.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {medicosParseados.map((m, idx) => (
                    <div key={idx} className="border-2 border-purple-100 rounded-2xl p-5 bg-purple-50/30">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black text-purple-600 uppercase tracking-wider">Médico {idx + 1} de {medicosParseados.length}</span>
                        <button
                          onClick={() => setMedicosParseados(prev => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-red-500 font-bold hover:text-red-700 flex items-center gap-1">
                          <Trash2 size={12}/> Remover este
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {CAMPOS.map(({ key, label, ph, tipo, col, opts }) => (
                          <div key={key} className={col === 2 ? 'col-span-2' : 'col-span-1 max-sm:col-span-2'}>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
                            {tipo === 'select' ? (
                              <select value={m[key] || ''} onChange={e => setMedicosParseados(prev => prev.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))}
                                className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-purple-400 text-sm">
                                <option value="">Selecione...</option>
                                {opts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : tipo === 'textarea' ? (
                              <textarea rows="2" value={m[key] || ''} onChange={e => setMedicosParseados(prev => prev.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))}
                                placeholder={ph} className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-purple-400 text-sm resize-none"/>
                            ) : (
                              <input type={tipo} value={m[key] || ''} onChange={e => setMedicosParseados(prev => prev.map((item, i) => i === idx ? { ...item, [key]: e.target.value } : item))}
                                placeholder={ph} className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-purple-400 text-sm"/>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6 sticky bottom-0 bg-white pt-4 pb-2 border-t border-gray-100">
                  <button onClick={() => setEtapaIA('entrada')} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 text-sm">
                    ← Voltar e editar texto
                  </button>
                  <button onClick={handleSalvarIA} disabled={medicosParseados.length === 0}
                    className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
                    <CheckCircle2 size={16}/> Confirmar e Salvar {medicosParseados.length} médico(s)
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA: SALVANDO */}
            {etapaIA === 'salvando' && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <RefreshCw size={32} className="text-green-600 animate-spin"/>
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-2">Salvando médicos...</h3>
                <p className="text-gray-500 font-medium text-sm">Aguarde um momento.</p>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
