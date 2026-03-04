# Documentação de Arquitetura - Feedback Mais Médicos
**Status:** Em Produção

## 1. Visão Geral
Sistema de dashboard para preceptores avaliarem e gerenciarem o feedback de alunos (focado no fluxo da UFPI/Mais Médicos).

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas `onSnapshot` ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos (600000 ms), o frontend faz uma consulta `getDoc` no caminho `/sistema/config`.
* **Gatilho:** Se o valor da variável `versaoAtiva` no banco de dados for estritamente maior (`>`) que a constante local `VERSAO_LOCAL_APP`, o sistema dispara forçadamente um `window.location.reload(true)`.
* **Diretriz Arquitetural:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita da arquitetura e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Regras de Negócio e Funcionalidades (Dashboard)

### 4.1. Módulo Atual e Anterior (Lógica de Alvo)
A definição de qual é o módulo 'Atual' e o 'Anterior' renderizado no painel baseia-se em uma lógica de extração numérica:
* **Cronograma Local (Prioridade 1):** O sistema verifica o arquivo `src/data/cronogramaData.js`. Identifica o módulo cuja data de hoje caia entre `dataInicio` e `dataFim`.
* **Fallback do Banco (Prioridade 2):** Inexistindo módulo vigente, busca o maior número de módulo válido já cadastrado no banco de dados nas coleções de `atividades` e `enunciados`.
* **Trava Numérica:** Utiliza a função `extractNum()` para garantir que o alvo (`numAlvo`) e o seu antecessor (`numAlvo - 1`) sejam processados como inteiros puros, sendo obrigatoriamente `>= 7`.

### 4.2. Cálculo de Pendências (Gestão à Vista)
As pendências não são armazenadas como documentos no banco. Elas são calculadas em memória (Tempo Real):
1. Captura-se a array completa de nomes da coleção `alunos` (`alunosAtivos`).
2. Captura-se as `atividades` entregues nos últimos 90 dias.
3. Cria-se um `Set` de strings normalizadas no formato exato: `` `${aluno}-${modulo}-${tarefa}` ``.
4. Varre-se a lista de `alunosAtivos` x `tarefas_do_modulo`. Se a string combinada não existir no `Set`, o aluno é contabilizado na matriz matemática de Pendentes.

### 4.3. Termômetro da IA (Cálculo de Eficiência)
Mede a eficiência das sugestões de feedback geradas pela Inteligência Artificial.
* **Critério de Originalidade:** Uma atividade é original se `feedbackFinal.trim() === feedbackSugerido.trim()`. Qualquer caractere alterado (ignorando espaços nas pontas) desconta da originalidade.
* **Fórmula Matemática:** `(quantidade_originais / total_de_atividades_avaliadas) * 100`.

## 5. Estrutura do Banco de Dados (Firebase Firestore)
O sistema consome e manipula 4 coleções principais:
* **`alunos`**: Lista de estudantes (Referência primária: string `nome`).
* **`modulos`**: Configurações de prazo. Campos vitais: `nome`, `tarefas` (array de strings), `status` ('ativo'|'arquivado'), `dataInicio`, `dataFim`.
* **`atividades`**: Registros de entregas e notas. Campos vitais: `aluno`, `modulo`, `tarefa`, `status` ('pendente'|'aprovado'|'postado'), `dataAprovacao`, `dataPostagem`, `feedbackSugerido`, `feedbackFinal`, `postado` (booleano legado).
* **`enunciados`**: Textos base das tarefas (Chave: `modulo`).

## 6. Regras de Validação (Filtros Blindados)
Para evitar sujeira de dados antigos e inconsistência de digitação, o sistema força a sanitização de strings:
* **`isModuloValido(nome)`**: Rejeita qualquer registro se `nome.toLowerCase().includes('recupera')`. Rejeita se a extração regex `/\d+/` retornar um valor numérico `< 7`.
* **`extractNum(nome)`**: Garante que "Módulo 07", "MODULO 7" e "M07" sejam lidos de forma idêntica pelo sistema como o inteiro `7`.

## 7. Perfis de Acesso (RBAC Hardcoded)
* **Perfil Gestor (Admin):** Identidade destravada estritamente se `currentUser?.email?.toLowerCase().trim() === 'geraldofieg@gmail.com'`. Libera telas destrutivas e administrativas (`NovaAtividade.jsx`, `Alunos.jsx`, `Configuracoes.jsx`, botões de Deletar/Devolver).
* **Perfil Professora:** Operação base (Leitura e Revisão). Telas e botões sensíveis recebem ocultação no frontend (`display: none` ou bloqueio de rota).

## 8. Fluxo de Revisão (Lista de Atividades)
O ciclo de vida divide-se em 3 funis condicionais exatos implementados em `ListaAtividades.jsx`:
1. **Pendente:** `!dataAprovacao` OU `status === 'pendente'`
2. **Falta Postar:** `(dataAprovacao || status === 'aprovado')` E `!dataPostagem` E `status !== 'postado'`
3. **Finalizado:** `dataPostagem` OU `status === 'postado'` OU `postado === true` (retrocompatibilidade).

