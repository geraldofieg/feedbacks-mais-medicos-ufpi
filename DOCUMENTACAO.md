# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1: Estrutura Multitenant e Gestão de Fluxo Concluídas)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. O professor gerencia seus diferentes contextos de trabalho como "Instituições" independentes.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis e o "Crachá")
O sistema opera em uma hierarquia plana de 3 níveis protegida por Tenant ID:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (Ex: USP, Mais Médicos). É a "chave mestra" do sistema. Nenhuma ação de gestão é permitida sem uma instituição selecionada.
2. **Nível 2 (Turmas):** O agrupador principal de alunos. Toda turma é vinculada a um `instituicaoId` e a um Professor.
3. **Nível 3 (Tarefas/Alunos):** Itens operacionais vinculados diretamente a uma Turma.

**Regras de Acesso e Memória (UX):**
* **Seleção Automática (VIP Onboarding):** Se o professor possuir apenas UMA instituição cadastrada no banco, o sistema a seleciona automaticamente após o login, poupando o usuário da tela de escolha.
* **Persistência de Sessão (Último Uso):** O sistema salva a última instituição acessada no cache do navegador (`localStorage` sob a chave `@SaaS_EscolaSelecionada`). Se o professor fechar e reabrir o site no dia seguinte, o sistema o devolve exatamente para o ambiente em que estava trabalhando.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave `instituicaoId` para isolamento absoluto de dados. Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`instituicoes`:** `id`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `dataCadastro`.
* **`turmas`**: `id`, `instituicaoId`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`alunos`**: `id`, `nome`, `whatsapp` (opcional), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCadastro`.
* **`tarefas` (Definição):** `id`, `nomeTarefa`, `enunciado`, **`dataFim` (Firebase Timestamp com precisão de hora e minuto)**, `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCriacao`.
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
Automatização de cobranças baseada no cruzamento de alunos ativos x tarefas pendentes. O sistema lê automaticamente a `dataFim` da tarefa para definir o tom da mensagem.

### Redação de Mentoria e Apoio (Regras de Data):
* **Grupo Geral da Turma:**
    * **Vencido (< 0 dias):** "Olá, pessoal! O prazo oficial da tarefa {tarefa} foi encerrado. Notei algumas pendências no sistema..."
    * **Início (>= 20 dias):** "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está liberada. Faltam {dias} dias para o encerramento..."
    * **Meio (>= 8 dias):** "Olá, pessoal! Nosso lembrete de acompanhamento sobre a {tarefa}. Entramos na fase intermediária e faltam {dias} dias..."
    * **Reta Final (< 8 dias):** "Olá, colegas! 🚨 Passando para alertar que entramos na reta final da {tarefa}. Faltam apenas {dias} dias..."

* **Templates Individuais:** Devem usar obrigatoriamente o primeiro nome do aluno (extraído e capitalizado automaticamente) e listar nominalmente as tarefas em atraso.

### Ações de Disparo (UX):
* **Sistema Oficial:** Copia o texto para ser colado no Moodle/Canvas.
* **Zap Privado:** Abre link direto do `wa.me` utilizando o campo `whatsapp` do banco.

## 10. Mapa de Entregas e Pendências
* **Mapa:** Renderiza uma tabela dinâmica com alunos (linhas) e tarefas (colunas), exibindo Checks Verdes ou X Vermelhos. Em dispositivos móveis, utiliza rolagem horizontal com a coluna de nomes "congelada".
* **Pendências (Visão por Tarefa):** Agrupa alunos devedores sob o título de cada tarefa. 
    * Exibe selos inteligentes de prazo visual ("Vencido em..." em vermelho, "Vence em..." em azul).
    * Permite ação direta de cobrança via atalho para o módulo de comunicação, com pré-seleção automática do aluno alvo.

## 11. Inauguração de Tarefas (Enunciados Base)
O professor cadastra o título e o enunciado padrão de uma avaliação na página de `/tarefas`. Isso permite que o Mapa de Entregas saiba que aquela tarefa existe antes mesmo de qualquer aluno enviar a primeira resposta.

## 12. Gestão de Alunos (Impacto Sistêmico)
O cadastro de alunos exige vinculação a uma `Turma`.
* **Integridade:** Se um aluno é enviado para a lixeira, o sistema recalcula instantaneamente os relatórios. O aluno não pode ser excluído fisicamente para não gerar dados órfãos.

## 13. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
1. **Estado Vazio Educativo (Empty States):** Se o usuário acessar uma tela filha sem ter a entidade pai (Ex: acessar `/alunos` sem ter Turmas), o sistema bloqueia as tabelas vazias e exibe um "Call to Action" orientando a criação.
2. **Criação "Just-in-Time":** Interrupções de fluxo são proibidas. Ao cadastrar um Aluno, se a `Turma` desejada não existir, o professor pode criá-la dinamicamente por um botão `+ Nova Turma` dentro do próprio modal.
3. **Navegação Profunda e Breadcrumbs:** Telas internas usam o `<Breadcrumb />` integrado ao título (exibindo a Instituição ativa) para evitar links mortos e preservar espaço no celular.
4. **CRUD Dinâmico e Soft Delete:** A exclusão usa "Soft Delete" (`status: 'lixeira'`), ocultando o dado da tela sem deletá-lo do banco de dados.
5. **Proteção de Rota Invisível:** Ocultação de elementos que exigem contexto caso o usuário não tenha selecionado uma instituição.
6. **Memória de Navegação (Auto-Foco):** Para economizar cliques, o sistema sempre tenta pré-selecionar automaticamente a última Turma ativa ou a Tarefa mais recente nas listas suspensas (Dropdowns) das páginas de Comunicação e Gestão, evitando que o professor encontre uma tela em branco.

## 14. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Um botão "+" posicionado no canto inferior direito para acesso rápido à criação de Turmas, Tarefas e Alunos de qualquer lugar do sistema.
* **Regra de Defesa:** O botão é estritamente condicionado à regra do "Crachá" (Nível 1). Ele **não é renderizado** se o professor não tiver uma Instituição ativa selecionada.
* 
