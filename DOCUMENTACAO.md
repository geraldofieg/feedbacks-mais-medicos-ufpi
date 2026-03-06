# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1 e Gestão de Alunos Concluídas)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. O professor gerencia seus diferentes contextos de trabalho como "Instituições" independentes.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis)
O sistema opera em uma hierarquia plana de 3 níveis para garantir velocidade de banco e flexibilidade:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (Ex: USP, Mais Médicos). Este nível é selecionado **dentro** da plataforma após o login. O valor fica blindado no `AuthContext` e persistido no `localStorage` sob a chave `@SaaS_EscolaSelecionada`.
2. **Nível 2 (Turmas):** O agrupador principal de alunos (Ex: "Turma de Odontologia 2026"). Toda turma é obrigatoriamente vinculada a uma Instituição e a um Professor.
3. **Nível 3 (Atividades/Tarefas):** Avaliações vinculadas diretamente a uma Turma. O nome da tarefa (Ex: "Fórum 01", "Desafio Final") vira o agrupador lógico para cálculos de pendências.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave da `instituicao` para isolamento de dados. **Todas as consultas do sistema devem conter a trava:** `where('instituicao', '==', escolaSelecionada)` e ignorar documentos com `status: 'lixeira'`.

* **`instituicoes`:** Garante a persistência do nível 1. `id` (formato seguro: `uid_nomeDaInstituicao`), `nome`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `dataCadastro`.
* **`turmas`**: `id`, `instituicao`, `nome`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCriacao`.
* **`alunos`**: `id`, `nome`, `turmaId`, `instituicao`, `status` ('ativa'|'lixeira'), `dataCadastro`.
* **`tarefas` (Definição):** `id`, `nomeTarefa`, `enunciado`, `turmaId`, `instituicao`, `professorUid`, `status` ('ativa'|'lixeira'), `dataCriacao`.
* **`atividades` (Entregas):** `id`, `alunoId`, `turmaId`, `instituicao`, `tarefaId`, `resposta`, `status` ('pendente'|'aprovado'|'devolvido'), `nota`, `feedbackSugerido`, `feedbackFinal`, `dataPostagem`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de seleção:
    * **Criar Instituição:** Campo de texto livre que grava na coleção `instituicoes` e define o contexto atual.
    * **Minhas Instituições:** Lista dinâmica gerada a partir das coleções `instituicoes` e `turmas`, agrupando espaços já pertencentes àquele `professorUid`.
* **Dashboard (Centro de Comando):** O painel conta os dados reais em tempo real.
    * Se `Turmas === 0`, oculta os atalhos e exibe um Call to Action gigante.
    * Se `Turmas > 0`, exibe as turmas como cartões clicáveis que redirecionam diretamente para as Tarefas daquela turma específica e botões de atalho rápido.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA.

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
  * **2. Templates Individuais:** Devem usar obrigatoriamente o primeiro nome do aluno e listar nominalmente as tarefas em atraso.

## 10. Mapa de Entregas (Proatividade Visual)
Renderiza uma tabela dinâmica onde:
* **Linhas:** Alunos da Turma.
* **Colunas:** Nomes das tarefas identificadas para aquela Turma.
* **Células:** Cruzamento exato. Exibe ícone de Check Verde com a Nota ou X Vermelho.

## 11. Inauguração de Tarefas (Enunciados Base)
O professor pode cadastrar o enunciado padrão de uma tarefa em `/tarefas`. Isso permite que o Mapa de Entregas e o Módulo de Comunicação saibam que aquela tarefa existe mesmo antes de qualquer aluno enviar a primeira resposta.

## 12. Gestão de Alunos (Impacto Sistêmico)
O cadastro de alunos exige vinculação a uma `Turma`.
* **Troca de Contexto:** Ao clicar em "Trocar Instituição" no Dashboard, o sistema limpa o `@SaaS_EscolaSelecionada` e redireciona o professor de volta ao "Porteiro".

## 13. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
Para evitar que o comportamento não-linear do usuário gere erros e frustrações, o sistema utiliza 4 camadas de defesa de usabilidade em todas as suas interfaces:
1. **Estado Vazio Educativo (Empty States):** Se o usuário acessar uma tela filha sem ter cadastrado a entidade pai, o sistema exibe um aviso amigável explicando a dependência e oferecendo um botão de atalho para a criação do item pai.
2. **Criação "Just-in-Time":** Interrupções de fluxo são proibidas. Em modais de criação, se o usuário notar que a entidade "Pai" desejada não existe, ele deve ter a opção de criá-la diretamente por um botão `+ Novo` dentro do próprio modal.
3. **Navegação Profunda (Breadcrumbs):** Telas de nível 2 e 3 devem obrigatoriamente importar o componente `<Breadcrumb />` no topo da página, sem "links mortos".
4. **CRUD Dinâmico e Lixeira Invisível (Soft Delete):** A edição de nomenclaturas (Turmas, Tarefas, Alunos) deve ser feita na própria linha/cartão (Inline Edit). A exclusão de registros usa o padrão "Soft Delete": o documento recebe `status: 'lixeira'`, desaparecendo da interface principal sem deletar fisicamente o dado do banco, evitando quebra de relações em cascata (dados órfãos).
