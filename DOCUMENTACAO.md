# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1, Gestão de Alunos e Tarefas Concluídas)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. O professor gerencia seus diferentes contextos de trabalho como "Instituições" independentes.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis e o Tenant ID)
O sistema opera em uma hierarquia plana de 3 níveis para garantir velocidade de banco e flexibilidade:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (Ex: USP, Mais Médicos). Para evitar "efeito cascata" no banco de dados caso o usuário mude o nome da instituição, o sistema utiliza o padrão **Tenant ID**. O valor fica blindado no `AuthContext` e persistido no `localStorage` sob a chave `@SaaS_EscolaSelecionada` na forma de um objeto inteligente: `{ id: 'codigo_secreto', nome: 'UFPI' }`.
2. **Nível 2 (Turmas):** O agrupador principal de alunos (Ex: "Turma de Odontologia 2026"). Toda turma é obrigatoriamente vinculada a um `instituicaoId` e a um Professor.
3. **Nível 3 (Tarefas):** Avaliações vinculadas diretamente a uma Turma. O nome da tarefa vira o agrupador lógico para cálculos de pendências.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave `instituicaoId` para isolamento absoluto de dados. **Todas as consultas do sistema devem conter a trava estrutural:** `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.

* **`instituicoes`:** Garante a persistência do nível 1. `id`, `nome`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `dataCadastro`.
* **`turmas`**: `id`, `instituicaoId`, `nome`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCriacao`.
* **`alunos`**: `id`, `nome`, `turmaId`, `instituicaoId`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCadastro`.
* **`tarefas` (Definição):** `id`, `nomeTarefa`, `enunciado`, `turmaId`, `instituicaoId`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCriacao`.
* **`atividades` (Entregas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta`, `status` ('pendente'|'aprovado'|'devolvido'), `nota`, `feedbackSugerido`, `feedbackFinal`, `dataPostagem`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de criação (Empty State de Nível 1).
* **Troca de Contexto Inteligente:** O Dashboard possui um *Dropdown* (Menu Suspenso) nativo no cabeçalho. Ele permite ao professor alternar instantaneamente entre suas Instituições cadastradas ou criar uma nova, sem precisar retroceder na navegação.
* **Centro de Comando:** O painel conta os dados em tempo real.
    * Se `Turmas === 0`, oculta os atalhos de alunos/tarefas e foca na criação da primeira turma.
    * Se `Turmas > 0`, exibe atalhos rápidos e lista as turmas como cartões que redirecionam dinamicamente para as Tarefas daquela turma.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA.

## 7. Perfis de Acesso (RBAC SaaS)
* **Perfil Admin:** Visão global de faturamento e controle master do sistema.
* **Perfil Professor:** Visão isolada. Só enxerga dados pertencentes ao `instituicaoId` selecionado e onde seu `uid` conste como criador.

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
  * **2. Templates Individuais:** Devem usar obrigatoriamente o primeiro nome do aluno e listar nominalmente as tarefas em atraso.

## 10. Mapa de Entregas (Proatividade Visual)
Renderiza uma tabela dinâmica onde:
* **Linhas:** Alunos da Turma.
* **Colunas:** Nomes das tarefas identificadas para aquela Turma.
* **Células:** Cruzamento exato. Exibe ícone de Check Verde com a Nota ou X Vermelho.

## 11. Inauguração de Tarefas (Enunciados Base)
O professor cadastra o título e o enunciado padrão de uma avaliação na página de `/tarefas`. Isso permite que o Mapa de Entregas saiba que aquela tarefa existe antes mesmo de qualquer aluno enviar a primeira resposta.

## 12. Gestão de Alunos (Impacto Sistêmico)
O cadastro de alunos exige vinculação a uma `Turma`.
* **Integridade:** Se um aluno é enviado para a lixeira, o sistema recalcula instantaneamente os relatórios. O aluno não pode ser excluído fisicamente para não gerar dados órfãos.

## 13. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
Para evitar erros do usuário e desperdício de espaço no celular, o sistema utiliza 5 camadas de usabilidade:
1. **Estado Vazio Educativo (Empty States):** Se o usuário acessar uma tela filha sem ter a entidade pai (Ex: acessar `/alunos` sem ter Turmas), o sistema bloqueia as tabelas vazias e exibe um "Call to Action" orientando a criação da dependência.
2. **Criação "Just-in-Time":** Interrupções de fluxo são proibidas. Ao cadastrar um Aluno, se a `Turma` desejada não existir, o professor pode criá-la dinamicamente por um botão `+ Nova Turma` dentro do próprio modal.
3. **Navegação Profunda e Cabeçalhos Compactos:** Telas internas usam o componente `<Breadcrumb />` integrado ao título da página para evitar links mortos, redundância textual e preservar o "espaço nobre" da tela no celular.
4. **CRUD Dinâmico e Lixeira Invisível (Soft Delete):** A edição de nomenclaturas deve ser feita diretamente no cartão/linha (Inline Edit). A exclusão usa "Soft Delete" (`status: 'lixeira'`), ocultando o dado da tela sem deletá-lo do banco de dados, protegendo a arquitetura contra quebras.
5. **Controles de Contexto e Busca Local:** Telas como a de Tarefas possuem um "Controle Remoto" (Seletor de Turma) no topo que filtra a listagem principal em tempo real, respeitando a hierarquia restrita. Barras de busca locais são obrigatórias para lidar com grandes volumes de registros.
