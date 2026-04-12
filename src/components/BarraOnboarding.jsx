// src/components/BarraOnboarding.jsx
// Componente compartilhado de progresso do onboarding.
// Usado no Dashboard, Turmas, Alunos e Tarefas.
//
// Props:
//   etapaAtual: número de 1 a 4 indicando qual passo está ativo agora
//
// Estados visuais:
//   ✓ Verde   — etapa concluída (< etapaAtual)
//   🔵 Azul pulsando — etapa atual (= etapaAtual)
//   ⬜ Cinza  — próximas etapas (> etapaAtual)

export default function BarraOnboarding({ etapaAtual }) {
  const etapas = [
    { num: 1, label: 'Instituição' },
    { num: 2, label: 'Turma' },
    { num: 3, label: 'Alunos' },
    { num: 4, label: 'Tarefas' },
  ];

  // Largura da linha de progresso preenchida
  const larguras = { 1: 'w-0', 2: 'w-1/3', 3: 'w-2/3', 4: 'w-full' };
  const largura = larguras[etapaAtual - 1] || 'w-0';

  return (
    <div className="flex items-center justify-between mb-8 relative">
      {/* Linha base cinza */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 -z-10 rounded-full" />
      {/* Linha de progresso azul */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded-full transition-all duration-500 ${largura}`} />

      {etapas.map(({ num, label }) => {
        const concluida = num < etapaAtual;
        const atual = num === etapaAtual;
        const pendente = num > etapaAtual;

        return (
          <div key={num} className="flex flex-col items-center gap-2 bg-white px-2">
            <div className={[
              'w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ring-4 ring-white transition-all duration-300',
              concluida ? 'bg-green-500 text-white shadow-md' : '',
              atual     ? 'bg-blue-600 text-white shadow-lg ring-blue-100 animate-pulse' : '',
              pendente  ? 'bg-gray-100 text-gray-400' : '',
            ].join(' ')}>
              {concluida ? '✓' : num}
            </div>
            <span className={[
              'text-[10px] font-black uppercase tracking-widest hidden sm:block',
              concluida ? 'text-green-600' : '',
              atual     ? 'text-blue-600'  : '',
              pendente  ? 'text-gray-400'  : '',
            ].join(' ')}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
