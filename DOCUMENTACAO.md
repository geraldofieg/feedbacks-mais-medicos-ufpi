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
* **Memória de Turma Ativa (Sincronização Global):** O sistema salva a última turma manipulada no cache (`localStorage` via chave `ultimaTurmaAtiva`). Isso impede a "amnésia de rota", garantindo que as abas de Tarefas, Cronograma e Pendências abram sempre sincronizadas na mesma turma, sem resetar para a primeira da lista.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave `instituicaoId` para isolamento absoluto de dados. Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`instituicoes`:** `id`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `plano` ('basico', 'intermediario', 'premium'), **`promptPersonalizado`** (String para moldar a IA), **`status` ('ativo' ou 'bloqueado')**, `dataCadastro`.
* **`turmas`:** `id`, `instituicaoId`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`alunos`:** `id`, `nome`, `whatsapp` (opcional), `email` (opcional), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCadastro`.
* **`tarefas`:** `id`, `nomeTarefa` (Obrigatório), `enunciado` (Opcional), `urlEnunciado` (Opcional), `dataFim` (Firebase Timestamp com precisão de hora e minuto), `tipo` ('entrega', 'compromisso', 'lembrete'), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCriacao`.
* **`atividades` (Respostas e Notas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta` (Opcional), `urlResposta` (Opcional), `status` ('pendente'|'aprovado'|'devolvido'), `nota` (Opcional), `feedbackSugerido`, `feedbackFinal`, `postado` (Booleano), `dataAprovacao`, `dataPostagem`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de criação (Empty State de Nível 1).
* **Troca de Contexto Inteligente:** O Dashboard possui um *Dropdown* (Menu Suspenso) nativo no cabeçalho. Ele permite ao professor alternar instantaneamente entre suas Instituições cadastradas ou criar uma nova, sem precisar retroceder na navegação.
* **Centro de Comando Mutante (Inversão de Hierarquia):** O layout adapta-se à maturidade do usuário:
    * Se `Turmas === 0`, o topo destaca convites de criação e oculta os atalhos.
    * Se `Turmas > 0`, os botões de criação viram atalhos discretos.
* **Ponto de Situação do Curso (Senso de Urgência):** Letreiro escuro no topo do Dashboard exibindo as tarefas do tipo 'Entrega' que estão ativas, com contagem regressiva de dias para o encerramento, sinalizando o foco do momento.
* **A Esteira de Produção (Kanban Numérico Inteligente):** O Dashboard apresenta o funil de trabalho com links diretos para as listas. Sua exibição se adapta ao Perfil (Role):
    * **Visão Gestor (Admin):** 3 Caixas (Aguardando Revisão ➔ Pronto p/ Lançar ➔ Histórico Finalizado). A caixa do meio leva à tela exclusiva `/faltapostar`.
    * **Visão Professor:** 2 Caixas (Aguardando Revisão ➔ Histórico Finalizado). A caixa do meio é ocultada e seus valores são somados ao Histórico, blindando o professor de ações burocráticas que não lhe cabem.
* **Radar da Semana (Mini-Cronograma):** Injetado na tela inicial, exibe até 3 eventos programados para os próximos 7 dias. Cartões de "Tarefa do Aluno" funcionam como links mágicos para a correção.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA.

## 7. Perfis de Acesso (RBAC SaaS) e Painel Admin
A plataforma diferencia quem opera de quem administra o SaaS, aplicando filtros severos no banco de dados:
* **Perfil Professor:** Visão isolada e restrita. Só enxerga dados pertencentes ao `instituicaoId` selecionado **E** onde seu `uid` conste como criador (`professorUid`).
* **Perfil Gestor (Super Admin):** * Possui a **"Chave Mestra"** nas consultas do banco, ignorando a trava de `professorUid` para enxergar e auditar turmas e tarefas criadas por outros professores dentro de uma Instituição.
    * Tem acesso a um botão oculto na Navbar (Coroa Roxa) que leva ao **Painel SaaS (`/admin`)**.
    * **Painel SaaS:** Tela gerencial para controle de assinaturas, onde o Gestor visualiza todos os usuários do sistema, podendo alterar em tempo real o Plano (Básico, Intermediário, Premium), o Nível de Acesso (Professor/Gestor) e o Status de Acesso (Ativo/Bloqueado).

## 8. Modelos de Operação (Tiers/Planos de Assinatura)
O sistema adapta sua funcionalidade com base no plano/perfil do professor logado:
* **Tier 1: Básico (Gestão Visual e Agenda):**
    * Focado na gestão de tempo e controle de recebimento (ex: trabalhos físicos entregues em sala).
    * O professor cria a tarefa apenas com título. Não é obrigado a preencher resposta ou feedback.
    * O professor lança apenas a Nota ou marca um "Check" para ter controle no Mapa de Entregas e fazer a cobrança via WhatsApp.
* **Tier 2: Intermediário (BYO-AI - Traga sua própria IA / Modelo Gestão):**
    * Focado no professor que gera o feedback em ferramentas externas (ChatGPT, Claude).
    * O professor copia a Resposta do Aluno e o Feedback gerado externamente e cola no sistema.
    * O sistema atua como esteira, organizando o funil de "Aguardando Revisão -> Falta Postar -> Finalizado".
* **Tier 3: Premium (IA Integrada via API):**
    * Automação de ponta a ponta. O professor cola a Resposta do Aluno e o sistema (via API OpenAI/Gemini) processa a leitura e gera o `feedbackSugerido` na hora.
    * **Engenharia de Prompt Privada:** Configuração oculta (`promptPersonalizado`) onde o professor define o "Tom de Voz" da sua IA (ex: "Seja acolhedor, cite o SUS"). O campo fica na área de Configurações, mantendo a operação diária limpa.

## 9. A Nova Estação de Correção (Fluxo Centralizado)
A página de Revisar Atividade (`/revisar/id`) atua como o HUB de entrada e saída de dados. Substitui a antiga página de "Nova Atividade" solta da V1, agrupando a visualização da turma inteira:
* **A Visão do "Digitador":** Como não há portal do aluno, a tela permite a **criação de atividade on-the-fly**. Se o aluno não tiver resposta, os campos ficam abertos. O professor cola a Resposta, digita a Nota/Feedback e o sistema salva e cria o vínculo no banco instantaneamente.
* **Senso de Conclusão e Paginação UX:** Ao salvar, a tela *não* avança invisivelmente. Ela exibe o "Cartão Escuro de Aprovado" para o professor ter certeza do salvamento, oferecendo um botão claro de "Avaliar Próximo Aluno ➔" para continuar a varredura.
* **Blindagem de Datas (Anti-Crash):** Utiliza um conversor de *timestamp* universal para evitar a "tela branca" ao renderizar datas antigas ou em formatos mistos.
* **Vocabulário de Sistema Oficial (Separação de Papéis):** O botão final de fluxo adota a nomenclatura genérica **"Marcar como Lançado"**. Este botão e os controles gerenciais **só aparecem para o Gestor**. Para o professor comum, o trabalho finaliza na Aprovação.

## 10. Gestão de Tarefas e Regra de Distribuição
O professor cadastra itens na página de `/tarefas` com categorias distintas: `Tarefa do Aluno`, `Compromisso` ou `Post-it`.
* **Hierarquia Invertida:** A página foca na gestão do dia a dia. A barra de busca e os registros existentes aparecem no topo, enquanto o formulário de "Nova Tarefa" é fixado no rodapé (mobile) ou na lateral.
* **A Máquina de Distribuição Automática (Batch Write):** Ao criar uma "Tarefa do Aluno", o sistema realiza uma varredura silenciosa e cria um registro de `Atividade (Pendente)` para cada aluno ativo da turma, alimentando instantaneamente o Kanban e o Mapa de Pendências.
* **Regra de Exceção (Recuperação):** O formulário possui uma flag avançada "Atribuir apenas a alunos específicos". Ao marcá-la, exibe checkboxes com os nomes da turma, permitindo gerar pendências cirúrgicas apenas para quem fará provas de segunda chamada.

## 11. Módulo de Comunicação e Cobrança
Automatização de cobranças baseada no cruzamento de alunos ativos x tarefas pendentes (filtrando apenas itens do tipo `entrega` / `Tarefa do Aluno`). O sistema lê automaticamente a `dataFim` da tarefa para definir o tom da mensagem.

### Redação de Mentoria e Apoio (Regras de Data):
* **Grupo Geral da Turma:**
    * **Vencido (< 0 dias):** "Olá, pessoal! O prazo oficial da tarefa {tarefa} foi encerrado. Notei algumas pendências no sistema..."
    * **Início (>= 20 dias):** "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está em andamento. Faltam {dias} dias para o encerramento..."
    * **Meio (>= 8 dias):** "Olá, pessoal! Nosso lembrete de acompanhamento sobre a {tarefa}. Entramos na fase intermediária e faltam {dias} dias..."
    * **Reta Final (< 8 dias):** "Olá, colegas! 🚨 Passando para alertar que entramos na reta final da {tarefa}. Faltam apenas {dias} dias..."
* **Templates Individuais:** Devem usar obrigatoriamente o primeiro nome do aluno (extraído e capitalizado automaticamente) e listar nominalmente as tarefas em atraso.

### Ações de Disparo (UX):
* **Sistema Oficial:** Copia o texto para ser colado no Moodle/Canvas.
* **Zap Privado:** Abre link direto do `wa.me` utilizando o campo `whatsapp` do banco de dados.

## 12. Mapa de Entregas e Pendências
* **Mapa:** Renderiza uma tabela dinâmica com alunos (linhas) e tarefas (colunas), exibindo Checks Verdes ou X Vermelhos. Em dispositivos móveis, utiliza rolagem horizontal com a coluna de nomes "congelada".
* **Pendências (Visão por Tarefa):** Agrupa alunos devedores sob o título de cada tarefa (filtrando apenas `Tarefa do Aluno`). 
    * Exibe selos inteligentes de prazo visual ("Vencido em..." em vermelho, "Vence em..." em azul).
    * Permite ação direta de cobrança via atalho para o módulo de comunicação, com pré-seleção automática do aluno alvo.

## 13. Gestão de Alunos (Impacto Sistêmico)
O cadastro de alunos exige vinculação a uma `Turma`.
* **Integridade:** Se um aluno é enviado para a lixeira, o sistema recalcula instantaneamente os relatórios. O aluno não pode ser excluído fisicamente para não gerar dados órfãos em históricos passados.

## 14. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
1. **Estado Vazio Educativo (Empty States):** Se o usuário acessar uma tela filha sem ter a entidade pai (Ex: acessar `/alunos` sem ter Turmas), o sistema bloqueia as tabelas vazias e exibe um "Call to Action" orientando a criação.
2. **Criação "Just-in-Time":** Interrupções de fluxo são proibidas. Ao cadastrar um Aluno, se a `Turma` desejada não existir, o professor pode criá-la dinamicamente por um botão `+ Nova Turma` dentro do próprio modal.
3. **Navegação Profunda e Breadcrumbs:** Telas internas usam o `<Breadcrumb />` integrado ao título (exibindo a Instituição ativa) para evitar links mortos e preservar espaço no celular.
4. **CRUD Dinâmico e Soft Delete:** A exclusão usa "Soft Delete" (`status: 'lixeira'`), ocultando o dado da tela sem deletá-lo do banco de dados.
5. **Proteção de Rota Invisível:** Ocultação de elementos que exigem contexto caso o usuário não tenha selecionado uma instituição.
6. **Memória de Navegação (Auto-Foco):** Para economizar cliques, o sistema sempre tenta pré-selecionar automaticamente a última Turma ativa ou a Tarefa mais recente nas listas suspensas (Dropdowns) das páginas de Comunicação e Gestão, evitando que o professor encontre uma tela em branco.
7. **Redução do Caminho do Clique (Teletransporte):** Cartões referentes a tarefas do tipo "Entrega" no Dashboard ou no Cronograma funcionam como hiperlinks mágicos. Um único clique redireciona o professor diretamente para a respectiva Estação de Correção (`/revisar/id`). Cartões de Compromisso/Lembrete são estáticos (apenas expansivos para leitura).
8. **Espião de Rotas:** O sistema rastreia o estado (`location.state`) oriundo dos cliques dos cartões para forçar componentes dropdown a atualizarem a turma instantaneamente, superando os atrasos de renderização do React.

## 15. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Um botão "+" posicionado no canto inferior direito para acesso rápido à criação de Turmas, Tarefas e Alunos de qualquer lugar do sistema. A ordem de listagem segue a frequência de uso: 1º Novo Registro, 2º Novo Aluno, 3º Nova Turma.
* **Regra de Defesa:** O botão é estritamente condicionado à regra do "Crachá" (Nível 1). Ele **não é renderizado** se o professor não tiver uma Instituição ativa selecionada.

## 16. Cronograma Dinâmico
A aba "Datas" processa todas as tarefas criadas no banco em tempo real, eliminando qualquer dependência de arquivos estáticos.
* **O Radar (A Gaveta de Post-its):** Tarefas *sem* prazo definido (Lembretes soltos) são renderizadas fixas no topo da tela, servindo como uma visão contínua.
* **A Linha do Tempo:** Entregas e Compromissos *com* `dataFim` são ordenados verticalmente (do mais próximo ao mais distante), utilizando bolinhas e badges coloridos para indicar proximidade, mantendo o botão de "Ocultar Passados".
