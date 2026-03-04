# Documentação de Arquitetura - Feedback Mais Médicos
**Status:** Em Produção

1. Visão Geral
Sistema de dashboard para preceptores avaliarem e gerenciarem o feedback de alunos (focado no fluxo da UFPI/Mais Médicos).

2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via onSnapshot), o sistema possui um Kill Switch ativo no App.jsx.

A cada 10 minutos, o frontend faz um getDoc no caminho /sistema/config.

Se o valor de versaoAtiva no banco for maior que a VERSAO_LOCAL_APP, o sistema dispara um window.location.reload(true).

É estritamente proibido adicionar novos onSnapshot no código sem aprovação explícita da arquitetura.

3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

4. Regras de Negócio e Funcionalidades

### 4.1. Módulo Atual e Anterior (Dashboard)
A definição de qual é o módulo 'Atual' e o 'Anterior' baseia-se em uma lógica cruzada:
* **Cronograma Local:** O sistema verifica primeiramente o arquivo local de cronograma (`src/data/cronogramaData.js`) em relação à data de hoje. Se houver um módulo vigente, o número desse módulo é definido como o alvo principal.
* **Fallback (Banco de Dados):** Se não houver nenhum módulo ativo no cronograma (período de "buraco" entre módulos), o sistema busca o maior número de módulo válido já cadastrado no banco de dados (nas coleções de `atividades` e `enunciados`).
* Com esse "número de referência", o sistema determina os módulos alvo (Atual e Imediatamente Anterior), garantindo que apenas módulos a partir do número 7 sejam considerados nessa contagem.

### 4.2. Cálculo de Pendências (Gestão à Vista)
O sistema calcula quem está devendo tarefas através da seguinte lógica de subtração:
* Busca a lista total de **alunos ativos** na coleção `alunos`.
* Busca as atividades entregues (historicamente limitadas a períodos recentes, ex: últimos 90 dias) na coleção `atividades`.
* Cruza esses dados gerando uma "lista de presença" (combinando `aluno`, `modulo` e `tarefa`).
* Para as tarefas dos módulos mapeados (sejam os módulos alvo do Dashboard ou os módulos ativos na tela de Pendências), o sistema subtrai da lista de alunos totais aqueles que já possuem registro na lista de presença. Os restantes são considerados alunos com pendência.

### 4.3. Termômetro da IA
Mede a eficiência e a aceitação das sugestões de feedback geradas pela Inteligência Artificial.
* O sistema avalia as atividades processadas (já aprovadas ou finalizadas).
* Uma atividade é contabilizada como "original" se o texto do campo `feedbackFinal` for exatamente igual ao `feedbackSugerido` pela IA (desconsiderando espaços nas extremidades usando `.trim()`).
* O termômetro exibe a porcentagem resultante dessa relação: `(originais / total_de_atividades_processadas) * 100`.

5. Estrutura do Banco de Dados (Firebase Firestore)
O sistema consome e manipula as seguintes coleções principais no Firestore:
* **`alunos`**: Contém a lista de estudantes sob supervisão.
  * *Campo principal:* `nome` (usado como referência primária).
* **`modulos`**: Configurações das unidades de ensino e prazos gerenciados via tela de Configurações.
  * *Campos principais:* `nome`, `tarefas` (array com os nomes das tarefas do módulo), `status` (ex: 'ativo' ou 'arquivado'), `dataInicio`, `dataFim`, `dataCriacao`.
* **`atividades`**: Registros contendo os feedbacks avaliados e os dados das entregas.
  * *Campos principais:* `aluno`, `modulo`, `tarefa`, `status`, `dataCriacao`, `dataAprovacao`, `dataPostagem`, `feedbackSugerido`, `feedbackFinal`, `postado` (campo legado).
* **`enunciados`**: Armazena os textos base/descrições das tarefas solicitadas para cada módulo.
  * *Campo principal:* `modulo`.

6. Regras de Validação e Limpeza de Dados

### 6.1. Função isModuloValido
O sistema utiliza a função `isModuloValido` para desconsiderar registros antigos ou especiais nas estatísticas do painel:
* **Limitação Numérica:** A função extrai o número contido no nome do módulo. Se for um módulo anterior ao número 7, o registro é ignorado para as métricas do Dashboard.
* **Módulos de Recuperação:** Se a nomenclatura do módulo contiver a palavra "recupera" (case-insensitive), o sistema também ignora esses dados, mantendo o foco do painel apenas no fluxo regular vigente.

