import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, Phone, Sparkles, Save, ShieldCheck, Mail, 
  CheckCircle2, Target, Zap, RefreshCw, AlertCircle,
  MessageSquareHeart, Stethoscope
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Configuracoes() {
  const { currentUser, userProfile, escolaSelecionada } = useAuth();
  
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [promptIA, setPromptIA] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const isPremium = userProfile?.plano === 'premium';
  const isAdmin = userProfile?.role === 'admin' || currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com';
  const mostrarIA = isPremium || isAdmin;

  const [metricasIA, setMetricasIA] = useState({ total: 0, originais: 0, percentual: 0 });
  const [loadingMetricas, setLoadingMetricas] = useState(true);

  // --- TEMPLATES DE PROMPT ---
  const templates = [
    {
      label: 'Empático',
      icon: <MessageSquareHeart size={16} />,
      texto: 'Aja como um preceptor médico acolhedor. Comece sempre validando o esforço do aluno e destacando um ponto positivo. Em seguida, aponte as melhorias técnicas de forma construtiva e encerre com uma frase motivadora para a prática clínica.'
    },
    {
      label: 'Técnico/Acadêmico',
      icon: <Stethoscope size={16} />,
      texto: 'Aja como um preceptor médico rigoroso e técnico. Foque na precisão dos protocolos da APS, terminologias corretas e evidências científicas. Avalie a resposta com base estritamente nos critérios do enunciado, sendo direto e formal.'
    },
    {
      label: 'Direto/Prático',
      icon: <Zap size={16} />,
      texto: 'Seja direto e objetivo. Use bullet points para listar o que está correto e o que precisa ser ajustado. Evite introduções longas. Foque na resolutividade do problema apresentado pelo aluno.'
    }
  ];

  // Função para aplicar template com confirmação de segurança
  const aplicarTemplate = (textoTemplate) => {
    // Se a caixa não estiver vazia e for diferente do template, pede confirmação
    if (promptIA.trim() !== "" && promptIA.trim() !== textoTemplate.trim()) {
      const confirmacao = window.confirm("Isso substituirá suas instruções atuais por este modelo. Deseja continuar?");
      if (!confirmacao) return;
    }
    setPromptIA(textoTemplate);
  };

  useEffect(() => {
    async function fetchPerfil() {
      if (!currentUser) return;
      try {
        const docRef = doc(db, 'usuarios', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNome(data.nome || '');
          setWhatsapp(data.whatsapp || '');
          setPromptIA(data.promptPersonalizado || '');
        }
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    }
    fetchPerfil();
  }, [currentUser]);

  useEffect(() => {
    async function fetchMetricasIA() {
      if (!currentUser || !escolaSelecionada?.id || !mostrarIA) {
        setLoadingMetricas(false);
        return;
      }
      try {
        const qTarefas = query(collection(db, 'tarefas'), where('instituicaoId', '==', escolaSelecionada.id), where('professorUid', '==', currentUser.uid));
        const snapTarefas = await getDocs(qTarefas);
        const tarefasIds = snapTarefas.docs.map(d => d.id);

        if (tarefasIds.length === 0) {
          setLoadingMetricas(false);
          return;
        }

        const qAtividades = query(collection(db, 'atividades'), where('instituicaoId', '==', escolaSelecionada.id));
        const snapAtividades = await getDocs(qAtividades);

        let iaTotal = 0;
        let iaOriginais = 0;

        snapAtividades.docs.forEach(doc => {
          const ativ = doc.data();
          if (tarefasIds.includes(ativ.tarefaId)) {
            const isAprovado = ativ.status === 'aprovado' || ativ.postado === true;
            const temSugestaoIA = ativ.feedbackSugerido && ativ.feedbackSugerido.trim() !== '';

            if (isAprovado && temSugestaoIA) {
              iaTotal++;
              const feedbackFinal = ativ.feedbackFinal ? ativ.feedbackFinal.trim() : '';
              const feedbackSugerido = ativ.feedbackSugerido.trim();
              if (feedbackFinal === feedbackSugerido) iaOriginais++;
            }
          }
        });

        const percentual = iaTotal > 0 ? Math.round((iaOriginais / iaTotal) * 100) : 0;
        setMetricasIA({ total: iaTotal, originais: iaOriginais, percentual });
      } catch (error) { console.error(error); } 
      finally { setLoadingMetricas(false); }
    }
    fetchMetricasIA();
  }, [currentUser, escolaSelecionada, mostrarIA]);

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setMensagem(null);
    try {
      await updateDoc(doc(db, 'usuarios', currentUser.uid), {
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        promptPersonalizado: promptIA.trim()
      });
      setMensagem({ tipo: 'sucesso', texto: 'Configurações salvas com sucesso!' });
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao conectar com o banco de dados.' });
    } finally { setSalvando(false); }
  }

  if (loading) return <div className="p-20 text-center animate-pulse font-black text-gray-400">Carregando conta...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Breadcrumb items={[{ label: 'Configurações' }]} />
      
      <div className="flex items-center gap-4 mb-10 mt-6">
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-lg shrink-0">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Minha Conta</h1>
          <p className="text-slate-500 font-medium">Gerencie seu perfil e inteligência de correção.</p>
        </div>
      </div>

      {mensagem && (
        <div className={`mb-8 p-5 rounded-3xl font-black flex items-center gap-3 animate-in fade-in slide-in-from-top-4 border-2 ${mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {mensagem.tipo === 'sucesso' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
          {mensagem.texto}
        </div>
      )}

      <form onSubmit={handleSalvar} className="space-y-8">
        
        {/* PERFIL */}
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
          <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
            <User size={24} className="text-blue-600" /> Perfil Profissional
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-3">E-mail de Acesso</label>
              <div className="flex items-center gap-3 w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-400 font-medium">
                <Mail size={20} className="shrink-0"/> {currentUser?.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-3">Nome de Exibição</label>
              <div className="relative">
                <User size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all shadow-sm"
                  placeholder="Seu nome oficial"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-3">WhatsApp</label>
              <div className="relative">
                <Phone size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all shadow-sm"
                  placeholder="Ex: 8699999999"
                />
              </div>
            </div>
          </div>
        </div>

        {/* IA */}
        {mostrarIA ? (
          <div className="bg-slate-900 p-8 rounded-[32px] shadow-2xl border border-indigo-500/20 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                  <Sparkles size={24} className="text-yellow-400" /> Cérebro da IA
                </h2>
                <div className="flex items-center gap-2 bg-indigo-500/20 px-4 py-1.5 rounded-full border border-indigo-500/30">
                  <Zap size={14} className="text-yellow-400" />
                  <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Premium Ativo</span>
                </div>
              </div>
              
              <div className="flex flex-col lg:flex-row gap-10">
                <div className="flex-1">
                  <label className="block text-sm font-black text-indigo-300 uppercase tracking-widest mb-3 ml-1">
                    Instruções de Personalidade (Prompt)
                  </label>
                  
                  {/* SEÇÃO DE TEMPLATES COM SEGURANÇA */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {templates.map((temp, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => aplicarTemplate(temp.texto)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-tighter transition-all"
                      >
                        {temp.icon} {temp.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-sm text-slate-400 mb-5 leading-relaxed font-medium">
                    Explique como a IA deve corrigir seus alunos. Ela seguirá esse estilo em todos os feedbacks automáticos.
                  </p>
                  <textarea 
                    rows="8" value={promptIA} onChange={e => setPromptIA(e.target.value)}
                    className="w-full p-6 bg-slate-950/80 border-2 border-slate-800 rounded-3xl focus:border-yellow-400 outline-none font-medium text-slate-100 placeholder-slate-700 transition-all resize-none shadow-inner leading-relaxed"
                    placeholder="Ex: Seja cordial, comece elogiando e aponte os erros técnicos com firmeza..."
                  />
                </div>

                <div className="w-full lg:w-72 bg-slate-800/40 rounded-3xl p-6 flex flex-col items-center justify-center text-center border border-slate-700/50">
                  <Target size={32} className="text-yellow-400 mb-4 opacity-50" />
                  <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-2">Acurácia do Prompt</p>
                  
                  {loadingMetricas ? (
                    <div className="h-16 flex items-center"><RefreshCw className="animate-spin text-yellow-400" size={24}/></div>
                  ) : metricasIA.total === 0 ? (
                    <p className="text-slate-500 font-bold text-sm italic leading-tight">Inicie as correções para ver os dados de assertividade</p>
                  ) : (
                    <>
                      <span className="text-6xl font-black text-white tracking-tighter mb-2">{metricasIA.percentual}%</span>
                      <p className="text-slate-400 text-xs font-bold leading-tight">
                        {metricasIA.originais} de {metricasIA.total} feedbacks<br/>usados sem qualquer edição
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-8 rounded-[32px] border-2 border-dashed border-blue-200 text-center">
            <Sparkles className="mx-auto text-blue-300 mb-4" size={48} />
            <h3 className="text-xl font-black text-blue-900 mb-2">IA de Correção Indisponível</h3>
            <p className="text-blue-700 font-medium max-w-md mx-auto mb-6">
              A Patrícia está no plano Básico. Para liberar a correção automática e o treinamento da IA, mude o plano dela no Painel Admin.
            </p>
          </div>
        )}

        {/* BOTÃO FINAL */}
        <div className="pt-6 space-y-4">
          <button 
            type="submit" disabled={salvando} 
            className={`w-full text-white font-black px-10 py-5 rounded-3xl transition-all shadow-xl flex items-center justify-center gap-3 text-xl active:scale-95 ${salvando ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {salvando ? (
              <><RefreshCw className="animate-spin" size={24}/> Gravando...</>
            ) : (
              <><Save size={24}/> Salvar Alterações Agora</>
            )}
          </button>
        </div>

      </form>
    </div>
  );
                        }
