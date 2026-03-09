# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 2: Modelos de Operação, IA e Nova Estação de Correção)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. 
**Regra de Ouro:** O sistema é **100% focado no educador**. Não existe "Portal do Aluno" para envio de tarefas. O professor (ou assistente) atua como o alimentador ágil dos dados (O "Digitador"), usando o sistema não apenas como avaliador, mas como uma **Agenda Pessoal, Esteira de Produção e Histórico Acadêmico** unificado.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis e o "Crachá")
O sistema opera em uma hierarquia plana de 3 níveis protegida por Tenant ID:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (Ex: UFPI, Mais Médicos). É a "chave mestra" do sistema. Nenhuma ação de gestão é permitida sem uma instituição selecionada.
2. **Nível 2 (Turmas):** O agrupador principal de alunos. Toda turma é vinculada a um `instituicaoId` e a um Professor.
3. **Nível 3 (Tarefas/Alunos):** Itens operacionais vinculados diretamente a uma Turma. A Tarefa é a "mãe" do processo de avaliação; sem ela, não há pendência, cobrança, mapa ou nota.

**Regras de Acesso e Memória (UX):**
* **Seleção Automática (VIP Onboarding):** Se o professor possuir apenas UMA instituição cadastrada no banco, o sistema a seleciona automaticamente após o login, poupando o usuário da tela de escolha.
* **Persistência de Sessão (Último Uso):** O sistema salva a última instituição acessada no cache do navegador (`localStorage` sob a chave `@SaaS_EscolaSelecionada`). Se o professor fechar e reabrir o site no dia seguinte, o sistema o devolve exatamente para o ambiente em que estava trabalhando.
* **Memória de Turma Ativa (Sincronização Global):** O sistema salva a última turma manipulada no cache (`localStorage` via chave `ultimaTurmaAtiva`). Isso impede a "amnésia de rota", garantindo que as abas de Tarefas, Cronograma e Pendências abram sempre sincronizadas na mesma turma.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave `instituicaoId` para isolamento absoluto de dados. Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`instituicoes`:** `id`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role` ('professor' ou 'admin'), `plano` ('basico', 'intermediario', 'premium'), **`promptPersonalizado`** (String para moldar a IA), **`status` ('ativo' ou 'bloqueado')**, `dataCadastro`.
* **`turmas`:** `id`, `instituicaoId`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`alunos`:** `id`, `nome`, `whatsapp` (opcional), `email` (opcional), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCadastro`.
* **`tarefas`:** `id`, `nomeTarefa` (Obrigatório), `enunciado` (Opcional), `urlEnunciado` (Opcional), `dataFim` (Firebase Timestamp), `tipo` ('entrega', 'compromisso', 'lembrete'), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCriacao`.
* **`atividades` (Respostas e Notas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta` (Opcional), `urlResposta` (Opcional), `status` ('pendente'|'aprovado'|'devolvido'), `nota` (Opcional), `feedbackSugerido`, `feedbackFinal`, `postado` (Booleano), `dataAprovacao`, `dataPostagem`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de criação (Empty State de Nível 1).
* **Troca de Contexto Inteligente:** O Dashboard possui um *Dropdown* nativo no cabeçalho para alternar entre Instituições.
* **A Esteira de Produção (Kanban Numérico Inteligente):** O Dashboard apresenta o funil de trabalho com links diretos para páginas físicas independentes. Sua exibição se adapta ao Perfil (Role):
    * **Visão Gestor (Admin):** 3 Caixas (Aguardando Revisão `/aguardandorevisao` ➔ Pronto p/ Lançar `/faltapostar` ➔ Histórico Finalizado `/historico`).
    * **Visão Professor:** 2 Caixas (Aguardando Revisão ➔ Histórico Finalizado). A caixa `/faltapostar` é oculta e seus valores somados ao Histórico.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA.

## 7. Perfis de Acesso (RBAC SaaS) e Painel Admin
A plataforma diferencia quem opera de quem administra o SaaS através do campo `role`:
* **Perfil Professor:** Visão restrita. Só enxerga dados onde seu `uid` conste como criador (`professorUid`).
* **Perfil Gestor (Admin):** Possui a **"Chave Mestra"** nas consultas do banco (`userProfile.role === 'admin'`), ignorando a trava de `professorUid` nas páginas de Turmas, Alunos, Comunicação, Pendências e Mapa de Entregas para auditar a operação completa da Instituição.
* **Painel SaaS (`/admin`):** Tela gerencial exclusiva para Admins para controle de planos, status e níveis de todos os usuários.

## 8. Modelos de Operação (Tiers/Planos de Assinatura)
* **Tier 1: Básico (Gestão Visual):** Focado no controle de recebimento e agenda.
* **Tier 2: Intermediário (Modelo Gestão):** Esteira de produção completa para feedbacks gerados externamente.
* **Tier 3: Premium (IA Integrada):** Automação via API. 
    * **Configuração Privada:** O campo `promptPersonalizado` aparece na página de **Configurações** apenas para usuários Premium, permitindo treinar a personalidade da IA.