7. Perfis de Acesso (Login e Permissões)
O sistema implementa Role-Based Access Control (RBAC) com dois níveis principais, definidos de forma estática no frontend para simplificação:
* **Perfil Gestor (Admin):** Identificado através de uma verificação hardcoded do e-mail do usuário autenticado no Firebase (`currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'`). Este perfil tem acesso total à interface, incluindo botões para cadastrar novas atividades (`NovaAtividade.jsx`), gerenciar alunos (`Alunos.jsx`), acessar configurações do sistema (`Configuracoes.jsx`), visualizar a lista "Aguardando Postar" e, na tela de revisão, ações administrativas como "Marcar como Postado", "Desfazer Postagem", "Devolver p/ Revisão" e "Excluir Atividade".
* **Perfil Professora:** Qualquer usuário autenticado cujo e-mail não seja o do Gestor. Este perfil possui uma interface simplificada e focada na operação de revisão. As rotas administrativas e ações destrutivas (como exclusão de alunos ou atividades, e edição de módulos) são ocultadas da interface.

8. Fluxo de Revisão e Status (Lista e Revisão)
O ciclo de vida de uma atividade passa por três status principais em um funil lógico na tela `ListaAtividades.jsx`:
* **Pendente (Aguardando Revisão):** Atividades que não possuem `dataAprovacao` (ou cujo `status` seja `'pendente'`).
* **Falta Postar (Aguardando Postar):** Atividades que já foram aprovadas pela professora (possuem `dataAprovacao` ou `status === 'aprovado'`), mas ainda não foram postadas no portal oficial do programa (não possuem `dataPostagem` e `status !== 'postado'`).
* **Finalizado (Histórico Finalizado):** Atividades que já foram exportadas para o site (possuem `dataPostagem` ou `status === 'postado'` ou `postado === true`). A verificação utiliza retrocompatibilidade com o campo `postado` booleano legado.

Na tela `RevisarAtividade.jsx`, a professora avalia o feedback gerado pela IA (`feedbackSugerido`). Ao clicar em "Aprovar e Salvar", o sistema grava o texto possivelmente modificado no campo `feedbackFinal`, atualiza o `status` para `'aprovado'`, e registra a `dataAprovacao`. A diferença entre `feedbackSugerido` e `feedbackFinal` é utilizada posteriormente no Dashboard para o Termômetro da IA: se `feedbackFinal.trim() !== feedbackSugerido.trim()`, a atividade conta como alterada humanamente.

9. Módulo de Comunicação
A tela `Comunicacao.jsx` automatiza a cobrança de alunos inadimplentes, cruzando dados da lista ativa com o histórico de atividades (últimos 90 dias) e gerando textos totalmente personalizados.
* **Smart Tabs (UX de Seleção):** Para resolver problemas de "cegueira de interface" (onde módulos ativos ficavam ocultos em dropdowns), o sistema identifica proativamente quais módulos estão ativos na data de hoje e os exibe como botões de acesso rápido (Tabs) no topo da tela. Um menu dropdown secundário (select) é mantido apenas para explorar o histórico ou módulos futuros. O sistema usa a nomenclatura "Tarefa em Foco" orientando o preceptor de forma direta.
* **Matriz de Pendências Unificada:** O sistema varre as atividades entregues e gera um `Set` (`aluno-modulo-tarefa`). Em seguida, filtra quem da lista oficial não consta nesse `Set`. A interface atual consolida tudo em uma única lista plana e alfabética (`listaIndividualZap`) para facilitar o fluxo de trabalho "um-para-um" do preceptor.
* **Redação de Mentoria e Apoio (Os Templates Exatos):** O sistema abandona o tom punitivo e adota uma postura de "apoio pedagógico". Para evitar desvios no código futuro, a matriz exata de mensagens geradas pela aplicação (variando conforme os dias restantes até a `dataFim`) é a seguinte:

  **1. Templates para o Grupo Geral da Turma:**
  * **Vencido (< 0 dias):** "Olá, pessoal! O prazo oficial de {modulo} foi encerrado. Notei algumas pendências no sistema. Por favor, regularizem as entregas imediatamente para evitarmos problemas com a aprovação. Fico no aguardo."
  * **Início (>= 20 dias):** "Olá, pessoal! 🌟 Passando para avisar que a etapa de {modulo} já está em andamento. Faltam {dias} dias para o encerramento. Quem já quiser ir adiantando as atividades, desejo excelentes estudos! Qualquer coisa, podem contar comigo."
  * **Meio (>= 8 dias):** "Olá, pessoal! Nosso lembrete de acompanhamento sobre {modulo}. Entramos na fase intermediária e faltam {dias} dias para o encerramento. Vamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, estou à disposição."
  * **Reta Final (< 8 dias):** "Olá, colegas! 🚨 Passando para alertar que entramos na reta final de {modulo}. Faltam apenas {dias} dias para o encerramento! Peço a regularização das tarefas pendentes o quanto antes para evitarmos problemas."
  * **Sem Prazo (null):** "Olá, pessoal! Passando para lembrar do nosso acompanhamento sobre {modulo}. Peço a regularização das tarefas pendentes o quanto antes para não acumular. Qualquer dúvida, estou por aqui!"

  **2. Templates Individuais (WhatsApp e Plataforma):**
  *(Utiliza a função `getPrimeiroNome` para o nome do aluno)*
  * **Vencido (< 0 dias):** "Olá, {Nome}! Tudo bem? O prazo oficial de {modulo} foi encerrado. Notei no sistema que ainda consta pendência para a entrega de: {tarefas}. Por favor, regularize essa situação imediatamente para evitarmos problemas com a aprovação. Fico no aguardo!"
  * **Início (>= 20 dias):** "Olá, {Nome}! Tudo bem? 🌟 Passando para avisar que a etapa de {modulo} já está em andamento. Faltam {dias} dias para o encerramento. Notei pendência para a entrega de: {tarefas}. Recomendo adiantar a execução, pra não ficar para a última hora. Qualquer coisa, pode contar comigo!"
  * **Meio (>= 8 dias):** "Olá, {Nome}! Tudo bem? Nosso lembrete de acompanhamento sobre {modulo}. Faltam {dias} dias para o encerramento. Notei no sistema que ainda consta pendência para a entrega de: {tarefas}. Vamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, pode me chamar."
  * **Reta Final (< 8 dias):** "Olá, {Nome}! Tudo bem? 🚨 Passando para alertar que entramos na reta final de {modulo}. Faltam apenas {dias} dias para o encerramento! Notei pendência para a entrega de: {tarefas}. Recomendo que regularize o quanto antes para não acumular nem termos problemas com a aprovação. Qualquer coisa, me chame."
  * **Sem Prazo (null):** "Olá, {Nome}! Tudo bem? Passando para lembrar do nosso acompanhamento sobre {modulo}. Notei pendência para a entrega de: {tarefas}. Recomendo a regularização o quanto antes para não acumular. Qualquer dúvida, pode contar comigo!"