## 9. Módulo de Comunicação
A tela `Comunicacao.jsx` automatiza a cobrança de inadimplentes, cruzando alunos ativos x atividades (últimos 90 dias).
* **Smart Tabs (UX):** Filtra e exibe nativamente os módulos cuja data de hoje `(hoje >= dataInicio && hoje <= dataFim)` esteja ativa, criando botões de atalho no topo.
* **Matriz de Pendências Unificada:** Consolida todos os devedores em uma única `listaIndividualZap` (array plana e alfabética).
* **Redação de Mentoria e Apoio (Templates Exatos):**
  * **1. Grupo Geral da Turma:**
    * *< 0 dias:* "Olá, pessoal! O prazo oficial de {modulo} foi encerrado. Notei algumas pendências no sistema. Por favor, regularizem as entregas imediatamente para evitarmos problemas com a aprovação. Fico no aguardo."
    * *>= 20 dias:* "Olá, pessoal! 🌟 Passando para avisar que a etapa de {modulo} já está em andamento. Faltam {dias} dias para o encerramento. Quem já quiser ir adiantando as atividades, desejo excelentes estudos! Qualquer coisa, podem contar comigo."
    * *>= 8 dias:* "Olá, pessoal! Nosso lembrete de acompanhamento sobre {modulo}. Entramos na fase intermediária e faltam {dias} dias para o encerramento. Vamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, estou à disposição."
    * *< 8 dias:* "Olá, colegas! 🚨 Passando para alertar que entramos na reta final de {modulo}. Faltam apenas {dias} dias para o encerramento! Peço a regularização das tarefas pendentes o quanto antes para evitarmos problemas."
  * **2. Templates Individuais (WhatsApp e Plataforma):** *(Usa `getPrimeiroNome`)*
    * *< 0 dias:* "Olá, {Nome}! Tudo bem? O prazo oficial de {modulo} foi encerrado. Notei no sistema que ainda consta pendência para a entrega de: {tarefas}. Por favor, regularize essa situação imediatamente para evitarmos problemas com a aprovação. Fico no aguardo!"
    * *>= 20 dias:* "Olá, {Nome}! Tudo bem? 🌟 Passando para avisar que a etapa de {modulo} já está em andamento. Faltam {dias} dias para o encerramento. Notei pendência para a entrega de: {tarefas}. Recomendo adiantar a execução, pra não ficar para a última hora. Qualquer coisa, pode contar comigo!"
    * *>= 8 dias:* "Olá, {Nome}! Tudo bem? Nosso lembrete de acompanhamento sobre {modulo}. Faltam {dias} dias para o encerramento. Notei no sistema que ainda consta pendência para a entrega de: {tarefas}. Vamos aproveitar os próximos dias para colocar tudo em dia! Qualquer dúvida, pode me chamar."
    * *< 8 dias:* "Olá, {Nome}! Tudo bem? 🚨 Passando para alertar que entramos na reta final de {modulo}. Faltam apenas {dias} dias para o encerramento! Notei pendência para a entrega de: {tarefas}. Recomendo que regularize o quanto antes para não acumular nem termos problemas com a aprovação. Qualquer coisa, me chame."

## 10. Mapa de Entregas (Proatividade Visual)
A tela `MapaEntregas.jsx` renderiza a tabela não baseada apenas no que existe no banco, mas injetando as obrigações oficiais via Cronograma.
* **Injeção de Colunas:** A renderização invoca o `cronogramaData.js`. Identificando o módulo alvo e seu anterior, injeta forçadamente as colunas de "Desafio" e "Fórum", mesmo que o Firestore retorne zero documentos para elas.
* **Cruzamento Exato:** Cria a chave de interseção baseada em números puros: `` `${aluno}-${extractNum(modulo)}-${tarefa}` ``. A existência dessa string exata dita se renderiza o ícone Check Verde ou X Vermelho.

## 11. Inauguração de Módulos (Enunciados Base)
O Gestor pode cadastrar a instrução da tarefa antes mesmo de um aluno enviar a atividade.
* Utilizando a tela `NovaAtividade.jsx`, o gestor insere texto e clica em "Salvar enunciado da tarefa". O sistema não gera documento em `atividades`, mas grava na coleção paralela `tarefas` nos campos `enunciadoPadrao` ou `urlEnunciadoPadrao`.

## 12. Gestão de Alunos (Impacto Sistêmico)
O cadastro em `Alunos.jsx` é uma string simples de nome, mas comanda o cálculo transversal do sistema.
* Se um nome for deletado, a subtração em tempo real deixa de encontrar esse aluno. Ele desaparece instantaneamente de:
  1. Painel de Pendências (Dashboard)
  2. Módulo de Comunicação (Cobranças individuais)
  3. Matriz de Mapa de Entregas.
