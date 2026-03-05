# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1 e Porteiro Concluídos)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. O professor gerencia seus diferentes contextos de trabalho como "Espaços de Trabalho" independentes.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis)
O sistema opera em uma hierarquia plana de 3 níveis para garantir velocidade de banco e flexibilidade:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (Ex: USP, Mais Médicos). Diferente da V1, este nível é selecionado **dentro** da plataforma após o login. O valor fica blindado no `AuthContext` e persistido no `localStorage` sob a chave `@SaaS_EscolaSelecionada`.
2. **Nível 2 (Turmas):** O agrupador principal de alunos (Ex: "Turma de Odontologia 2026"). Toda turma é obrigatoriamente vinculada a uma Instituição e a um Professor.
3. **Nível 3 (Atividades/Tarefas):** Avaliações vinculadas diretamente a uma Turma. O nome da tarefa (Ex: "Fórum 01", "Desafio Final") vira o agrupador lógico para cálculos de pendências.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave da `instituicao` para isolamento de dados. **Todas as consultas do sistema devem conter a trava:** `where('instituicao', '==', escolaSelecionada)`.

* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `dataCadastro`.
* **`turmas`**: `id`, `instituicao`, `nome`, `professorUid`, `dataCriacao`, `status` ('ativa'|'arquivada').
* **`alunos`**: `id`, `nome`, `turmaId`, `instituicao`, `dataCadastro`.
* **`atividades`**: `id`, `alunoId`, `turmaId`, `instituicao`, `nomeTarefa`, `enunciado`, `resposta`, `status` ('pendente'|'aprovado'|'devolvido'), `nota` (numérico, opcional), `feedbackSugerido`, `feedbackFinal`, `dataPostagem`, `dataAprovacao`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de seleção:
    * **Criar Novo Espaço:** Campo de texto livre (Ex: "Meu Cursinho Particular") que, ao ser enviado, define o contexto atual.
    * **Meus Espaços:** Lista dinâmica gerada a partir da coleção `turmas`, buscando todos os nomes únicos de `instituicao` vinculados ao `professorUid`.
* **Cálculo de Pendências:** Calculado em memória. O sistema varre a array de alunos da `TurmaId` ativa e cruza com as tarefas exigidas. Se a combinação `${alunoId}-${nomeTarefa}` não possuir um documento com status 'aprovado' ou 'devolvido', o aluno entra na matriz de Pendentes.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é considerada 100% original da IA.

## 7. Perfis de Acesso (RBAC SaaS)
* **Perfil Admin:** Visão global de faturamento e controle master do sistema.
* **Perfil Professor:** Visão isolada. Só enxerga alunos e atividades pertencentes à instituição selecionada no "Porteiro" e apenas turmas onde seu `uid` conste como criador.

## 8. Fluxo de Revisão (Lista de Atividades)
O ciclo de vida divide-se em 3 funis condicionais:
1. **Pendente:** `status === 'pendente'` (Aguardando primeira leitura do professor).
2. **Falta Devolver (Aprovado):** `status === 'aprovado'` (Professor já corrigiu e deu nota, mas os dados estão ocultos para o aluno).
3. **Finalizado (Devolvido):** `status === 'devolvido'` (Feedback e Nota liberados para visualização do aluno).

## 9. Módulo de Comunicação e Cobrança
Automatização de cobranças cruzando alunos ativos x atividades pendentes da Turma.
* **Redação de Mentoria e Apoio (Templates Exatos):**
  * **1. Grupo Geral da Turma:**
    * *< 0 dias (Vencido):* "Olá, pessoal! O prazo oficial da tarefa {tarefa} foi encerrado. Notei algumas pendências no sistema..."
    * *>= 20 dias (Início):* "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está liberada..."
    * *>= 8 dias (Meio):* "Olá, pessoal! Nosso lembrete de acompanhamento sobre a {tarefa}..."
    * *< 8 dias (Reta Final):* "Olá, colegas! 🚨 Passando para alertar que entramos na reta final da {tarefa}..."
  * **2. Templates Individuais:** Devem usar o primeiro nome do aluno e listar nominalmente as tarefas em atraso.

## 10. Mapa de Entregas (Proatividade Visual)
Renderiza uma tabela dinâmica onde:
* **Linhas:** Alunos da Turma.
* **Colunas:** Nomes das tarefas identificadas para aquela Turma.
* **Células:** Cruzamento exato via `${alunoId}-${nomeTarefa}`. Exibe ícone de Check Verde com a Nota ou X Vermelho.

## 11. Inauguração de Tarefas (Enunciados Base)
O professor pode cadastrar o enunciado padrão de uma tarefa em `Configuracoes.jsx`. Isso permite que o Mapa de Entregas e o Módulo de Comunicação saibam que aquela tarefa existe mesmo antes de qualquer aluno enviar a primeira resposta.

## 12. Gestão de Alunos (Impacto Sistêmico)
O cadastro de alunos exige vinculação a uma `Turma`.
* **Integridade:** Se um aluno é removido, o sistema recalcula instantaneamente o Dashboard e o Mapa de Entregas daquela Turma para evitar falsos positivos de pendências.
* **Troca de Contexto:** Ao clicar em "Trocar Espaço" no Dashboard, o sistema limpa o `@SaaS_EscolaSelecionada` e redireciona o professor de volta ao "Porteiro".
