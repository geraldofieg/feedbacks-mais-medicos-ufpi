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
A tela `Comunicacao.jsx` automatiza a cobrança de alunos inadimplentes cruzando dados de alunos ativos com o histórico de atividades dos últimos 90 dias.
* **Seleção de Unidade em Foco:** O sistema seleciona automaticamente o módulo ativo que está rodando no dia de hoje (baseado em `dataInicio` e `dataFim`).
* **Cruzamento (Matriz de Pendências):** O sistema mapeia todas as atividades entregues em um `Set` de strings no formato `aluno-modulo-tarefa`. Para cada tarefa do módulo em foco, ele verifica quais alunos da lista oficial (`alunosAtivos`) não constam no `Set`.
* **Mensagens e Templates:** Alunos que possuem as mesmas pendências são agrupados. O sistema gera uma mensagem padrão cujo tom de cobrança varia de acordo com os dias restantes para o fim do módulo (calculado subtraindo a data atual da `dataFim` do módulo).
* O envio é realizado via links diretos da API do WhatsApp (`wa.me`), utilizando um dicionário estático (hardcoded) de números de telefone que cruza o nome do aluno via `.includes()`, ou abre o WhatsApp Web genérico.

10. Mapa de Entregas (Gestão Visual)
A tela `MapaEntregas.jsx` renderiza uma tabela cruzada para visualização rápida das entregas recentes (últimos 90 dias):
* **Linhas:** Alunos ativos cadastrados no sistema, listados em ordem alfabética através de um `onSnapshot` da coleção `alunos`.
* **Colunas:** Tarefas dinâmicas extraídas das atividades já postadas (filtradas por `isModuloValido`), ordenadas da entrega mais recente para a mais antiga.
* **Lógica de Preenchimento:** O sistema constrói um `Set` (`entregas`) formatando uma chave única (`aluno-modulo-tarefa`) para cada entrega existente. Durante a renderização da tabela, se a chave gerada pela interseção (linha do aluno + coluna do módulo/tarefa) existir no `Set`, exibe-se um ícone de "Check" (Entregue). Caso contrário, exibe-se um ícone "X" vermelho (Pendente).

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