## 9. A Nova Estação de Correção (Fluxo Centralizado)
A página de Revisar Atividade (`/revisar/id`) atua como o HUB de entrada e saída de dados, substituindo a antiga "Nova Atividade".
* **A Visão do "Digitador":** Permite a criação de atividade *on-the-fly*. O professor preenche os campos e o sistema cria o vínculo no banco instantaneamente.
* **Senso de Conclusão:** Ao salvar, a tela exibe o "Cartão de Aprovado" para confirmação visual, oferecendo o botão "Avaliar Próximo Aluno ➔".
* **Vocabulário de Sistema Oficial:** O botão "Marcar como Lançado" e os controles de reversão são exclusivos para usuários com perfil de Gestor (Admin).

## 10. Gestão de Tarefas e Regra de Distribuição
O cadastro de itens ocorre na página de `/tarefas` com as categorias: `Tarefa do Aluno`, `Compromisso` ou `Post-it`.
* **UX de Preenchimento:** A ordem dos campos segue o fluxo natural: 1º Título, 2º Enunciado, 3º Data/Hora.
* **Inteligência de Horário:** Caso o professor selecione uma data mas não defina o horário, o sistema injeta automaticamente **23:59** no banco, garantindo o prazo total do dia.
* **Batch Write:** Ao criar uma "Tarefa do Aluno", o sistema distribui automaticamente o registro `pendente` para todos os alunos daquela turma.

## 11. Módulo de Comunicação e Cobrança
Automatização de cobranças baseada no cruzamento de alunos x tarefas pendentes.

### Redação de Mentoria e Apoio (Regras de Data):
* **Grupo Geral da Turma:**
    * **Vencido (< 0 dias):** "Olá, pessoal! O prazo oficial de {tarefa} foi encerrado. Notei algumas pendências no sistema. Por favor, regularizem as entregas imediatamente..."
    * **Início (>= 20 dias):** "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está em andamento. Faltam {dias} dias..."
    * **Meio (>= 8 dias):** "Olá, pessoal! Nosso lembrete de acompanhamento sobre {tarefa}. Entramos na fase intermediária e faltam {dias} dias..."
    * **Reta Final (< 8 dias):** "Olá, colegas! 🚨 Passando para alertar que entramos na reta final de {tarefa}. Faltam apenas {dias} dias..."
* **Templates Individuais:** Utilizam o primeiro nome do aluno e listam nominalmente as tarefas em atraso.

### Ações de Disparo:
* **Copiar:** Para colagem manual em sistemas oficiais.
* **Zap Privado:** Abre link direto do `wa.me` utilizando o telefone cadastrado no banco.

## 12. Mapa de Entregas e Pendências
* **Mapa:** Tabela dinâmica (Check/X) com rolagem horizontal e coluna de nomes fixada.
* **Pendências:** Relatório analítico por tarefa com selos de prazo e atalhos de cobrança direta. Ambas suportam a "Chave Mestra" para Admins.

## 13. Gestão de Alunos
O cadastro exige vínculo com `Turma`.
* **Integridade:** A exclusão usa "Soft Delete" (`status: 'lixeira'`). Admins podem gerir alunos em qualquer turma da instituição.

## 14. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
1. **Estado Vazio Educativo (Empty States):** Bloqueia tabelas vazias e exibe "Call to Action" orientando a criação da entidade pai.
2. **Criação "Just-in-Time":** Permite criar turmas dentro do fluxo de cadastro de alunos para evitar interrupções.
3. **Navegação Profunda e Breadcrumbs:** Uso de trilha de navegação integrada ao título, exibindo a Instituição ativa.
4. **CRUD Dinâmico e Soft Delete:** Oculta dados da tela sem deletar do banco, preservando o histórico acadêmico.
5. **Proteção de Rota Invisível:** Ocultação de elementos que exigem contexto caso nenhuma instituição esteja selecionada.
6. **Memória de Navegação (Auto-Foco):** Pré-seleção automática da última Turma ativa ou Tarefa mais recente nos Dropdowns.
7. **Redução do Caminho do Clique (Teletransporte):** Cartões de "Entrega" no Dashboard ou Cronograma redirecionam o professor diretamente para a Estação de Correção (`/revisar/id`).
8. **Espião de Rotas:** Rastreia `location.state` para forçar a atualização instantânea de dropdowns ao trocar de página.

## 15. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Botão "+" no canto inferior direito para acesso rápido à criação de Turmas, Tarefas e Alunos. Condicionado à seleção de uma Instituição.

## 16. Cronograma Dinâmico
A página `/cronograma` processa todas as tarefas do banco em tempo real.
* **O Radar:** Lembretes/Post-its fixos no topo (sem prazo).
* **A Linha do Tempo:** Ordenação vertical por proximidade de data com badges informativos de status.
