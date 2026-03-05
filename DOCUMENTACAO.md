# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1 Concluída)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis)
O sistema evoluiu para uma hierarquia plana de 3 níveis, abandonando o engessamento de "Módulos" (pastas) para garantir velocidade de banco:
1. **Nível 1 (Instituição/Programa):** Definido no Login (Ex: USP, Mais Médicos). Fica blindado no `AuthContext` (localStorage: `@SaaS_EscolaSelecionada`).
2. **Nível 2 (Turmas):** O agrupador principal de alunos (Ex: "Turma de Odontologia 2026").
3. **Nível 3 (Atividades/Tarefas):** Avaliações vinculadas diretamente a uma Turma. O nome da tarefa (Ex: "Fórum 01", "Desafio Final") vira o próprio agrupador lógico.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave da `instituicao` para isolamento de dados. **Todas as consultas do sistema devem conter a trava:** `where('instituicao', '==', escolaSelecionada)`.

* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `dataCadastro`.
* **`turmas`**: `id`, `instituicao`, `nome`, `professorUid`, `dataCriacao`, `status` ('ativa'|'arquivada').
* **`alunos`**: `id`, `nome`, `turmaId`, `instituicao`, `dataCadastro`.
* **`atividades`**: `id`, `alunoId`, `turmaId`, `instituicao`, `nomeTarefa`, `enunciado`, `resposta`, `status` ('pendente'|'aprovado'|'devolvido'), `nota` (numérico, opcional), `feedbackSugerido`, `feedbackFinal`, `dataPostagem`, `dataAprovacao`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard)
* **Lógica de Alvo:** O sistema baseia-se na `Turma` selecionada pelo professor para renderizar os dados. A prioridade de tela sempre foca nas tarefas ativas vinculadas àquela turma.
* **Cálculo de Pendências:** Calculado em memória. O sistema varre a array de alunos da `Turma X` e cruza com as tarefas exigidas. Cria-se um `Set` combinando `${alunoId}-${nomeTarefa}`. Se a string não existir nas entregas aprovadas, o aluno vai para a matriz de Pendentes.
* **Termômetro da IA:** Mede a eficiência do prompt. A regra se mantém: uma atividade é 100% original da IA se `feedbackFinal.trim() === feedbackSugerido.trim()`. Qualquer edição do professor diminui a taxa de aproveitamento.

## 7. Perfis de Acesso (RBAC SaaS)
* **Perfil Admin (Dono da Plataforma):** Visão global de faturamento, controle de instituições e painel master.
* **Perfil Professor (Cliente):** Visão isolada. Só enxerga alunos e atividades pertencentes à instituição logada e às turmas que ele administra.

## 8. Fluxo de Revisão (Lista de Atividades)
O ciclo de vida divide-se em 3 funis condicionais exatos nas telas de correção:
1. **Pendente:** `!dataAprovacao` OU `status === 'pendente'`
2. **Falta Devolver (Aprovado):** `dataAprovacao` E `status === 'aprovado'` (Correção feita, nota dada, mas ainda não enviada ao aluno).
3. **Finalizado (Devolvido):** `status === 'devolvido'` (Feedback e Nota liberados).

## 9. Módulo de Comunicação e Cobrança
A tela de Comunicação automatiza as cobranças cruzando alunos ativos x atividades pendentes da Turma, gerando matrizes unificadas para o WhatsApp.
* **Redação de Mentoria e Apoio (Templates Exatos):**
  * **1. Grupo Geral da Turma:**
    * *< 0 dias:* "Olá, pessoal! O prazo oficial da tarefa {tarefa} foi encerrado. Notei algumas pendências no sistema. Por favor, regularizem as entregas imediatamente para evitarmos problemas com a aprovação. Fico no aguardo."
    * *>= 20 dias:* "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está liberada. Faltam {dias} dias para o encerramento. Quem já quiser ir adiantando as atividades, desejo excelentes estudos! Qualquer coisa, podem contar comigo."
    * *>= 8 dias:* "Olá, pessoal! Nosso lembrete de acompanhamento sobre a {tarefa}. Entramos na fase intermediária e faltam {dias} dias para o encerramento. Vamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, estou à disposição."
    * *< 8 dias:* "Olá, colegas! 🚨 Passando para alertar que entramos na reta final da {tarefa}. Faltam apenas {dias} dias para o encerramento! Peço a regularização das tarefas pendentes o quanto antes para evitarmos problemas."
  * **2. Templates Individuais (WhatsApp e Plataforma):** *(Usa o Primeiro Nome)*
    * *< 0 dias:* "Olá, {Nome}! Tudo bem? O prazo oficial de {tarefa} foi encerrado. Notei no sistema que ainda consta pendência para a sua entrega. Por favor, regularize essa situação imediatamente para evitarmos problemas com a aprovação. Fico no aguardo!"
    * *>= 20 dias:* "Olá, {Nome}! Tudo bem? 🌟 Passando para avisar que a etapa de {tarefa} já está em andamento. Faltam {dias} dias para o encerramento. Recomendo adiantar a execução pra não ficar para a última hora. Qualquer coisa, pode contar comigo!"
    * *>= 8 dias:* "Olá, {Nome}! Tudo bem? Nosso lembrete de acompanhamento sobre {tarefa}. Faltam {dias} dias para o encerramento e ainda consta pendência no sistema. Vamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, pode me chamar."
    * *< 8 dias:* "Olá, {Nome}! Tudo bem? 🚨 Passando para alertar que entramos na reta final de {tarefa}. Faltam apenas {dias} dias para o encerramento! Recomendo que regularize o quanto antes para não acumular nem termos problemas com as notas. Qualquer coisa, me chame."

## 10. Mapa de Entregas (Proatividade Visual)
A tela de Mapa renderiza a tabela injetando as obrigações oficiais atreladas à Turma.
* **Cruzamento Exato:** Cria a chave de interseção baseada na string `${alunoId}-${nomeTarefa}`. A existência dessa string no banco dita se a célula renderiza o ícone Check Verde (com a Nota) ou X Vermelho (Pendente).

## 11. Inauguração de Tarefas (Enunciados Base)
O professor pode cadastrar a instrução (texto ou anexo) da tarefa na tela de Configurações antes mesmo de um aluno enviar a atividade, garantindo que o sistema saiba quais tarefas existem e podem ser cobradas.

## 12. Gestão de Alunos (Impacto Sistêmico)
O cadastro de alunos agora exige a vinculação obrigatória a uma `Turma`. 
* Se um aluno for deletado ou movido de turma, o recálculo em tempo real é acionado. Ele desaparece ou muda instantaneamente de:
  1. Painel de Pendências (Dashboard)
  2. Módulo de Comunicação (Cobranças individuais)
  3. Matriz do Mapa de Entregas.
