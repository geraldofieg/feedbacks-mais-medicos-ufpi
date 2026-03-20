import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Check, Zap, ShieldCheck, BrainCircuit, 
  MessageSquare, Clock, GraduationCap, LockKeyhole
} from 'lucide-react';
import Breadcrumb from '../components/Breadcrumb';

export default function Planos() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // Identifica o plano atual para mudar os botões
  const planoAtual = userProfile?.plano || 'basico';
  const numeroWhatsApp = "5586999999999"; // Coloque o seu número de vendas aqui

  const handleUpgrade = (planoDesejado) => {
    const texto = encodeURIComponent(`Olá! Sou usuário da Plataforma do Professor e gostaria de fazer o upgrade para o ${planoDesejado}.`);
    window.open(`https://wa.me/${numeroWhatsApp}?text=${texto}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={24} />
          </button>
  
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Assinaturas</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha seu pacote</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-12">
        
        {/* TÍTULO DA PÁGINA */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Simplifique sua rotina docente.
          </h2>
          <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto">
            Escolha o plano ideal para organizar suas turmas, unificar notas e recuperar o seu tempo livre.
          </p>
        </div>

        {/* CARDS DE PREÇO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
          
          {/* PLANO BÁSICO (TIER 1) */}
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8 md:p-10 flex flex-col relative transition-all hover:shadow-lg">
            {planoAtual === 'basico' && (
              <span className="absolute -top-3 left-8 bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                Seu Plano Atual
              </span>
            )}
            
            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Plano Básico</h3>
              <p className="text-slate-500 font-medium text-sm h-10">O organizador definitivo para abandonar planilhas e o caos dos prazos.</p>
            </div>
            
            <div className="mb-8">
              <div className="flex items-end gap-1 mb-1">
                <span className="text-slate-500 font-bold">R$</span>
                <span className="text-5xl font-black text-slate-900 tracking-tighter">59</span>
                <span className="text-slate-500 font-bold mb-1">,90</span>
              </div>
              <p className="text-slate-400 text-sm font-bold">/mês no plano anual</p>
            </div>

            <button 
              disabled={planoAtual === 'basico'}
              onClick={() => handleUpgrade('Plano Básico')}
              className={`w-full py-4 rounded-2xl font-black text-sm mb-8 transition-all ${planoAtual === 'basico' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg'}`}
            >
              {planoAtual === 'basico' ? 'Ativo no momento' : 'Começar com o Básico'}
            </button>

            <div className="flex-1 space-y-4">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">O que está incluído:</p>
              
              <ul className="space-y-4 text-sm font-medium text-slate-600">
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-green-500 shrink-0" />
                  Gestão visual de tarefas e controle rigoroso de prazos.
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-green-500 shrink-0" />
                  Dashboard Kanban (Saiba quem entregou e quem está devendo).
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-green-500 shrink-0" />
                  Régua de cobrança automática via WhatsApp com 1 clique.
                </li>
                <li className="flex items-start gap-3">
                  <Check size={20} className="text-green-500 shrink-0" />
                  Estação de trabalho centralizada para digitar notas e feedbacks.
                </li>
              </ul>
            </div>
          </div>

          {/* PLANO PREMIUM (TIER 3) */}
          <div className="bg-blue-600 rounded-[32px] border border-blue-500 shadow-2xl p-8 md:p-10 flex flex-col relative transform md:-translate-y-4 transition-all hover:shadow-blue-600/30">
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-950 text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md flex items-center gap-1">
              <Zap size={14} /> Recomendado
            </span>

            {planoAtual === 'premium' && (
              <span className="absolute -top-4 right-8 bg-green-400 text-green-950 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
                Plano Ativo
              </span>
            )}
            
            <div className="mb-8">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                Plano Premium <BrainCircuit size={24} className="text-blue-200"/>
              </h3>
              <p className="text-blue-100 font-medium text-sm h-10">Automação inteligente e ultravelocidade com IA de ponta integrada.</p>
            </div>
            
            <div className="mb-8">
              <div className="flex items-end gap-1 mb-1 text-white">
                <span className="text-blue-200 font-bold">R$</span>
                <span className="text-5xl font-black tracking-tighter">89</span>
                <span className="text-blue-200 font-bold mb-1">,90</span>
              </div>
              <p className="text-blue-200 text-sm font-bold">/mês no plano anual</p>
            </div>

            <button 
              disabled={planoAtual === 'premium'}
              onClick={() => handleUpgrade('Plano Premium')}
              className={`w-full py-4 rounded-2xl font-black text-sm mb-8 transition-all shadow-xl ${planoAtual === 'premium' ? 'bg-blue-800 text-blue-300 cursor-not-allowed border border-blue-700' : 'bg-white text-blue-700 hover:bg-slate-50'}`}
            >
              {planoAtual === 'premium' ? 'Seu Plano Atual' : 'Fazer Upgrade para Premium'}
            </button>

            <div className="flex-1 space-y-4">
              <p className="text-[11px] font-black text-blue-200 uppercase tracking-widest mb-4 border-b border-blue-500 pb-2">Tudo do plano básico, MAIS:</p>
              
              <ul className="space-y-4 text-sm font-bold text-white">
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1 rounded-full shrink-0"><Check size={14} className="text-white" /></div>
                  Motor Gemini 3 Integrado: Correções geradas em segundos.
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1 rounded-full shrink-0"><Check size={14} className="text-white" /></div>
                  Treinamento de Prompt: A IA avalia exatamente com o seu estilo.
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1 rounded-full shrink-0"><Check size={14} className="text-white" /></div>
                  Botões de fluxo expresso para colar no portal oficial da instituição.
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-white/20 p-1 rounded-full shrink-0"><Check size={14} className="text-white" /></div>
                  Métricas de acurácia da Inteligência Artificial.
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* ÁREA DE CONFIANÇA / OBJEÇÕES (O PITCH DA IA) */}
        <div className="mt-20 max-w-4xl mx-auto bg-slate-900 rounded-[32px] p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-10 shadow-xl border border-slate-800">
          <div className="shrink-0 bg-indigo-500/20 p-6 rounded-full border border-indigo-500/30">
            <ShieldCheck size={56} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white mb-3">Você no Controle Absoluto. Sempre.</h3>
            <p className="text-slate-400 font-medium leading-relaxed mb-4 text-sm md:text-base">
              Acreditamos que a tecnologia existe para ser sua assistente, e não sua substituta. Nosso motor utiliza os modelos mais recentes e potentes do mercado para ler e sugerir avaliações precisas, poupando horas do seu dia.
            </p>
            <p className="text-slate-300 font-bold flex items-center gap-2 justify-center md:justify-start">
              <LockKeyhole size={18} className="text-indigo-400"/>
              A palavra final, a aprovação e a responsabilidade da nota são 100% suas.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
