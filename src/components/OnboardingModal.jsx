import { useState, useEffect } from 'react';
import { Sparkles, Users, LayoutDashboard, ChevronRight, ChevronLeft, X, Rocket, GitMerge, MessageCircle } from 'lucide-react';

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
      texto: "A Plataforma do Professor é um assistente inteligente criado para organizar seu fluxo acadêmico e reduzir o trabalho braçal. Se você é novo por aqui, vamos entender a lógica de como operar o sistema passo a passo para você não se sentir perdido.",
      cor: "bg-indigo-50"
    },
    {
      icone: <Users size={48} className="text-blue-500" />,
      titulo: "1. A Lógica de Organização",
      texto: "O fluxo do sistema é simples e hierárquico. Primeiro, você seleciona a sua Instituição e cadastra suas Turmas. Com as turmas prontas, você lança as Tarefas (definindo o que e quando entregar) e, por fim, insere os Alunos que farão parte delas.",
      cor: "bg-blue-50"
    },
    {
      icone: <Sparkles size={48} className="text-purple-500" />,
      titulo: "2. Correção e Inteligência",
      texto: "Lembre-se: o aluno não acessa esta plataforma. Ao receber o trabalho no sistema oficial, você copia o texto ou faz upload do PDF da resposta do aluno aqui. Na hora de lançar a nota e o feedback, você pode fazer manualmente ou usar nossa Inteligência Artificial, customizando o seu comando (prompt) para garantir o seu tom pessoal. Mas a regra é clara: a IA é apenas uma opção assistente. A revisão e a palavra final são sempre suas!",
      cor: "bg-purple-50"
    },
    {
      icone: <GitMerge size={48} className="text-orange-500" />,
      titulo: "3. O Cruzamento Automático",
      texto: "Aqui está o grande segredo: o sistema cruza as suas tarefas e prazos com os alunos matriculados automaticamente. Sem você fazer nada, ele gera o Mapa de Entregas (uma visão geral rápida de quem já entregou e quem falta) e a lista de Pendências (que mostra estritamente apenas os devedores das tarefas atuais e passadas).",
      cor: "bg-orange-50"
    },
    {
      icone: <LayoutDashboard size={48} className="text-emerald-500" />,
      titulo: "4. Seu Centro de Comando",
      texto: "Agora tudo faz sentido no seu Dashboard! Ele resume a operação: avisa o que vence hoje e organiza seu fluxo num modelo Kanban. Veja quem está 'Aguardando Revisão', quais feedbacks prontos estão 'Aguardando Postar' na faculdade, e seu 'Histórico' de concluídos.",
      cor: "bg-emerald-50"
    },
    {
      icone: <MessageCircle size={48} className="text-pink-500" />,
      titulo: "5. Cobrança de Elite",
      texto: "O sistema consolida tudo o que o aluno deve num único recado de urgência. Na Central de Comunicação, com apenas um clique, você manda uma mensagem direto no WhatsApp do aluno cobrando a pendência, ou simplesmente copia o texto pronto para colar no site oficial da instituição de ensino.",
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
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-1 transition-colors ${step === 0 ? 'text-transparent cursor-default pointer-events-none' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
              disabled={step === 0}
            >
              <ChevronLeft size={18} /> Voltar
            </button>

            <button 
              onClick={handleNext} 
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
            >
              {step === slides.length - 1 ? 'Começar a operar' : 'Próximo'} 
              {step < slides.length - 1 && <ChevronRight size={18} />}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
