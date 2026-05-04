import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../services/firebase';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  Plus, Search, X, Pencil, Trash2, Save, RefreshCw,
  Video, FileText, Link2, Presentation, Tag, Calendar,
  ChevronDown, ExternalLink, Filter, Library
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

const TIPOS = [
  { value: 'video',        label: 'Vídeo (YouTube)',    icon: Video,        cor: 'bg-red-50 text-red-600 border-red-200' },
  { value: 'apresentacao', label: 'Apresentação',        icon: Presentation, cor: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'arquivo',      label: 'Arquivo (PDF/PPT)',   icon: FileText,     cor: 'bg-orange-50 text-orange-600 border-orange-200' },
  { value: 'link',         label: 'Link externo',        icon: Link2,        cor: 'bg-green-50 text-green-600 border-green-200' },
];

const EMPTY = { titulo: '', tipo: 'video', url: '', descricao: '', tags: '' };

function getYoutubeEmbedUrl(url) {
  if (!url) return null;
  const regexes = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of regexes) {
    const match = url.match(re);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

export default function Materiais() {
  const { currentUser } = useAuth();
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroTag, setFiltroTag] = useState('');

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const [expandido, setExpandido] = useState(null);
  const fileInputRef = useRef(null);

  const colRef = currentUser ? collection(db, 'usuarios', currentUser.uid, 'materiais') : null;

  useEffect(() => {
    if (!currentUser) return;
    getDocs(query(colRef, orderBy('dataCriacao', 'desc')))
      .then(snap => {
        setMateriais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentUser]);

  // Todas as tags únicas para o filtro
  const todasTags = [...new Set(materiais.flatMap(m => (m.tags || '').split(',').map(t => t.trim()).filter(Boolean)))].sort();

  // Filtro combinado
  const materiaisFiltrados = materiais.filter(m => {
    const buscaLower = busca.toLowerCase();
    const matchBusca = !busca || m.titulo?.toLowerCase().includes(buscaLower) || m.descricao?.toLowerCase().includes(buscaLower) || m.tags?.toLowerCase().includes(buscaLower);
    const matchTipo = !filtroTipo || m.tipo === filtroTipo;
    const matchTag = !filtroTag || (m.tags || '').split(',').map(t => t.trim()).includes(filtroTag);
    return matchBusca && matchTipo && matchTag;
  });

  function abrirNovo() { setForm(EMPTY); setEditandoId(null); setModal(true); setUploadProgress(null); }
  function abrirEdicao(m) { setForm({ titulo: m.titulo || '', tipo: m.tipo || 'video', url: m.url || '', descricao: m.descricao || '', tags: m.tags || '' }); setEditandoId(m.id); setModal(true); setUploadProgress(null); }
  function fecharModal() { setModal(false); setForm(EMPTY); setEditandoId(null); setUploadProgress(null); }

  async function handleUploadArquivo(file) {
    if (!file) return;
    const storageRef = ref(storage, `materiais/${currentUser.uid}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    return new Promise((resolve, reject) => {
      task.on('state_changed',
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  }

  async function handleSalvar() {
    if (!form.titulo?.trim()) return alert('O título é obrigatório.');
    if (form.tipo !== 'arquivo' && !form.url?.trim()) return alert('Informe o link/URL.');
    setSalvando(true);
    try {
      let urlFinal = form.url;

      // Se for arquivo e o campo URL ainda está vazio e tem arquivo selecionado
      if (form.tipo === 'arquivo' && fileInputRef.current?.files?.[0]) {
        urlFinal = await handleUploadArquivo(fileInputRef.current.files[0]);
      }

      const payload = {
        titulo: form.titulo.trim(),
        tipo: form.tipo,
        url: urlFinal || '',
        descricao: form.descricao.trim(),
        tags: form.tags.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editandoId) {
        await updateDoc(doc(db, 'usuarios', currentUser.uid, 'materiais', editandoId), payload);
        setMateriais(prev => prev.map(m => m.id === editandoId ? { ...m, ...payload } : m));
      } else {
        payload.dataCriacao = serverTimestamp();
        const ref2 = await addDoc(colRef, payload);
        setMateriais(prev => [{ id: ref2.id, ...payload }, ...prev]);
      }
      fecharModal();
    } catch (e) { console.error(e); alert('Erro ao salvar. Tente novamente.'); }
    finally { setSalvando(false); setUploadProgress(null); }
  }

  async function handleExcluir(m) {
    if (!window.confirm(`Excluir "${m.titulo}"?`)) return;
    if (m.tipo === 'arquivo' && m.url) {
      try { await deleteObject(ref(storage, m.url)); } catch {}
    }
    await deleteDoc(doc(db, 'usuarios', currentUser.uid, 'materiais', m.id));
    setMateriais(prev => prev.filter(x => x.id !== m.id));
  }

  function TipoIcon({ tipo, size = 16 }) {
    const t = TIPOS.find(x => x.value === tipo);
    if (!t) return null;
    const Icon = t.icon;
    return <Icon size={size} />;
  }

  function TipoBadge({ tipo }) {
    const t = TIPOS.find(x => x.value === tipo);
    if (!t) return null;
    const Icon = t.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${t.cor}`}>
        <Icon size={11} /> {t.label}
      </span>
    );
  }

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-gray-400">Carregando materiais...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Materiais Didáticos' }]} />

      <div className="flex items-center gap-4 mb-8 mt-6">
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg shrink-0"><Library size={32}/></div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Materiais Didáticos</h1>
          <p className="text-slate-500 font-medium">Seus vídeos, apresentações e arquivos em um só lugar.</p>
        </div>
      </div>

      {/* BUSCA + FILTROS + BOTÃO NOVO */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input
            type="text" placeholder="Buscar por título, descrição ou tag..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-medium shadow-sm"
          />
        </div>

        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-medium shadow-sm">
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {todasTags.length > 0 && (
          <select value={filtroTag} onChange={e => setFiltroTag(e.target.value)}
            className="px-3 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm font-medium shadow-sm">
            <option value="">Todas as tags</option>
            {todasTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <button onClick={abrirNovo}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-md whitespace-nowrap">
          <Plus size={16}/> Novo Material
        </button>
      </div>

      {/* CONTADOR */}
      {(busca || filtroTipo || filtroTag) && (
        <p className="text-sm text-gray-500 font-medium mb-4">
          {materiaisFiltrados.length} material(is) encontrado(s)
          {(busca || filtroTipo || filtroTag) && (
            <button onClick={() => { setBusca(''); setFiltroTipo(''); setFiltroTag(''); }}
              className="ml-2 text-blue-600 font-bold hover:underline">limpar filtros</button>
          )}
        </p>
      )}

      {/* LISTA */}
      {materiais.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center">
          <Library size={48} className="mx-auto text-gray-200 mb-4"/>
          <p className="text-gray-500 font-bold mb-2">Nenhum material ainda</p>
          <p className="text-gray-400 text-sm mb-6">Adicione vídeos do YouTube, links de apresentações, arquivos PDF ou qualquer link útil.</p>
          <button onClick={abrirNovo} className="bg-blue-600 text-white font-black px-8 py-3 rounded-xl hover:bg-blue-700 transition-all">
            Adicionar primeiro material
          </button>
        </div>
      ) : materiaisFiltrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 font-bold">Nenhum material corresponde aos filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {materiaisFiltrados.map(m => {
            const embedUrl = m.tipo === 'video' ? getYoutubeEmbedUrl(m.url) : null;
            const isExpandido = expandido === m.id;
            const tags = (m.tags || '').split(',').map(t => t.trim()).filter(Boolean);

            return (
              <div key={m.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                {/* Cabeçalho do card */}
                <div className="p-4 flex items-start gap-4">
                  {/* Ícone do tipo */}
                  <div className={`p-2.5 rounded-xl border shrink-0 ${TIPOS.find(t => t.value === m.tipo)?.cor || 'bg-gray-50'}`}>
                    <TipoIcon tipo={m.tipo} size={20}/>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="font-black text-gray-800 leading-snug">{m.titulo}</h3>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => abrirEdicao(m)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14}/></button>
                        <button onClick={() => handleExcluir(m)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <TipoBadge tipo={m.tipo}/>
                      {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 cursor-pointer hover:bg-slate-200" onClick={() => setFiltroTag(tag)}>
                          <Tag size={9}/> {tag}
                        </span>
                      ))}
                    </div>

                    {m.descricao && <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2">{m.descricao}</p>}
                  </div>
                </div>

                {/* Ações de expansão/link */}
                <div className="px-4 pb-3 flex items-center gap-3 border-t border-gray-50 pt-3">
                  {m.tipo === 'video' && embedUrl && (
                    <button onClick={() => setExpandido(isExpandido ? null : m.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-800 transition-colors">
                      <Video size={13}/> {isExpandido ? 'Fechar vídeo' : 'Assistir aqui'}
                      <ChevronDown size={13} className={`transition-transform ${isExpandido ? 'rotate-180' : ''}`}/>
                    </button>
                  )}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                      <ExternalLink size={13}/>
                      {m.tipo === 'video' ? 'Abrir no YouTube' : m.tipo === 'arquivo' ? 'Abrir arquivo' : m.tipo === 'apresentacao' ? 'Abrir apresentação' : 'Abrir link'}
                    </a>
                  )}
                </div>

                {/* Player de vídeo expandido */}
                {isExpandido && embedUrl && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl overflow-hidden bg-black aspect-video">
                      <iframe
                        src={embedUrl}
                        title={m.titulo}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL — NOVO / EDITAR
      ═══════════════════════════════════════════ */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <h3 className="font-black text-gray-800 text-lg">{editandoId ? 'Editar Material' : 'Novo Material'}</h3>
              <button onClick={fecharModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-5">

              {/* Título */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Título *</label>
                <input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Aula sobre Atenção Primária à Saúde"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-medium text-sm"/>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.value} type="button"
                        onClick={() => setForm(p => ({ ...p, tipo: t.value, url: '' }))}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all ${form.tipo === t.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                        <Icon size={16}/> {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* URL / Upload */}
              <div>
                {form.tipo === 'arquivo' ? (
                  <>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Arquivo (PDF, PPT, DOCX)</label>
                    {form.url ? (
                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                        <FileText size={16} className="text-green-600 shrink-0"/>
                        <span className="text-sm font-bold text-green-700 flex-1 truncate">Arquivo já enviado</span>
                        <button onClick={() => setForm(p => ({ ...p, url: '' }))} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-sm font-bold text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                        <Plus size={16}/> Selecionar arquivo
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadProgress(0);
                        try {
                          const url = await handleUploadArquivo(file);
                          setForm(p => ({ ...p, url }));
                        } catch { alert('Erro ao enviar arquivo.'); }
                        finally { setUploadProgress(null); }
                      }}/>
                    {uploadProgress !== null && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress}%` }}/>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 font-medium">{uploadProgress}% enviado...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                      {form.tipo === 'video' ? 'Link do YouTube *' : form.tipo === 'apresentacao' ? 'Link da apresentação *' : 'URL *'}
                    </label>
                    <input type="url" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                      placeholder={form.tipo === 'video' ? 'https://www.youtube.com/watch?v=...' : form.tipo === 'apresentacao' ? 'https://docs.google.com/presentation/...' : 'https://...'}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-medium text-sm"/>
                  </>
                )}
              </div>

              {/* Preview YouTube */}
              {form.tipo === 'video' && getYoutubeEmbedUrl(form.url) && (
                <div className="rounded-xl overflow-hidden bg-black aspect-video">
                  <iframe src={getYoutubeEmbedUrl(form.url)} title="preview" className="w-full h-full" allowFullScreen/>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Tags (separadas por vírgula)</label>
                <input type="text" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  placeholder="Ex: hipertensão, MFC, caso clínico, medicina de família"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-medium text-sm"/>
                <p className="text-xs text-gray-400 mt-1.5">As tags permitem filtrar e encontrar os materiais rapidamente.</p>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Descrição (opcional)</label>
                <textarea rows="3" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Breve descrição do conteúdo..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-medium text-sm resize-none"/>
              </div>

            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={fecharModal} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando}
                className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {salvando ? <><RefreshCw size={16} className="animate-spin"/> Salvando...</> : <><Save size={16}/> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
