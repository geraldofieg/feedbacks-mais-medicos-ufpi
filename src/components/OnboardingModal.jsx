import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, X, AlertTriangle, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function OnboardingModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else handleClose();
  };

  const handleClose = () => {
    // 🔥 Marca tour como visto no Firestore — persiste em qualquer dispositivo
    if (currentUser?.uid) {
      updateDoc(doc(db, 'usuarios', currentUser.uid), { tourVisto: true })
        .catch(e => console.error('Erro ao salvar tour:', e));
    }
    onClose();
  };

  const cadeia = [
    { emoji: '🏛️', label: 'Instituição' },
    { emoji: '👥', label: 'Turma' },
    { emoji: '👤', label: 'Alunos' },
    { emoji: '📌', label: 'Tarefas' },
    { emoji: '✅', label: 'Tudo funciona' },
  ];

  const slides = [
    {
      conteudo: (
        <div className="text-center">
          <div className="text-4xl mb-4">👋</div>
          <h2 className="text-xl font-black text-gray-800 mb-2">Bem-vindo(a), Professor(a)!</h2>
          <p className="text-sm font-medium text-gray-500 mb-6">Antes de começar, isso te soa familiar?</p>
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-3.5">
              <span className="text-lg shrink-0">📋</span>
              <p className="text-sm font-medium text-gray-700">Planilha manual pra controlar quem entregou e quem não entregou</p>
            </div>
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-3.5">
              <span className="text-lg shrink-0">⌨️</span>
              <p className="text-sm font-medium text-gray-700">Feedbacks escritos do zero, um por um, pra cada aluno</p>
            </div>
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-3.5">
              <span className="text-lg shrink-0">📱</span>
              <p className="text-sm font-medium text-gray-700">Cobranças pelo WhatsApp digitadas na mão, lembrando de cabeça quem deve o quê</p>
            </div>
          </div>
          <p className="text-sm font-black text-blue-600 mt-5">Essa plataforma foi feita pra acabar com isso. ↓</p>
        </div>
      )
    },
    {
      conteudo: (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-xs font-black px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">
            <AlertTriangle size={13} /> Regra de ouro — leia com atenção
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-2">O sistema funciona em cadeia</h2>
          <p className="text-sm text-gray-500 mb-5">Cada nível depende do anterior. Pular uma etapa faz tudo parar.</p>
          <div className="flex items-center justify-center gap-1 mb-5 flex-wrap">
            {cadeia.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`flex flex-col items-center border rounded-xl px-2 py-1.5 ${i === cadeia.length - 1 ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-[9px] font-black text-gray-600 mt-0.5 whitespace-nowrap">{item.label}</span>
                </div>
                {i < cadeia.length - 1 && <ArrowRight size={11} className="text-gray-300 shrink-0" />}
              </div>
            ))}
          </div>
          <div className="space-y-2 text-left">
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700">Tarefa sem Data de Início e Data de Fim não aparece em Pendências nem nas cobranças.</p>
            </div>
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-amber-700">O aluno não acessa esta plataforma. Você recebe a resposta dele no portal oficial e traz pra cá.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      conteudo: (
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles size={32} className="text-purple-500" />
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-2">A IA trabalha pra você</h2>
          <p className="text-sm text-gray-500 mb-6">Sem você precisar aprender nada técnico.</p>
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">Gera o feedback em segundos</p>
                <p className="text-xs text-gray-500">Lê a resposta do aluno e sugere o texto completo no seu tom.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">Aprende com você ao longo do tempo</p>
                <p className="text-xs text-gray-500">Cada edição que você faz ensina a IA a acertar mais — automaticamente.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">A palavra final é sempre sua</p>
                <p className="text-xs text-gray-500">Revise, edite ou aprove direto. Nada é enviado sem a sua aprovação.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">Gera mensagens de cobrança prontas</p>
                <p className="text-xs text-gray-500">Um clique abre o WhatsApp do aluno com o texto já digitado.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      conteudo: (
        <div className="text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-black text-gray-800 mb-2">Pronto! Um passo de cada vez.</h2>
          <p className="text-sm text-gray-500 mb-6">Comece pelo primeiro nível da cadeia. Vai levar menos de 2 minutos.</p>
          <div className="space-y-3 mb-5">
            <Link
              to="/"
              onClick={handleClose}
              className="flex items-center justify-between w-full bg-blue-600 text-white px-5 py-4 rounded-2xl hover:bg-blue-700 transition-colors group"
            >
              <div className="text-left">
                <p className="font-black text-sm">Ir para o painel e começar a configurar</p>
                <p className="text-blue-200 text-xs mt-0.5">O sistema vai guiar você passo a passo</p>
              </div>
              <ChevronRight size={20} className="shrink-0 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={handleClose}
              className="flex items-center justify-between w-full bg-gray-50 border border-gray-200 text-gray-600 px-5 py-3.5 rounded-2xl hover:bg-gray-100 transition-colors"
            >
              <p className="font-bold text-sm">Já sei o que fazer — ir para o painel</p>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-400">
            💡 Se travar em algum momento, acesse <strong className="text-gray-600">Como Funciona</strong> no menu — tem um guia completo com as regras.
          </p>
        </div>
      )
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          title="Pular introdução"
        >
          <X size={18} />
        </button>

        <div className="p-6 md:p-8 flex flex-col flex-1 overflow-y-auto max-h-[72vh]">
          {slides[step].conteudo}
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
          <div className="flex justify-center gap-2 mb-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setStep(index)}
                className={`h-2 rounded-full transition-all duration-300 ${index === step ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1 transition-colors ${step === 0 ? 'text-transparent cursor-default pointer-events-none' : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'}`}
            >
              <ChevronLeft size={16} /> Voltar
            </button>

            {step < slides.length - 1 ? (
              <button
                onClick={handleNext}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-md hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
              >
                Próximo <ChevronRight size={16} />
              </button>
            ) : (
              <span className="text-xs text-gray-400 font-medium">Escolha uma opção acima ↑</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
