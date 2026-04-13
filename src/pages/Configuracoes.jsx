import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { 
  User, Phone, Sparkles, Save, ShieldCheck, Mail, 
  CheckCircle2, Target, Zap, RefreshCw,
  Lock, ChevronRight, Brain, History, Shield, Copy,
  ThumbsUp, ThumbsDown, TrendingUp, BookOpen, AlertTriangle
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Configuracoes() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('conta');

  // Conta
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [promptIA, setPromptIA] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucessoVisual, setSucessoVisual] = useState(false);
  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });
  const [loadingMetricas, setLoadingMetricas] = useState(true);

  // Aprendizado
  const [regrasPermanentes, setRegrasPermanentes] = useState('');
  const [salvandoRegras, setSalvandoRegras] = useState(false);
  const [sucessoRegras, setSucessoRegras] = useState(false);
  const [promptAtivo, setPromptAtivo] = useState('');
  const [historicoPrompts, setHistoricoPrompts] = useState([]);
  const [totalEdicoesIncorporadas, setTotalEdicoesIncorporadas] = useState(0);
  const [analisandoConsolidado, setAnalisandoConsolidado] = useState(false);
  const [analiseConsolidada, setAnaliseConsolidada] = useState('');
  const [copiado, setCopiado] = useState('');

  const isPremium = userProfile?.plano === 'premium';
  const isTier2 = userProfile?.plano === 'intermediario';
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const mostrarIA = isPremium || isAdmin || isTier2;

  useEffect(() => {
    async function fetchPerfil() {
      if (!currentUser) return;
      try {
        const docSnap = await getDoc(doc(db, 'usuarios', currentUser.uid));
        if (docSnap.exists()) {
          const d = docSnap.data();
          setNome(d.nome || '');
          setWhatsapp(d.whatsapp || '');
          setPromptIA(d.promptPersonalizado || '');
          setRegrasPermanentes(d.regrasPermanentes || '');
          setPromptAtivo(d.promptAtivo || '');
          setHistoricoPrompts(d.historicoPrompts || []);
          setTotalEdicoesIncorporadas(d.totalEdicoesIncorporadas || 0);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    fetchPerfil();
  }, [currentUser]);

  useEffect(() => {
    async function fetchMetricas() {
      if (!currentUser || !escolaSelecionada?.id || !mostrarIA) { setLoadingMetricas(false); return; }
      try {
        const snapTarefas = await getDocs(query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid)));
        const tarefasIds = snapTarefas.docs.map(d => d.id);
        if (!tarefasIds.length) { setLoadingMetricas(false); return; }
        const snapAtiv = await getDocs(query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id)));
        const userSnap = await getDoc(doc(db, 'usuarios', currentUser.uid));
        const tsPrompt = userSnap.data()?.timestampPrompt || 0;
        let total = 0, originais = 0;
        snapAtiv.docs.forEach(d => {
          const a = d.data();
          if (!tarefasIds.includes(a.tarefaId)) return;
          const aprovado = a.status === 'aprovado' || a.postado;
          const temSugestao = a.feedbackSugerido?.trim();
          const ts = a.dataModificacao || a.dataCriacao;
          const t = ts ? (ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime()) : 0;
          if (aprovado && temSugestao && t >= tsPrompt) {
            total++;
            if ((a.feedbackFinal || '').trim() === a.feedbackSugerido.trim()) originais++;
          }
        });
        setMetricasIA({ total, originais, percentual: total > 0 ? Math.round((originais / total) * 100) : 0 });
      } catch (e) { console.error(e); } finally { setLoadingMetricas(false); }
    }
    fetchMetricas();
  }, [currentUser, escolaSelecionada, mostrarIA]);

  async function handleSalvar(e) {
    e.preventDefault(); setSalvando(true); setSucessoVisual(false);
    try {
      const prompt = promptIA.trim();
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { nome: nome.trim(), whatsapp: whatsapp.trim(), promptPersonalizado: prompt, timestampPrompt: Date.now(), promptAtivo: '' });
      localStorage.setItem('@SaaS_PromptVivo', prompt);
      setMetricasIA({ total: 0, originais: 0, percentual: 0 }); setPromptAtivo('');
      setSucessoVisual(true); setTimeout(() => setSucessoVisual(false), 3000);
    } catch { alert('Erro ao salvar.'); } finally { setSalvando(false); }
  }

  async function handleSalvarRegras() {
    setSalvandoRegras(true);
    try {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), { regrasPermanentes: regrasPermanentes.trim() });
      setSucessoRegras(true); setTimeout(() => setSucessoRegras(false), 3000);
    } catch { alert('Erro ao salvar regras.'); } finally { setSalvandoRegras(false); }
  }

  async function handleAvaliarCiclo(index, avaliacao) {
    const novo = historicoPrompts.map((h, i) => i === index ? { ...h, avaliacaoUsuario: avaliacao } : h);
    setHistoricoPrompts(novo);
    await updateDoc(doc(db, 'usuarios', currentUser.uid), { historicoPrompts: novo });
  }

  async function handleAnaliseConsolidada() {
    if (!historicoPrompts.length) return;
    setAnalisandoConsolidado(true); setAnaliseConsolidada('');
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const resumos = historicoPrompts.map((h, i) => {
        const data = new Date(h.data).toLocaleDateString('pt-BR');
        const aval = h.avaliacaoUsuario === 'aprovado' ? '👍 Aprovado pelo professor' : h.avaliacaoUsuario === 'rejeitado' ? '👎 Rejeitado pelo professor' : 'Sem avaliação';
        return `Ciclo ${historicoPrompts.length - i} (${data}): ${h.resumoCiclo} [${aval}]`;
      }).join('\n\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Você é especialista em treinamento de IA pedagógica. Analise o histórico de aprendizado e responda em 4 parágrafos:\n1. Quais padrões de estilo o professor claramente prefere?\n2. Em que direção o prompt evoluiu?\n3. Há algum ciclo que foi na direção errada?\n4. O que ainda pode melhorar?\n\nHISTÓRICO:\n${resumos}\n\nPROMPT ATIVO:\n${promptAtivo || 'Usando prompt original.'}`
      });
      setAnaliseConsolidada(response.text.trim());
    } catch (e) { setAnaliseConsolidada('Erro ao gerar análise. Tente novamente.'); }
    finally { setAnalisandoConsolidado(false); }
  }

  const copiar = (txt, chave) => { navigator.clipboard.writeText(txt); setCopiado(chave); setTimeout(() => setCopiado(''), 2000); };
  const fmtData = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '—'; } };

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-gray-400">Carregando conta...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Configurações' }]} />
      <div className="flex items-center gap-4 mb-8 mt-6">
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg shrink-0"><ShieldCheck size={32} /></div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Minha Conta</h1>
          <p className="text-slate-500 font-medium">Gerencie seu perfil e inteligência de correção.</p>
        </div>
      </div>

      {/* ABAS */}
      <div className="flex bg-gray-100 p-1 rounded-2xl mb-8 gap-1">
        <button onClick={() => setAbaAtiva('conta')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${abaAtiva === 'conta' ? 'bg-white text-slate-900 shadow-sm' : 'text-gray-500'}`}>
          <User size={16}/> Conta e Prompt
        </button>
        {mostrarIA && (
          <button onClick={() => setAbaAtiva('aprendizado')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${abaAtiva === 'aprendizado' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}>
            <Brain size={16}/> Aprendizado da IA
            {historicoPrompts.length > 0 && <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">{historicoPrompts.length}</span>}
          </button>
        )}
      </div>

      {/* ABA CONTA */}
      {abaAtiva === 'conta' && (
        <form onSubmit={handleSalvar} className="space-y-8">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
            <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3"><User size={24} className="text-blue-600"/> Perfil Profissional</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2">
                <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-3">E-mail de Acesso</label>
                <div className="flex items-center gap-3 w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-400 font-medium"><Mail size={20} className="shrink-0"/> {currentUser?.email}</div>
              </div>
              <div>
                <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-3">Nome de Exibição</label>
                <div className="relative"><User size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full pl-14 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-medium text-slate-700 transition-all shadow-sm" placeholder="Seu nome oficial"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-3">WhatsApp</label>
                <div className="relative"><Phone size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full pl-14 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none font-medium text-slate-700 transition-all shadow-sm" placeholder="Ex: 8699999999"/>
                </div>
              </div>
            </div>
          </div>

          {mostrarIA ? (
            <div className="bg-slate-900 p-8 rounded-[32px] shadow-2xl border border-indigo-500/20 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"/>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-white flex items-center gap-3"><Sparkles size={24} className="text-yellow-400"/> Cérebro da IA</h2>
                  <div className="flex items-center gap-2 bg-indigo-500/20 px-4 py-1.5 rounded-full border border-indigo-500/30"><Zap size={14} className="text-yellow-400"/><span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Premium Ativo</span></div>
                </div>
                {promptAtivo && (
                  <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
                    <Brain size={16} className="text-emerald-400 shrink-0 mt-0.5"/>
                    <div><p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-1">Instruções otimizadas ativas</p>
                    <p className="text-emerald-300/70 text-xs font-medium">A IA incorporou {totalEdicoesIncorporadas} edições. Ver detalhes na aba "Aprendizado da IA".</p></div>
                  </div>
                )}
                <div className="flex flex-col lg:flex-row gap-10">
                  <div className="flex-1">
                    <label className="block text-sm font-black text-indigo-300 uppercase tracking-widest mb-3 ml-1">Instruções Base (Prompt Original)</label>
                    <p className="text-sm text-slate-400 mb-5 leading-relaxed font-medium">Ponto de partida — a IA aprende e evolui a partir daqui. Ao salvar, o aprendizado automático recomeça do zero.</p>
                    <textarea rows="8" value={promptIA} onChange={e => setPromptIA(e.target.value)} className="w-full p-6 bg-slate-950/80 border-2 border-slate-800 rounded-3xl focus:border-yellow-400 outline-none font-medium text-slate-100 placeholder-slate-700 transition-all resize-none shadow-inner leading-relaxed" placeholder="Ex: Seja cordial, comece elogiando e aponte os erros técnicos com firmeza..."/>
                  </div>
                  <div className="w-full lg:w-72 bg-slate-800/40 rounded-3xl p-6 flex flex-col items-center justify-center text-center border border-slate-700/50">
                    <Target size={32} className="text-yellow-400 mb-4 opacity-50"/>
                    <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-2">Acurácia do Prompt Atual</p>
                    {loadingMetricas ? <RefreshCw className="animate-spin text-yellow-400 mt-4" size={24}/>
                      : metricasIA.total === 0 ? <p className="text-slate-500 font-bold text-sm italic">Zero feedbacks revisados.</p>
                      : <><span className="text-6xl font-black text-white tracking-tighter mb-2">{metricasIA.percentual}%</span><p className="text-slate-400 text-xs font-bold">{metricasIA.originais} de {metricasIA.total} sem edição</p></>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-10 rounded-[32px] border border-slate-200 text-center shadow-sm">
              <Lock className="mx-auto text-slate-300 mb-4" size={48}/>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Motor de IA Bloqueado</h3>
              <p className="text-slate-500 font-medium max-w-md mx-auto mb-8">Faça upgrade para liberar a correção com IA.</p>
              <Link to="/planos" className="inline-flex items-center gap-2 bg-indigo-600 text-white font-black px-8 py-4 rounded-2xl text-sm">Ver Planos <ChevronRight size={18}/></Link>
            </div>
          )}

          <div className="pt-6">
            <button type="submit" disabled={salvando} className={`w-full text-white font-black px-10 py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 text-xl active:scale-95 transition-all ${sucessoVisual ? 'bg-green-500' : salvando ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {salvando ? <><RefreshCw className="animate-spin" size={24}/> Gravando...</> : sucessoVisual ? <><CheckCircle2 size={24}/> Salvo!</> : <><Save size={24}/> Salvar Alterações</>}
            </button>
          </div>
        </form>
      )}

      {/* ABA APRENDIZADO */}
      {abaAtiva === 'aprendizado' && mostrarIA && (
        <div className="space-y-6">

          {/* REGRAS PERMANENTES */}
          <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-50 text-red-600 p-2 rounded-xl"><Shield size={20}/></div>
              <div>
                <h3 className="font-black text-slate-900">Regras Permanentes</h3>
                <p className="text-xs text-slate-500 font-medium">Sempre aplicadas, nunca modificadas pelo aprendizado automático.</p>
              </div>
            </div>
            <textarea rows="4" value={regrasPermanentes} onChange={e => setRegrasPermanentes(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-red-400 outline-none font-medium text-slate-700 resize-none text-sm mb-4"
              placeholder={'Ex: NUNCA use "todavia". SEMPRE termine com pergunta reflexiva. Máximo 3 parágrafos.'}/>
            <button onClick={handleSalvarRegras} disabled={salvandoRegras}
              className={`px-6 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-all ${sucessoRegras ? 'bg-green-500 text-white' : 'bg-red-600 text-white hover:bg-red-700'}`}>
              {salvandoRegras ? <><RefreshCw size={14} className="animate-spin"/> Salvando...</> : sucessoRegras ? <><CheckCircle2 size={14}/> Salvo!</> : <><Shield size={14}/> Salvar Regras</>}
            </button>
          </div>

          {/* PROMPT ATIVO */}
          <div className="bg-slate-900 border border-slate-700 rounded-[28px] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl"><Brain size={20}/></div>
                <div>
                  <h3 className="font-black text-white">Instruções Ativas Agora</h3>
                  <p className="text-xs text-slate-400 font-medium">O que a IA usa — incorpora todo o aprendizado.</p>
                </div>
              </div>
              {promptAtivo && <button onClick={() => copiar(promptAtivo, 'pa')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700"><Copy size={12}/> {copiado === 'pa' ? 'Copiado!' : 'Copiar'}</button>}
            </div>
            {promptAtivo
              ? <pre className="text-slate-300 text-xs font-mono bg-slate-950/60 p-4 rounded-xl whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{promptAtivo}</pre>
              : <p className="text-slate-500 text-sm font-medium text-center py-6">As instruções evoluídas aparecerão aqui após 3 edições aprovadas.</p>}
          </div>

          {/* HISTÓRICO */}
          <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 text-purple-600 p-2 rounded-xl"><History size={20}/></div>
                <div>
                  <h3 className="font-black text-slate-900">Histórico de Aprendizado</h3>
                  <p className="text-xs text-slate-500 font-medium">{totalEdicoesIncorporadas} edições incorporadas · {historicoPrompts.length} ciclos</p>
                </div>
              </div>
              {historicoPrompts.length > 0 && (
                <button onClick={handleAnaliseConsolidada} disabled={analisandoConsolidado}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-black text-xs hover:bg-purple-700 disabled:opacity-60">
                  {analisandoConsolidado ? <><RefreshCw size={12} className="animate-spin"/> Analisando...</> : <><TrendingUp size={12}/> Análise Consolidada</>}
                </button>
              )}
            </div>

            {analiseConsolidada && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-purple-700 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={12}/> Análise Consolidada</p>
                  <button onClick={() => copiar(analiseConsolidada, 'ac')} className="text-xs text-purple-600 font-bold flex items-center gap-1"><Copy size={10}/> {copiado === 'ac' ? 'Copiado!' : 'Copiar'}</button>
                </div>
                <p className="text-sm text-purple-800 font-medium leading-relaxed whitespace-pre-wrap">{analiseConsolidada}</p>
              </div>
            )}

            {historicoPrompts.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={40} className="mx-auto text-slate-200 mb-3"/>
                <p className="text-slate-400 font-medium text-sm">Nenhum ciclo ainda.</p>
                <p className="text-slate-300 text-xs mt-1">A IA aprende a cada 3 feedbacks editados e aprovados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historicoPrompts.map((ciclo, index) => (
                  <div key={index} className={`border rounded-2xl p-5 ${ciclo.avaliacaoUsuario === 'aprovado' ? 'border-green-200 bg-green-50' : ciclo.avaliacaoUsuario === 'rejeitado' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ciclo {historicoPrompts.length - index}</span>
                        <span className="text-[10px] text-slate-400">· {fmtData(ciclo.data)}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{ciclo.totalEdicoesNoCiclo} edições</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleAvaliarCiclo(index, ciclo.avaliacaoUsuario === 'aprovado' ? null : 'aprovado')}
                          className={`p-1.5 rounded-lg transition-all ${ciclo.avaliacaoUsuario === 'aprovado' ? 'bg-green-500 text-white' : 'bg-white text-slate-400 hover:text-green-600 border border-slate-200'}`} title="Ciclo correto">
                          <ThumbsUp size={14}/>
                        </button>
                        <button onClick={() => handleAvaliarCiclo(index, ciclo.avaliacaoUsuario === 'rejeitado' ? null : 'rejeitado')}
                          className={`p-1.5 rounded-lg transition-all ${ciclo.avaliacaoUsuario === 'rejeitado' ? 'bg-red-500 text-white' : 'bg-white text-slate-400 hover:text-red-600 border border-slate-200'}`} title="Ciclo errado">
                          <ThumbsDown size={14}/>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 font-medium leading-relaxed mb-3">{ciclo.resumoCiclo}</p>
                    {ciclo.avaliacaoUsuario === 'rejeitado' && (
                      <div className="flex items-start gap-2 bg-red-100 rounded-xl p-3 mt-2">
                        <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5"/>
                        <p className="text-xs text-red-700 font-bold">Marcado como incorreto. Na próxima destilação a IA receberá este sinal para corrigir o curso.</p>
                      </div>
                    )}
                    {ciclo.promptAtivo && (
                      <details className="mt-3">
                        <summary className="text-xs text-slate-400 font-bold cursor-pointer hover:text-slate-600">Ver instruções deste ciclo ▾</summary>
                        <div className="mt-2 relative">
                          <pre className="text-xs font-mono text-slate-600 bg-white border border-slate-200 p-3 rounded-xl whitespace-pre-wrap max-h-32 overflow-y-auto">{ciclo.promptAtivo}</pre>
                          <button onClick={() => copiar(ciclo.promptAtivo, `c${index}`)} className="absolute top-2 right-2 text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded font-bold">
                            {copiado === `c${index}` ? '✓' : 'copiar'}
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
