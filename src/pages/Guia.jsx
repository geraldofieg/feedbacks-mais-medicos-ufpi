import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  BookOpen, ArrowLeft, Users, CalendarDays, Sparkles, LayoutDashboard, 
  Map, MessageCircle, CheckCircle2, AlertTriangle, ArrowRight, 
  Building2, ClipboardList, Brain, Copy, Send, Zap, Info,
  FileText, ChevronDown, ChevronUp
} from 'lucide-react';

function RegraCard({ icone, titulo, children, cor = 'blue', alerta = null }) {
  const cores = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200'   },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    green:  { bg: 'bg-emerald-50',text: 'text-emerald-600',border: 'border-emerald-200'},
    pink:   { bg: 'bg-pink-50',   text: 'text-pink-600',   border: 'border-pink-200'   },
    slate:  { bg: 'bg-slate-100', text: 'text-slate-700',  border: 'border-slate-200'  },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
  };
  const c = cores[cor] || cores.blue;

  return (
    <div className={`bg-white border ${c.border} rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`w-12 h-12 ${c.bg} ${c.text} rounded-2xl flex items-center justify-center mb-4`}>
        {icone}
      </div>
      <h3 className="text-lg font-black text-gray-800 mb-3">{titulo}</h3>
      {alerta && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-700 leading-relaxed">{alerta}</p>
        </div>
      )}
      <div className="space-y-2.5 text-sm text-gray-700">
        {children}
      </div>
    </div>
  );
}

function Item({ children }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" />
      <span className="leading-relaxed flex-1">{children}</span>
    </div>
  );
}

function Aviso({ children }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
      <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-xs font-bold text-red-700 leading-relaxed">{children}</p>
    </div>
  );
}

function Dica({ children }) {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3">
      <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
      <p className="text-xs font-medium text-blue-700 leading-relaxed">{children}</p>
    </div>
  );
}

export default function Guia() {
  const navigate = useNavigate();
  const [faqAberto, setFaqAberto] = useState(null);

  const faqs = [
    {
      pergunta: 'Criei a tarefa mas ela não aparece nas Pendências nem no Mapa. Por quê?',
      resposta: 'A tarefa precisa ter Data de Início e Data de Fim preenchidas. Sem datas, o sistema não consegue calcular se está ativa ou vencida, então ela fica invisível nesses painéis. Vá em Tarefas e Cronograma, clique no lápis da tarefa e preencha as datas.'
    },
    {
      pergunta: 'Um aluno entregou mas o sistema continua mostrando ele como devedor. O que fazer?',
      resposta: 'O sistema só considera que o aluno entregou quando a resposta dele está lançada aqui na plataforma — texto colado ou PDF anexado na Estação de Correção. Vá em Tarefas → Corrigir Tarefas → selecione o aluno → cole a resposta → salve. Assim que salvar, ele sai da lista de devedores automaticamente.'
    },
    {
      pergunta: 'Gerei o feedback com a IA mas ela parece não ter lido a resposta do aluno. O que aconteceu?',
      resposta: 'Verifique o formato do arquivo anexado. PDFs e .docx (Word moderno) funcionam normalmente. Arquivos .doc e .rtf (Word antigo) não conseguem ser lidos automaticamente — o sistema avisa com um banner laranja e oferece um link para conversão. Se o aluno enviou em outro formato, cole o texto manualmente na caixa de resposta.'
    },
    {
      pergunta: 'A IA está gerando feedbacks fora do tom que eu quero. Como ajustar?',
      resposta: 'Vá em Configurações e atualize o campo "Prompt Personalizado" com instruções mais específicas sobre o tom, extensão e estrutura que você quer. Depois de salvar, o Termômetro de IA é zerado e começa a contar do zero com o novo padrão. Com o tempo, a IA vai aprender automaticamente com suas edições e melhorar por conta própria — sem você precisar ficar ajustando o prompt toda vez.'
    },
    {
      pergunta: 'Para que serve o Mapa de Entregas se já existe o Relatório de Pendências?',
      resposta: 'São dois ângulos diferentes. O Mapa mostra toda a turma em formato de tabela (quem entregou ✅, quem não entregou ❌, quem foi isento ⚪) — é a visão panorâmica do engajamento geral. O Relatório de Pendências mostra apenas os devedores reais, filtrando isentos, e conecta direto para a Central de Comunicação. Use o Mapa para entender a turma; use Pendências para agir sobre ela.'
    },
    {
      pergunta: 'O que acontece se eu aprovar o feedback sem clicar em "Marcar como Postado"?',
      resposta: 'O aluno vai para a fila "Aguardando Postar" — ele ainda não está finalizado. O ciclo completo só termina quando você copia o feedback, cola no site oficial da instituição e clica em "Marcar como Postado" aqui na plataforma. Depois disso ele vai para o Histórico Finalizado e some das filas ativas.'
    },
    {
      pergunta: 'Posso criar uma tarefa e atribuir apenas para alguns alunos, não para a turma toda?',
      resposta: 'Sim. Ao criar ou editar uma tarefa, marque a opção "Atribuição Específica" e selecione os alunos. Esses alunos verão a tarefa nas pendências; os demais ficam isentos e não aparecem como devedores. Útil para reposições ou atividades complementares.'
    },
    {
      pergunta: 'Como funciona a "Aderência ao Estilo" que aparece no painel inicial?',
      resposta: 'É um percentual que mede o quanto o texto gerado pela IA já se aproxima do que você aprovaria. Diferente do Termômetro (que só marca 100% quando você aprova sem tocar uma vírgula), a Aderência consegue mostrar a evolução gradual — por exemplo, 78% significa que a IA já acerta a maior parte do tom e da estrutura, mas você ainda ajusta alguns detalhes. Esse número tende a crescer semana a semana à medida que o sistema aprende com suas edições.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">

        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8 border-b border-gray-200 pb-6">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight flex items-center gap-3">
              <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><BookOpen size={24} /></div>
              Como Funciona
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Tudo que você precisa saber para usar o sistema sem travar.</p>
          </div>
        </div>


        {/* ═══════════════════════════════════════════════
            CAMADA 1 — A ORDEM QUE NÃO PODE SER QUEBRADA
        ═══════════════════════════════════════════════ */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">Comece aqui</span>
            <h2 className="text-xl font-black text-gray-800">A ordem que não pode ser quebrada</h2>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-6">O sistema funciona em cadeia. Cada nível depende do anterior. Pular uma etapa faz tudo parar de funcionar.</p>

          {/* CADEIA DE DEPENDÊNCIAS */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-0">

              <div className="flex flex-col items-center text-center w-full md:w-auto md:flex-1">
                <div className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-md">
                  <Building2 size={22} />
                </div>
                <p className="text-xs font-black text-gray-800 uppercase tracking-wide">1. Instituição</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[100px]">Seu espaço de trabalho (ex: UFPI)</p>
              </div>

              <ArrowRight size={18} className="text-gray-300 shrink-0 hidden md:block mx-1" />
              <div className="w-px h-4 bg-gray-200 md:hidden self-center ml-6"></div>

              <div className="flex flex-col items-center text-center w-full md:w-auto md:flex-1">
                <div className="bg-indigo-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-md">
                  <Users size={22} />
                </div>
                <p className="text-xs font-black text-gray-800 uppercase tracking-wide">2. Turma</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[100px]">Grupo de alunos dentro da instituição</p>
              </div>

              <ArrowRight size={18} className="text-gray-300 shrink-0 hidden md:block mx-1" />
              <div className="w-px h-4 bg-gray-200 md:hidden self-center ml-6"></div>

              <div className="flex flex-col items-center text-center w-full md:w-auto md:flex-1">
                <div className="bg-orange-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-md">
                  <ClipboardList size={22} />
                </div>
                <p className="text-xs font-black text-gray-800 uppercase tracking-wide">3. Alunos + Tarefas</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[110px]">Ambos vinculados à turma, com datas</p>
              </div>

              <ArrowRight size={18} className="text-gray-300 shrink-0 hidden md:block mx-1" />
              <div className="w-px h-4 bg-gray-200 md:hidden self-center ml-6"></div>

              <div className="flex flex-col items-center text-center w-full md:w-auto md:flex-1">
                <div className="bg-green-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center mb-2 shadow-md">
                  <Zap size={22} />
                </div>
                <p className="text-xs font-black text-gray-800 uppercase tracking-wide">✅ Tudo funciona</p>
                <p className="text-[11px] text-gray-500 mt-1 max-w-[110px]">Pendências, mapa, cobrança e IA ativos</p>
              </div>

            </div>

            {/* ALERTAS CRÍTICOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700 leading-relaxed">
                  <strong>Tarefa sem Data de Início e Data de Fim</strong> não aparece em Pendências, Mapa de Entregas nem na Central de Comunicação. As datas são obrigatórias para o sistema calcular quem está devendo.
                </p>
              </div>
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700 leading-relaxed">
                  <strong>Aluno sem turma</strong> não recebe cobrança e não aparece em nenhum painel. Sempre verifique se o aluno está matriculado na turma correta antes de criar as tarefas.
                </p>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                  <strong>O aluno não acessa esta plataforma.</strong> Ela é exclusiva do professor. As respostas dos alunos chegam pelo site oficial da instituição e você as cola aqui manualmente.
                </p>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                  <strong>Sem resposta colada = aluno ainda devedor.</strong> Mesmo que o aluno tenha entregado no portal oficial, ele só sai da lista de pendências quando você lança a resposta dele aqui.
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* ═══════════════════════════════════════════
            CAMADA 2 — SEU FLUXO DE TRABALHO DO DIA A DIA
        ═══════════════════════════════════════════ */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">Rotina</span>
            <h2 className="text-xl font-black text-gray-800">Seu fluxo de trabalho do dia a dia</h2>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-6">Toda vez que um aluno entrega uma atividade, você segue este caminho. Memorize ele e o sistema vai fazer sentido completo.</p>

          <div className="space-y-3">

            {/* PASSO 1 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow">1</div>
              <div>
                <p className="font-black text-gray-800">Receba a resposta do aluno no site oficial da sua instituição</p>
                <p className="text-sm text-gray-500 mt-1">O aluno entrega no portal da faculdade. Você abre, lê e pega o conteúdo — texto ou PDF.</p>
              </div>
            </div>

            {/* PASSO 2 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow">2</div>
              <div>
                <p className="font-black text-gray-800">Cole a resposta aqui → <span className="text-blue-600">Tarefas → Corrigir Tarefas → selecione o aluno</span></p>
                <p className="text-sm text-gray-500 mt-1">Cole o texto na caixa ou anexe o PDF/Word do aluno. Isso tira ele da lista de "devedores".</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-black bg-gray-100 px-2 py-0.5 rounded">PDF</span>
                  <span className="text-xs text-gray-400">e</span>
                  <span className="text-xs font-black bg-gray-100 px-2 py-0.5 rounded">.docx</span>
                  <span className="text-xs text-gray-400">são lidos automaticamente pela IA</span>
                </div>
              </div>
            </div>

            {/* PASSO 3 */}
            <div className="bg-white border border-purple-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
              <div className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow">3</div>
              <div>
                <p className="font-black text-gray-800">Clique em <span className="text-purple-600">"Gerar Feedback IA"</span></p>
                <p className="text-sm text-gray-500 mt-1">A IA lê o enunciado e a resposta do aluno e gera uma sugestão de feedback no seu estilo. Demora alguns segundos.</p>
              </div>
            </div>

            {/* PASSO 4 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
              <div className="bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow">4</div>
              <div>
                <p className="font-black text-gray-800">Leia, edite o que precisar e clique em <span className="text-amber-600">"Aprovar"</span></p>
                <p className="text-sm text-gray-500 mt-1">A palavra final é sempre sua. Se a sugestão estiver boa, aprova direto. Se precisar ajustar, edite e aprova. Cada edição ensina a IA a acertar mais na próxima vez.</p>
              </div>
            </div>

            {/* PASSO 5 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4 items-start shadow-sm">
              <div className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow">5</div>
              <div>
                <p className="font-black text-gray-800">Copie o feedback → cole no site oficial → clique em <span className="text-green-600">"Marcar como Postado"</span></p>
                <p className="text-sm text-gray-500 mt-1">Só depois de marcar como postado o aluno vai para o Histórico Finalizado e some das filas ativas. Não pule esse passo.</p>
              </div>
            </div>

            {/* RESUMO VISUAL */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-center gap-2 text-xs font-black">
              <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-lg">🟡 Aguardando Revisão</span>
              <ArrowRight size={14} className="text-slate-500" />
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-lg">🔵 Aguardando Postar</span>
              <ArrowRight size={14} className="text-slate-500" />
              <span className="bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg">✅ Histórico Finalizado</span>
            </div>

          </div>
        </div>


        {/* ═══════════════════════════════════════════
            CAMADA 3 — REGRAS E FUNCIONALIDADES
        ═══════════════════════════════════════════ */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-gray-800 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">Referência</span>
            <h2 className="text-xl font-black text-gray-800">Regras e funcionalidades</h2>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-6">Cada seção do sistema tem suas próprias regras. Leia o que for relevante para o seu momento.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <RegraCard
              icone={<Brain size={22} />}
              titulo="A IA que aprende com você"
              cor="purple"
            >
              <Item><strong>O que ela faz:</strong> A cada feedback que você edita antes de aprovar, o sistema anota o que mudou. Após 3 edições, ele atualiza automaticamente as instruções da IA para que ela acerte mais na próxima vez — sem você fazer nada.</Item>
              <Item><strong>O que isso significa na prática:</strong> No começo ela erra mais o tom. Com o tempo ela vai ficando cada vez mais parecida com o seu estilo de dar feedback.</Item>
              <Item><strong>Onde acompanhar:</strong> No painel inicial, o card verde "Aderência ao Estilo" mostra o percentual de similaridade. O card roxo "Autonomia" mostra quantas vezes ela acertou sem você precisar editar.</Item>
              <Dica>Se aprovar sem editar nada, zero tokens são consumidos. O custo de aprendizado só existe quando você edita.</Dica>
            </RegraCard>

            <RegraCard
              icone={<Sparkles size={22} />}
              titulo="Como configurar a IA do seu jeito"
              cor="indigo"
              alerta="Sem o Prompt Personalizado configurado, a IA não consegue gerar feedbacks. Configure antes de usar."
            >
              <Item>Vá em <strong>Configurações → Prompt Personalizado</strong> e escreva como você quer que a IA se comporte. Exemplo: "Seja encorajador, aponte erros de forma construtiva, use linguagem formal, máximo 3 parágrafos."</Item>
              <Item>Quanto mais específico o prompt, melhor o resultado inicial.</Item>
              <Item>Se você alterar o prompt manualmente, o Termômetro de IA é zerado e a contagem recomeça com o novo padrão.</Item>
              <Dica>Você não precisa acertar o prompt de primeira. A IA vai aprendendo com suas edições e vai ajustando as próprias instruções automaticamente com o tempo.</Dica>
            </RegraCard>

            <RegraCard
              icone={<MessageCircle size={22} />}
              titulo="Central de Comunicação"
              cor="pink"
            >
              <Item><strong>Resumo Geral:</strong> Agrupa TODAS as tarefas que o aluno deve em uma única mensagem. Usa o prazo da tarefa que vence primeiro para definir o tom de urgência.</Item>
              <Item><strong>Tarefa específica:</strong> Clique no nome de uma tarefa no topo para focar a cobrança apenas nela.</Item>
              <Item><strong>Zap Direto:</strong> Abre o WhatsApp do aluno com o texto pronto. O número vem do cadastro do aluno.</Item>
              <Item><strong>Copiar para Site:</strong> Copia o texto formal para você colar no portal oficial da instituição.</Item>
              <Aviso>Só aparecem aqui alunos com tarefas ATIVAS (com datas configuradas e dentro do período vigente). Tarefas sem data ou futuras não geram cobrança.</Aviso>
            </RegraCard>

            <RegraCard
              icone={<Map size={22} />}
              titulo="Mapa vs. Pendências — qual usar?"
              cor="green"
            >
              <Item><strong>Mapa de Entregas:</strong> Visão panorâmica da turma inteira em formato de tabela. Mostra ✅ entregou, ❌ não entregou, ⚪ isento. Bom para reuniões e relatórios.</Item>
              <Item><strong>Relatório de Pendências:</strong> Mostra apenas os devedores reais, com botão direto para cobrar pelo WhatsApp ou plataforma. Bom para agir.</Item>
              <Dica>Use o Mapa para entender a situação geral. Use Pendências quando quiser partir para a ação de cobrança.</Dica>
            </RegraCard>

            <RegraCard
              icone={<CalendarDays size={22} />}
              titulo="Tarefas e Cronograma"
              cor="orange"
              alerta="Data de Início e Data de Fim são obrigatórias. Sem elas a tarefa não aparece em nenhum painel de pendências."
            >
              <Item><strong>Tarefa do Aluno:</strong> Gera entrega, pendência e cobrança. É o tipo que você usará na maioria das vezes.</Item>
              <Item><strong>Compromisso / Lembrete:</strong> Aparece no cronograma mas não gera pendência nem cobrança. Use para marcar reuniões, datas importantes etc.</Item>
              <Item><strong>Atribuição Específica:</strong> Permite criar tarefas apenas para alguns alunos (útil para reposições). Os demais ficam automaticamente isentos.</Item>
              <Item><strong>Corrigir Antecipado:</strong> Se um aluno entregou antes do período oficial abrir, o botão aparece em cinza na tarefa futura e você já pode lançar a resposta.</Item>
            </RegraCard>

            <RegraCard
              icone={<LayoutDashboard size={22} />}
              titulo="Painel Inicial (Dashboard)"
              cor="slate"
            >
              <Item><strong>Faixa preta superior:</strong> Mostra só as tarefas que estão abertas HOJE. Clique no lápis para ir direto para a correção.</Item>
              <Item><strong>Aguardando Revisão:</strong> Respostas já coladas, mas feedback ainda não aprovado.</Item>
              <Item><strong>Aguardando Postar:</strong> Feedback aprovado, mas ainda não lançado no site oficial.</Item>
              <Item><strong>Histórico Finalizado:</strong> Ciclo completo. Tudo lançado.</Item>
              <Item><strong>Cards de devedores:</strong> Mostram por tarefa quem não entregou ainda — tanto tarefas ativas quanto as recentes encerradas.</Item>
            </RegraCard>

            <RegraCard
              icone={<Users size={22} />}
              titulo="Gestão de Alunos"
              cor="blue"
            >
              <Item><strong>Matrícula individual:</strong> Após salvar, o formulário limpa sozinho para você cadastrar o próximo sem recarregar a página.</Item>
              <Item><strong>Importação em lote:</strong> Cole uma lista de nomes copiada do Excel ou Word e o sistema matricula todos de uma vez, evitando duplicatas automaticamente.</Item>
              <Item><strong>Atribuição de tarefa:</strong> Ao criar uma tarefa para a turma toda, todos os alunos matriculados entram na lista de pendência. Se quiser excluir alguém, use a Atribuição Específica.</Item>
              <Dica>Importe os alunos ANTES de criar as tarefas. Assim eles já entram automaticamente nas pendências das tarefas ativas.</Dica>
            </RegraCard>

            <RegraCard
              icone={<FileText size={22} />}
              titulo="Arquivos na Correção"
              cor="indigo"
            >
              <Item><strong>PDF:</strong> Lido automaticamente pela IA. Basta anexar.</Item>
              <Item><strong>.docx (Word moderno):</strong> Lido automaticamente pela IA. O sistema extrai o texto por baixo dos panos antes de enviar para análise.</Item>
              <Item><strong>.doc / .rtf (Word antigo):</strong> Não conseguem ser lidos automaticamente. O sistema avisa e oferece um link para converter para PDF em um clique.</Item>
              <Item><strong>Tamanho máximo:</strong> 5MB por arquivo. Para PDFs maiores, use o link "Reduzir PDF" que aparece na tela.</Item>
              <Dica>Se o aluno mandou um arquivo que a IA não conseguiu ler, você pode colar o texto manualmente na caixa de resposta — funciona da mesma forma.</Dica>
            </RegraCard>

          </div>
        </div>


        {/* ═══════════════════════════════════
            CAMADA 4 — PERGUNTAS FREQUENTES
        ═══════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">FAQ</span>
            <h2 className="text-xl font-black text-gray-800">Perguntas frequentes</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setFaqAberto(faqAberto === idx ? null : idx)}
                  className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-gray-800 text-sm leading-relaxed">{faq.pergunta}</span>
                  {faqAberto === idx
                    ? <ChevronUp size={18} className="text-gray-400 shrink-0 mt-0.5" />
                    : <ChevronDown size={18} className="text-gray-400 shrink-0 mt-0.5" />
                  }
                </button>
                {faqAberto === idx && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <p className="text-sm text-gray-600 font-medium leading-relaxed pt-4">{faq.resposta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
