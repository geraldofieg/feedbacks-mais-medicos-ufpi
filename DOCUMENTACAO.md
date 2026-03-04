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
