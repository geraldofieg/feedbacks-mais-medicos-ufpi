# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 1: Estrutura Multitenant e Gestão de Fluxo Concluídas)

## 1. Visão Geral
Sistema SaaS para professores avaliarem e gerenciarem o feedback de alunos com isolamento absoluto de dados entre diferentes instituições (Multitenant).

## 2. O 'Botão de Pânico' (Kill Switch)
* **Mecanismo:** Consulta a cada 10 minutos em `/sistema/config`.
* **Gatilho:** Se `versaoAtiva` (Banco) > `VERSAO_LOCAL_APP`, dispara `window.location.reload(true)`.
* **Segurança:** Proibido o uso de `onSnapshot` sem o respectivo `unsubscribe`.

## 4. Arquitetura Multitenant (A Regra do "Crachá")
O sistema opera em uma hierarquia de 3 níveis protegida por Tenant ID:
1. **Nível 1 (Instituição):** O Espaço de Trabalho. Nenhuma ação é permitida sem uma instituição selecionada (o "crachá").
2. **Nível 2 (Turmas):** Agrupador vinculado obrigatoriamente a uma instituição e a um professor.
3. **Nível 3 (Tarefas/Alunos):** Itens operacionais vinculados diretamente a uma Turma.

## 9. Módulo de Comunicação (Templates Exatos)
Automatização de cobranças baseada no cruzamento de alunos ativos x tarefas pendentes.

### Redação de Mentoria e Apoio (Regras de Data):
* **Grupo Geral da Turma:**
    * **Vencido (< 0 dias):** "Olá, pessoal! O prazo oficial da tarefa {tarefa} foi encerrado. Notei algumas pendências no sistema..."
    * **Início (>= 20 dias):** "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está liberada. Faltam {dias} dias para o encerramento..."
    * **Meio (>= 8 dias):** "Olá, pessoal! Nosso lembrete de acompanhamento sobre a {tarefa}. Entramos na fase intermediária e faltam {dias} dias..."
    * **Reta Final (< 8 dias):** "Olá, colegas! 🚨 Passando para alertar que entramos na reta final da {tarefa}. Faltam apenas {dias} dias..."

* **Templates Individuais:** Devem usar obrigatoriamente o primeiro nome do aluno (extraído e capitalizado automaticamente) e listar nominalmente as tarefas em atraso.

## 10. Mapa de Entregas e Pendências
* **Mapa:** Renderiza uma tabela dinâmica com alunos (linhas) e tarefas (colunas), exibindo Checks Verdes ou X Vermelhos.
* **Pendências:** Agrupa alunos devedores sob o título de cada tarefa. Permite ação direta de cobrança via atalho para o módulo de comunicação.

## 13. Camadas de Defesa UX
1. **Estado Vazio Educativo:** Bloqueia telas sem a "entidade pai" (ex: ver alunos sem ter turmas).
2. **Criação "Just-in-Time":** Permite criar uma Turma durante o cadastro de um Aluno.
3. **Soft Delete (Lixeira):** Exclusão lógica (`status: 'lixeira'`) para preservar integridade histórica.
4. 
