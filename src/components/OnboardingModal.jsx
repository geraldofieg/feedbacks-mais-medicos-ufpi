import { useState, useEffect } from 'react';
import { Sparkles, Users, CalendarDays, LayoutDashboard, MessageCircle, ChevronRight, ChevronLeft, X, Rocket } from 'lucide-react';

export default function OnboardingModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  // Trava o scroll do fundo quando o modal está aberto
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const slides = [
    {
      icone: <Rocket size={48} className="text-indigo-500" />,
      titulo: "Bem-vindo à sua nova Esteira de Produção",
      texto: "A Plataforma do Professor não é apenas um site. É um centro de inteligência criado para reduzir o seu tempo de burocracia e correção em até 70%. Vamos conhecer como a mágica acontece?",
      cor: "bg-indigo-50"
    },
    {
      icone: <Users size={48} className="text-blue-500" />,
      titulo: "1. Cadastro Sem Dor de Cabeça",
      texto: "Esqueça digitar nome por nome. Você pode copiar uma turma inteira de colegas que já usam o sistema (UFPI/UFPA) ou usar nosso 'Importador Mágico' colando uma lista direto do Excel.",
      cor: "bg-blue-50"
    },
    {
      icone: <CalendarDays size={48} className="text-orange-500" />,
      titulo: "2. A Inteligência da Tarefa",
      texto: "Tudo nasce na Tarefa. Ao definir um prazo de início e fim, o sistema cruza isso com a data atual em tempo real. Você saberá instantaneamente quem está devendo sem precisar checar planilhas.",
      cor: "bg-orange-50"
    },
    {
      icone: <Sparkles size={48} className="text-purple-500" />,
      titulo: "3. O Motor de IA (Ficha Médica)",
      texto: "Ao corrigir trabalhos, a Inteligência Artificial (Gemini Pro) lê a resposta do aluno e sugere um feedback com o SEU tom de voz. Você revisa, faz os ajustes finos e dá a palavra final.",
      cor: "bg-purple-50"
    },
    {
      icone: <LayoutDashboard size={48} className="text-slate-700" />,
      titulo: "4. Seu Centro de Comando",
      texto: "O Dashboard filtra o barulho. Ele exibe apenas o que vence hoje e organiza os alunos na 'Esteira de Produção': quem aguarda revisão, quem aguarda postar no portal oficial e quem já está finalizado.",
      cor: "bg-slate-100"
    },
    {
      icone: <MessageCircle size={48} className="text-pink-500" />,
      titulo: "5. Cobrança de Elite",
      texto: "O sistema consolida tudo o que o aluno deve num único recado de urgência. Com um clique, você dispara a cobrança direto no WhatsApp dele ou copia para o mural da instituição.",
      cor: "bg-pink-50"
    }
  ];

  const currentSlide = slides[step];

  const handleNext = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else handleClose();
  };

  const handleClose = () => {
    // Grava no navegador que o usuário já viu o tour
    localStorage.setItem('@SaaS_TourVisto', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
        
        {/* Botão Fechar / Pular */}
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10" title="Pular introdução">
          <X size={20} />
        </button>

        {/* Conteúdo do Slide */}
        <div className="p-8 md:p-10 text-center flex flex-col items-center flex-1">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-inner ${currentSlide.cor}`}>
            {currentSlide.icone}
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-4">{currentSlide.titulo}</h2>
          <p className="text-gray-500 font-medium leading-relaxed">
            {currentSlide.texto}
          </p>
        </div>

        {/* Rodapé e Controles */}
        <div className="bg-gray-50 p-6 border-t border-gray-100">
          
          {/* Bolinhas de Progresso */}
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, index) => (
              <div key={index} className={`h-2 rounded-full transition-all duration-300 ${index === step ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300'}`} />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button 
              onClick={() => setStep(Math.max(0, step - 1))} 
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1 transition-colors ${step === 0 ? 'text-transparent cursor-default' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
              disabled={step === 0}
            >
              <ChevronLeft size={18} /> Voltar
            </button>

            <button 
              onClick={handleNext} 
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
            >
              {step === slides.length - 1 ? 'Começar a usar!' : 'Próximo'} 
              {step < slides.length - 1 && <ChevronRight size={18} />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