10. Mapa de Entregas (Gestão Visual)
A tela `MapaEntregas.jsx` renderiza uma matriz cruzada para visualização rápida do status da turma, focada de forma proativa nos módulos vigentes:
* **Linhas:** Alunos ativos cadastrados no sistema, listados em ordem alfabética através de um `onSnapshot` da coleção `alunos`.
* **Colunas (Injeção via Cronograma Oficial):** A renderização das colunas não depende da existência prévia de atividades no banco de dados. O sistema consulta o arquivo de cronograma local (`cronogramaData.js`), identifica o **Módulo Atual** e o **Anterior** (mesma regra de alvo do Dashboard), e injeta as tarefas oficiais (ex: Desafio e Fórum) diretamente na tabela. Atividades mais antigas (últimos 90 dias) com notas no banco também são preservadas e renderizadas.
* **Normalização Numérica (Filtro Blindado):** Para evitar falhas de cruzamento por nomenclatura textual (ex: "Módulo 07" vs "Módulo 7"), o sistema utiliza uma função auxiliar (`extractNum`) que converte o nome do módulo em um número inteiro puro antes de processar os dados.
* **Lógica de Preenchimento:** O sistema constrói um `Set` (`entregas`) formatando uma chave padronizada e única (`aluno-numeroModulo-tarefa`) para cada entrega existente no banco de dados. Durante a renderização da matriz, se a chave gerada pela interseção (linha do aluno + coluna da tarefa) existir no `Set`, exibe-se um ícone de "Check" verde (Entregue). Caso contrário, exibe-se um ícone "X" vermelho (Pendente), garantindo que as pendências do módulo atual sejam exibidas mesmo que nenhum aluno tenha entregado a tarefa ainda.

11. Inauguração de Módulos (NovaAtividade / Configurações)
O sistema permite cadastrar módulos antecipadamente sem exigir a avaliação imediata de um aluno:
* Em `Configuracoes.jsx`, o Gestor cria o módulo e cadastra as tarefas vinculadas a ele (nome, datas e um array de `tarefas`).
* Em `NovaAtividade.jsx`, ao selecionar o módulo e a tarefa, é possível preencher o "Enunciado da Atividade" e utilizar o botão "Salvar enunciado da tarefa".
* Esta ação grava o texto diretamente na coleção `tarefas` (campos `enunciadoPadrao` ou `urlEnunciadoPadrao`) vinculada àquela atividade específica, sem gerar um novo documento na coleção de `atividades` (que exigiria nota e dados de um aluno).
* Nas futuras inserções, quando essa mesma tarefa for selecionada, o sistema consulta essa coleção (ou a última atividade cadastrada) e faz um auto-preenchimento do enunciado.

12. Gestão de Alunos
A tela `Alunos.jsx` permite adicionar ou remover nomes da coleção principal do banco.
* O cadastro é puramente um string de nome (documentos na coleção `alunos` com o campo `nome`).
* **Regra de Negócio de Status:** Um aluno é considerado "Ativo" se existir o documento na coleção `alunos`.
* O impacto global dessa lista é crítico: se um aluno é deletado aqui, ele desaparece de todas as listagens transversais em tempo real (Painel de Pendências Gerais no Dashboard, Módulo de Comunicação, e Mapa de Entregas). As pendências no sistema não existem como "dívidas explícitas gravadas" no banco, elas são calculadas em memória subtraindo a lista base de Alunos Ativos do montante de `atividades` postadas.
