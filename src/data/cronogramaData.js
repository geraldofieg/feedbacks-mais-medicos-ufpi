// Base de dados local com as datas extraídas dos PDFs oficiais

export const cronogramaAssincrono = [
  { id: 1, eixo: "Eixo 1 - Princípios do SUS", modulo: "Módulo 1 - Políticas públicas de saúde", inicio: "2025-09-28", fim: "2025-10-11" },
  { id: 2, eixo: "Eixo 1 - Princípios do SUS", modulo: "Módulo 2 - Atenção Primária e ESF", inicio: "2025-10-13", fim: "2025-10-26" },
  { id: 3, eixo: "Eixo 1 - Princípios do SUS", modulo: "Módulo 3 - Princípios da MFC", inicio: "2025-10-27", fim: "2025-11-09" },
  { id: 4, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 4 - Ferramentas de abordagem clínica", inicio: "2025-11-10", fim: "2025-12-07" },
  { id: 5, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 5 - Gestão da clínica", inicio: "2025-12-08", fim: "2026-01-04" },
  { id: 6, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 6 - Abordagem familiar", inicio: "2026-01-05", fim: "2026-02-01" },
  { id: 7, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 7 - Abordagem comunitária", inicio: "2026-02-02", fim: "2026-03-01" },
  { id: 8, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 8 - Saúde da criança e adolescente", inicio: "2026-03-02", fim: "2026-03-29" },
  { id: 9, eixo: "Atividade Académica", modulo: "Semana de retenção e correção", inicio: "2026-03-30", fim: "2026-04-12" },
  { id: 10, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 9 - Saúde da mulher", inicio: "2026-03-30", fim: "2026-04-26" },
  { id: 11, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 10 - Saúde do homem", inicio: "2026-04-27", fim: "2026-05-10" },
  { id: 12, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 11 - Saúde do idoso", inicio: "2026-05-11", fim: "2026-05-24" }
];

export const cronogramaSincrono = [
  { semana: 18, inicio: "2026-02-02", fim: "2026-02-08", tema1: "Atividade prática - Descobrindo quem é o meu paciente", tema2: "Reunião de equipa (Território e DSS)" },
  { semana: 19, inicio: "2026-02-09", fim: "2026-02-15", tema1: "Apresentação de consulta videogravada", tema2: "Resumo sobre informações do território" },
  { semana: 20, inicio: "2026-02-16", fim: "2026-02-22", tema1: "Atividade de retenção", tema2: "Sala de aula invertida - ASIS" },
  { semana: 21, inicio: "2026-02-23", fim: "2026-03-01", tema1: "Atividade de retenção", tema2: "Atividade de retenção" },
  { semana: 22, inicio: "2026-03-02", fim: "2026-03-08", tema1: "Devolutiva da avaliação final", tema2: "Atividade de retenção" }
];

// Função que o sistema vai usar para saber em que fase estamos
export const getStatusData = (inicio, fim) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zera a hora para comparar só o dia
  
  const dataInicio = new Date(inicio + "T00:00:00");
  const dataFim = new Date(fim + "T23:59:59");
  
  if (hoje > dataFim) return "passado";
  if (hoje < dataInicio) return "futuro";
  return "atual"; // Se não é passado nem futuro, é hoje!
};

// Função para calcular os dias restantes
export const getDiasRestantes = (fim) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataFim = new Date(fim + "T23:59:59");
  const diferencaTime = dataFim.getTime() - hoje.getTime();
  return Math.ceil(diferencaTime / (1000 * 3600 * 24));
};
