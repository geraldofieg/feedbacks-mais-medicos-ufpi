// Base de dados local com as datas e DADOS ADMINISTRATIVOS extraídos dos PDFs oficiais

export const cronogramaAssincrono = [
  { id: 1, eixo: "Eixo 1 - Princípios do SUS", modulo: "Módulo 1 - Políticas públicas de saúde", inicio: "2025-09-28", fim: "2025-10-11", tituloCompleto: "Políticas públicas de saúde: processo histórico e a organização do SUS", ch: 15, creditos: 1, semanas: 2, dias: 14 },
  { id: 2, eixo: "Eixo 1 - Princípios do SUS", modulo: "Módulo 2 - Atenção Primária e ESF", inicio: "2025-10-13", fim: "2025-10-26", tituloCompleto: "Atenção Primária à Saúde e Estratégia Saúde da Família: bases históricas, políticas e organizacionais", ch: 15, creditos: 1, semanas: 2, dias: 14 },
  { id: 3, eixo: "Eixo 1 - Princípios do SUS", modulo: "Módulo 3 - Princípios da MFC", inicio: "2025-10-27", fim: "2025-11-09", tituloCompleto: "Princípios da Medicina de Família e Comunidade", ch: 15, creditos: 1, semanas: 2, dias: 14 },
  { id: 4, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 4 - Ferramentas de abordagem clínica", inicio: "2025-11-10", fim: "2025-12-07", tituloCompleto: "Ferramentas de abordagem clínica", ch: 30, creditos: 2, semanas: 4, dias: 28 },
  { id: 5, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 5 - Gestão da clínica", inicio: "2025-12-08", fim: "2026-01-04", tituloCompleto: "Gestão da clínica e coordenação do cuidado", ch: 30, creditos: 2, semanas: 4, dias: 28 },
  { id: 6, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 6 - Abordagem familiar", inicio: "2026-01-05", fim: "2026-02-01", tituloCompleto: "Abordagem familiar", ch: 30, creditos: 2, semanas: 4, dias: 28 },
  { id: 7, eixo: "Eixo 2 - Ferramentas MFC", modulo: "Módulo 7 - Abordagem comunitária", inicio: "2026-02-02", fim: "2026-03-01", tituloCompleto: "Abordagem comunitária", ch: 30, creditos: 2, semanas: 4, dias: 28 },
  { id: 8, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 8 - Saúde da criança e adolescente", inicio: "2026-03-02", fim: "2026-03-29", tituloCompleto: "Saúde da criança e do adolescente", ch: 30, creditos: 2, semanas: 4, dias: 28 },
  { id: 9, eixo: "Atividade Académica", modulo: "Semana de retenção e correção", inicio: "2026-03-30", fim: "2026-04-12", tituloCompleto: "Semana de retenção para atividades pendentes e Semana de correção das atividades", ch: "-", creditos: "-", semanas: 2, dias: 14 },
  { id: 10, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 9 - Saúde da mulher", inicio: "2026-03-30", fim: "2026-04-26", tituloCompleto: "Saúde da mulher", ch: 30, creditos: 2, semanas: 4, dias: 28 },
  { id: 11, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 10 - Saúde do homem", inicio: "2026-04-27", fim: "2026-05-10", tituloCompleto: "Saúde do homem", ch: 15, creditos: 1, semanas: 2, dias: 14 },
  { id: 12, eixo: "Eixo 3 - Grupos Específicos", modulo: "Módulo 11 - Saúde do idoso", inicio: "2026-05-11", fim: "2026-05-24", tituloCompleto: "Saúde do idoso", ch: 15, creditos: 1, semanas: 2, dias: 14 }
];

export const cronogramaSincrono = [
  { 
    semana: 18, inicio: "2026-02-02", fim: "2026-02-08", 
    tema1: "Atividade prática - Descobrindo quem é o meu paciente", 
    tema2: "Reunião de equipa (Território e DSS)",
    tema1Completo: "18. Webconferência Atividade prática dramatização - Descobrindo quem é o meu paciente, o que o preocupa e o que ele espera de mim.",
    tema2Completo: "18.1. Reunião de equipe ou com qualquer membro da equipe que possa auxiliar a conhecer o território, inclusive a gerente, importante identificar as seguintes informações: Perfil da população por faixa etária e sexo. Identificar os DSS e as situações de vulnerabilidade."
  },
  { 
    semana: 19, inicio: "2026-02-09", fim: "2026-02-15", 
    tema1: "Apresentação de consulta videogravada", 
    tema2: "Resumo sobre informações do território",
    tema1Completo: "19. Webconferência Apresentação e discussão de consulta videogravada. Apresentação dois profissionais estudantes.",
    tema2Completo: "19.1. Elaborar e enviar um resumo sobre as informações sobre o território onde atua."
  },
  { 
    semana: 20, inicio: "2026-02-16", fim: "2026-02-22", 
    tema1: "Atividade de retenção", 
    tema2: "Sala de aula invertida - ASIS",
    tema1Completo: "20. Webconferência 20 - Atividade de retenção - Apresentação e discussão de consulta videogravada.",
    tema2Completo: "20. Webconferência - Sala de aula invertida - Análise de situação de saúde. Resgatar como e porque fazer uma ASIS."
  },
  { 
    semana: 21, inicio: "2026-02-23", fim: "2026-03-01", 
    tema1: "Atividade de retenção", 
    tema2: "Atividade de retenção",
    tema1Completo: "21. Webconferência 21 - Atividade de retenção - Apresentação e discussão de consulta videogravada.",
    tema2Completo: "21. Webconferência - Atividade de retenção. Apresentação e discussão de consulta videogravada."
  },
  { 
    semana: 22, inicio: "2026-03-02", fim: "2026-03-08", 
    tema1: "Devolutiva da avaliação final", 
    tema2: "Atividade de retenção",
    tema1Completo: "22. Webconferência 22 - Webconferência - Devolutiva da avaliação fechamento de semestre.",
    tema2Completo: "22. Webconferência - Atividade de retenção - Apresentação e discussão de consulta videogravada."
  }
];

export const getStatusData = (inicio, fim) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataInicio = new Date(inicio + "T00:00:00");
  const dataFim = new Date(fim + "T23:59:59");
  if (hoje > dataFim) return "passado";
  if (hoje < dataInicio) return "futuro";
  return "atual"; 
};

export const getDiasRestantes = (fim) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataFim = new Date(fim + "T23:59:59");
  const diferencaTime = dataFim.getTime() - hoje.getTime();
  return Math.ceil(diferencaTime / (1000 * 3600 * 24));
};
