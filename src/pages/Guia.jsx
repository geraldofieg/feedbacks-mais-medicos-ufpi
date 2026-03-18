import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, ArrowLeft, Users, CalendarDays, 
  Sparkles, LayoutDashboard, Map, MessageCircle, 
  CheckCircle2, Zap
} from 'lucide-react';

export default function Guia() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 overflow-hidden">
        
        <div className="flex items-center gap-4 mb-6 border-b border-gray-200 pb-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
              <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><BookOpen size={24} className="md:w-7 md:h-7"/></div>
              Como Funciona
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Seu manual rápido para dominar o sistema e ganhar tempo.</p>
          </div>
        </div>

        {/* HERO SECTION - O MANIFESTO */}
        <div className="bg-indigo-600 rounded-3xl p-6 md:p-10 text-white shadow-xl mb-8 md:mb-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4 leading-tight">Deixando de ser um "Digitador" para ser um Mentor de Alta Performance.</h2>
            <p className="text-indigo-100 font-medium text-sm sm:text-base md:text-lg leading-relaxed mb-6">
              A Plataforma não é um Portal do Aluno. Ela é a sua <strong>Esteira de Produção Inteligente</strong>. O objetivo é transformar o caos de planilhas e Word num fluxo fluido, onde a tecnologia organiza a papelada e a Inteligência Artificial sugere avaliações, deixando para você apenas a decisão final.
            </p>
            
            <div className="flex items-start gap-3 bg-indigo-500/50 border border-indigo-400 p-4 rounded-xl text-left w-full md:w-fit">
              <Zap size={24} className="text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-indigo-100 leading-relaxed">
                <strong className="text-white font-black uppercase tracking-wide">ROI de Horas:</strong> Reduza seu tempo de correção em até 70%.
              </p>
            </div>
          </div>
        </div>

        {/* GRID DE CARDS EXPLICATIVOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          
          {/* CARD 1: FUNDAÇÃO E SETUP */}
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-5 md:mb-6">
              <Users size={24} className="md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-3">1. Fundação (Turmas e Alunos)</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              Antes da IA trabalhar por você, configure seu ambiente sem burocracia.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Clonagem (UFPI/UFPA):</strong> Se colegas já usam o sistema, você pode "Copiar uma Turma" e herdar meses de planejamento.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Matrícula Vapt-Vupt:</strong> Cadastre um por um sem a tela recarregar.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Importador Mágico:</strong> Cole uma lista do Excel e matricule todos de uma vez.</span>
              </li>
            </ul>
          </div>

          {/* CARD 2: GÊNESE DA TAREFA */}
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-5 md:mb-6">
              <CalendarDays size={24} className="md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-3">2. A Inteligência da Tarefa</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              Nada acontece sem a Tarefa. Ela é a "mãe" da organização.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Cruzamento em Tempo Real:</strong> Defina o prazo e o sistema cruza com a data de hoje, sabendo instantaneamente quem está devendo.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Atribuição Flexível:</strong> Lance para a turma toda ou isente alunos marcando apenas grupos específicos (ótimo para reposições).</span>
              </li>
            </ul>
          </div>

          {/* CARD 3: ESTAÇÃO DE CORREÇÃO E IA */}
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow md:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-5 md:mb-6">
              <Sparkles size={24} className="md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-3">3. A Mesa de Correção (Ficha Médica)</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              O motor de inteligência onde você ganha tempo real.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Gemini Pro 3 (IA):</strong> A inteligência lê a resposta e, usando o seu "Comando (Prompt) Personalizado", sugere o feedback no seu tom de voz.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>A Palavra Final é Sua:</strong> A tecnologia sugere, mas o mentor aprova. Faça ajustes finos e valide.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Blindagem de Rascunho:</strong> Interrompeu o trabalho? Salve o rascunho sem perder nada.</span>
              </li>
            </ul>
          </div>

          {/* CARD 4: DASHBOARD KANBAN */}
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow md:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-800 text-white rounded-2xl flex items-center justify-center mb-5 md:mb-6">
              <LayoutDashboard size={24} className="md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-3">4. O Centro de Comando (Dashboard)</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              Sua central de triagem automática e Gestão à Vista.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>A Faixa Preta "Live":</strong> Mostra estritamente o que vence hoje/em breve. Nada de passado ou futuro distante.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Esteira de Produção:</strong> Mova alunos do <em>Aguardando Revisão</em> (fila de leitura) para <em>Falta Postar</em> e finalmente para o <em>Histórico Finalizado</em>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Termômetro da IA:</strong> Mede a eficácia do seu Prompt. Se estiver baixo, ajuste as regras nas Configurações.</span>
              </li>
            </ul>
          </div>

          {/* CARD 5: MAPA VS PENDÊNCIAS */}
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 md:mb-6">
              <Map size={24} className="md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-3">5. Gestão à Vista (O Raio-X)</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              Duas lentes diferentes para enxergar a sua turma:
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Mapa de Entregas:</strong> A visão panorâmica em tabela (✅ e ❌) para ver o engajamento geral da turma, ignorando quem foi isento.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Relatório de Pendências:</strong> A visão focada no débito. Exibe estritamente quem está inadimplente.</span>
              </li>
            </ul>
          </div>

          {/* CARD 6: COMUNICAÇÃO */}
          <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-5 md:mb-6">
              <MessageCircle size={24} className="md:w-7 md:h-7" />
            </div>
            <h3 className="text-lg md:text-xl font-black text-gray-800 mb-3">6. Central de Comunicação</h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed mb-4">
              Acabe com a inadimplência com disparos inteligentes.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Resumo Geral:</strong> A inteligência agrupa todas as tarefas que o aluno deve em um só recado, usando o tom de urgência da tarefa que vence primeiro.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Zap Direto:</strong> Abre o WhatsApp do aluno com o texto já digitado.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> 
                <span className="flex-1 leading-relaxed"><strong>Copiar para Site:</strong> Copie o texto formal e cole na plataforma da sua instituição.</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
