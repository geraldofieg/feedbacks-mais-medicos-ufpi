# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1: Estrutura Multitenant e Gestão de Fluxo Concluídas)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. O professor gerencia seus diferentes contextos de trabalho como "Instituições" independentes. O sistema atua não apenas como avaliador, mas como uma **Agenda Pessoal e Acadêmica** unificada.

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
* **Memória de Turma Ativa (Sincronização Global):** O sistema salva a última turma manipulada no cache (`localStorage` via chave `ultimaTurmaAtiva`). Isso impede a "amnésia de rota", garantindo que as abas de Tarefas, Cronograma e Pendências abram sempre sincronizadas na mesma turma, sem resetar para a primeira da lista.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave `instituicaoId` para isolamento absoluto de dados. Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`instituicoes`:** `id`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `dataCadastro`.
* **`turmas`**: `id`, `instituicaoId`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`alunos`**: `id`, `nome`, `whatsapp` (opcional), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCadastro`.
* **`tarefas` (Definição Dinâmica):** `id`, `nomeTarefa`, `enunciado`, **`dataFim` (Firebase Timestamp com precisão de hora e minuto)**, **`tipo` ('entrega', 'compromisso', 'lembrete')**, `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCriacao`.
* **`atividades` (Entregas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta`, `status` ('pendente'|'aprovado'|'devolvido'), `nota`, `feedbackSugerido`, `feedbackFinal`, `dataPostagem`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de criação (Empty State de Nível 1).
* **Troca de Contexto Inteligente:** O Dashboard possui um *Dropdown* (Menu Suspenso) nativo no cabeçalho. Ele permite ao professor alternar instantaneamente entre suas Instituições cadastradas ou criar uma nova, sem precisar retroceder na navegação.
* **Centro de Comando Mutante (Inversão de Hierarquia):** O layout adapta-se à maturidade do usuário:
    * Se `Turmas === 0`, o topo destaca convites de criação e oculta os atalhos.
    * Se `Turmas > 0`, os botões de criação viram atalhos discretos e o topo passa a ser dominado por "Minhas Turmas Ativas" e pelo "Radar da Semana".
* **Radar da Semana (Mini-Cronograma):** Injetado na tela inicial, exibe até 3 eventos (Entregas, Reuniões ou Lembretes) programados para os próximos 7 dias.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA.

## 7. Perfis de Acesso (RBAC SaaS)
* **Perfil Admin:** Visão global de faturamento e controle master do sistema.
* **Perfil Professor:** Visão isolada. Só enxerga dados pertencentes ao `instituicaoId` selecionado e onde seu `uid` conste como criador.

## 8. Estação de Correção Contínua (Fluxo de Revisão)
A página de correção (acessada pelo ID da Tarefa) não visualiza apenas um aluno, mas atua como uma **Estação de Trabalho** para a turma inteira:
* **Paginação Inteligente:** O sistema busca todos os alunos da turma na qual a tarefa foi lançada e cria botões de "Anterior" e "Próximo". Ao aprovar um feedback, o sistema avança automaticamente para o próximo aluno.
* **Blindagem de Datas (Anti-Crash):** Utiliza um conversor de *timestamp* universal para evitar a "tela branca" ao renderizar datas antigas ou em formatos mistos.
* O ciclo de vida divide-se em 3 funis condicionais:
    1. **Pendente:** `status === 'pendente'` (Aguardando primeira leitura do professor).
    2. **Falta Devolver (Aprovado):** `status === 'aprovado'` (Professor já corrigiu e deu nota, mas os dados estão ocultos para o aluno).
    3. **Finalizado (Devolvido):** `status === 'devolvido'` ou `postado: true` (Feedback e Nota liberados para visualização do aluno).

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
* **Pendências (Visão por Tarefa):** Agrupa alunos devedores sob o título de cada tarefa (filtrando apenas itens do tipo `entrega`). 
    * Exibe selos inteligentes de prazo visual ("Vencido em..." em vermelho, "Vence em..." em azul).
    * Permite ação direta de cobrança via atalho para o módulo de comunicação, com pré-seleção automática do aluno alvo.

## 11. Gestão de Tarefas e Agenda (Inauguração Base)
O professor cadastra itens na página de `/tarefas` com categorias distintas: `Entrega (Desafio)`, `Compromisso (Aula)` ou `Lembrete (Post-it)`. Isso permite que o Mapa de Entregas saiba que aquela tarefa existe antes mesmo de qualquer aluno enviar a primeira resposta.
* **Hierarquia Invertida:** A página foca na gestão do dia a dia. A barra de busca e os registros existentes aparecem no topo, enquanto o formulário de "Nova Tarefa" é fixado no rodapé (mobile) ou na lateral.

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
7. **Redução do Caminho do Clique (Teletransporte):** Cartões referentes a tarefas do tipo "Entrega" no Dashboard ou no Cronograma funcionam como hiperlinks mágicos. Um único clique redireciona o professor diretamente para a respectiva Estação de Correção (`/revisar/id`). Cartões de Compromisso/Lembrete são estáticos (apenas expansivos para leitura).
8. **Espião de Rotas:** O sistema rastreia o estado (`location.state`) oriundo dos cliques dos cartões para forçar componentes dropdown a atualizarem a turma instantaneamente, superando os atrasos de renderização do React.

## 14. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Um botão "+" posicionado no canto inferior direito para acesso rápido à criação de Turmas, Tarefas e Alunos de qualquer lugar do sistema.
* **Regra de Defesa:** O botão é estritamente condicionado à regra do "Crachá" (Nível 1). Ele **não é renderizado** se o professor não tiver uma Instituição ativa selecionada.

## 15. Cronograma Dinâmico
A aba "Datas" processa todas as tarefas criadas no banco em tempo real, eliminando qualquer dependência de arquivos estáticos.
* **O Radar (A Gaveta de Post-its):** Tarefas *sem* prazo definido (Lembretes soltos) são renderizadas fixas no topo da tela, servindo como uma visão contínua.
* **A Linha do Tempo:** Entregas e Compromissos *com* dataFim são ordenados verticalmente (do mais próximo ao mais distante), utilizando bolinhas e badges coloridos para indicar proximidade, mantendo o botão de "Ocultar Passados".
* 
