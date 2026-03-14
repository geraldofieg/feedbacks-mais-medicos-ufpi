# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 2: Motor Gemini 3.1, Lógica Tricolor e Nova Estação de Correção Ficha Médica)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades e programas educacionais de forma isolada, ágil e segura. 
**Regra de Ouro:** O sistema é **100% focado no educador**. Não existe "Portal do Aluno" para envio de tarefas. O professor (ou assistente) atua como o alimentador ágil dos dados (O "Digitador"), usando o sistema não apenas como avaliador, mas como uma **Agenda Pessoal, Esteira de Produção e Histórico Acadêmico** unificado, que serve como ponte oficial para o sistema da instituição.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um Kill Switch ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o frontend faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos listeners `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR). O padrão visual foca em leitura acadêmica: títulos em negrito escuro e inputs com peso de fonte médio.

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis e o "Crachá")
O sistema opera em uma hierarquia plana de 3 níveis protegida por Tenant ID:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (Ex: UFPI, Mais Médicos). É a "chave mestra" do sistema. Nenhuma ação de gestão é permitida sem uma instituição selecionada.
2. **Nível 2 (Turmas):** O agrupador principal de alunos. Toda turma é vinculada a um `instituicaoId` e a um Professor. Podem atuar como **"Master Templates"** (Modelos de Clonagem) se autorizadas por um Administrador.
3. **Nível 3 (Tarefas/Alunos):** Itens operacionais vinculados diretamente a uma Turma. A Tarefa é a "mãe" do processo de avaliação; sem ela, não há pendência, cobrança, mapa ou nota.

**Regras de Acesso e Memória (UX):**
* **Seleção Automática (VIP Onboarding):** Se o professor possuir apenas UMA instituição cadastrada no banco, o sistema a seleciona automaticamente após o login, poupando o usuário da tela de escolha.
* **Persistência de Sessão (Último Uso):** O sistema salva a última instituição acessada no cache do navegador (`localStorage` sob a chave `@SaaS_EscolaSelecionada`). Se o professor fechar e reabrir o site no dia seguinte, o sistema o devolve exatamente para o ambiente em que estava trabalhando.
* **Memória de Turma Ativa (Sincronização Global):** O sistema salva a última turma manipulada no cache (`localStorage` via chave `ultimaTurmaAtiva`). Isso impede a "amnésia de rota", garantindo que as abas de Tarefas, Cronograma e Pendências abram sempre sincronizadas na mesma turma.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as coleções recebem a chave `instituicaoId` para isolamento absoluto de dados. Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`instituicoes`:** `id`, `nome`, `professorUid`, `status`, `dataCriacao`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role` ('professor' ou 'admin'), `plano` ('trial', 'basico', 'intermediario', 'premium'), `promptPersonalizado` (String para moldar a IA), `status` ('ativo' ou 'bloqueado'), `dataCadastro`, `dataExpiracao` (Timestamp da validade do plano), `isVitalicio` (Booleano), **`historicoAssinatura`** (Array de objetos registrando a trilha de auditoria financeira).
* **`turmas`:** `id`, `instituicaoId`, `nome`, `professorUid`, `status`, **`isModelo`** (Booleano - define se é um template clonável), `dataCriacao`.
* **`alunos`:** `id`, `nome`, `whatsapp` (opcional), `email` (opcional), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCadastro`.
* **`tarefas`:** `id`, `nomeTarefa` (Obrigatório), `enunciado` (Antigo 'Observações' - Opcional, alimenta a IA), `urlEnunciado` (Opcional), `dataInicio`, `dataFim`, **`ano`** (Inteiro - indexador de ciclo escolar), `tipo` ('entrega', 'compromisso', 'lembrete'), `turmaId`, `instituicaoId`, `professorUid`, `status`, `dataCriacao`.
* **`atividades` (Respostas e Notas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta` (Opcional), `urlResposta` (Opcional), `status` ('pendente'|'aprovado'|'devolvido'), `nota` (Opcional), `feedbackSugerido` (Da IA), `feedbackFinal` (Editado), `postado` (Booleano - confirmação de lançamento oficial), `dataAprovacao`, `dataPostagem`, `dataCriacao`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada na sessão, o Dashboard exibe a interface de criação (Empty State de Nível 1).
* **Troca de Contexto Inteligente:** O Dashboard possui um *Dropdown* nativo no cabeçalho para alternar entre Instituições.
* **Atalho VIP de Ação Rápida (Teletransporte):** Foco em redução de *Time to Value*. O Dashboard avalia dinamicamente se existe uma tarefa em andamento (data de hoje contida no prazo). Caso positivo, exibe um card roxo de destaque que teletransporta o professor diretamente para a tela de Estação de Correção (`/revisar/:id`). O texto do botão possui inteligência de banco de dados: se não houver progresso, exibe **"Iniciar correções"**; se pelo menos uma resposta já foi colada, atualiza para **"Continuar correções"**.
* **A Esteira de Produção (Kanban Matemático Inteligente):** O Dashboard apresenta o funil de trabalho espelhado no Semáforo Acadêmico. Os alunos só entram na matemática da Revisão a partir do momento em que o professor **cola a resposta deles** no sistema (`temResposta === true`):
    * **Caixa 1: Aguardando Revisão (`/aguardandorevisao`):** Resposta colada, mas feedback não aprovado. (Bolinhas vermelhas *não* somam aqui, pois não há resposta para revisar).
    * **Caixa 2: Aguardando Postar (`/faltapostar`):** Feedback aprovado, mas `postado` ainda é `false`. (Oculta para o Tier 2).
    * **Caixa 3: Histórico Finalizado (`/historico`):** `postado` é `true`. Ciclo encerrado definitivamente.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA. Apenas visível para Tier Premium e Admin.
* **Motor de Urgência (Gestão à Vista):** Exibe listas nominais de pendências no Dashboard usando cruzamento matemático estrito de `dataInicio`, `dataFim` e data atual do navegador. Hierarquia de exibição: 1º Tarefa Atual (ou próxima), 2º Última Tarefa Anterior (vencida recentemente).

## 7. Perfis de Acesso (RBAC SaaS) e Painel Admin
A plataforma diferencia quem opera de quem administra o SaaS através do campo `role`:
* **Perfil Professor:** Visão restrita. Só enxerga dados onde seu `uid` conste como criador (`professorUid`).
* **Perfil Gestor (Admin):** Possui a **"Chave Mestra"** nas consultas do banco (`userProfile.role === 'admin'`), ignorando a trava de `professorUid` nas páginas de Turmas, Alunos, Comunicação, Pendências e Mapa de Entregas para auditar a operação completa da Instituição. Também possui exclusividade na criação de Turmas Modelo (Selos Master).
* **Painel SaaS (`/admin`):** Tela gerencial exclusiva. Permite alterar o `role` de usuários, definir `plano` (Tier 1, 2, 3) e excluir contas (Hard Delete). 
    * **Gestão de Assinaturas e Auditoria:** O Super Admin pode renovar planos inteligentemente (+30 dias, +1 Ano, Vitalício) preservando saldos futuros. Possui recurso de edição manual de datas e registro inviolável de Log de Auditoria (`arrayUnion`), que mapeia quando a ação ocorreu, qual foi a modificação financeira e qual e-mail executou a ação.

## 8. Modelos de Operação (Tiers/Planos de Assinatura)
* **Trial Automático (A Barreira do SaaS):** Ao criar uma nova conta, o sistema injeta automaticamente o `plano: 'trial'` e define a `dataExpiracao` para 30 dias após o cadastro.
* **Bloqueio de Inadimplência:** O arquivo `App.jsx` atua como catraca (`PrivateRoute`). Se `dataExpiracao` for menor que a data de hoje, o usuário é redirecionado compulsoriamente para `/assinatura-vencida`, bloqueando o acesso ao painel, mas preservando seus dados no banco. O e-mail do fundador e usuários com `isVitalicio: true` ignoram essa trava.
* **Tier 1: Básico ("O Organizador Pessoal"):** Focado na Gestão Visual e Régua de Cobrança. O professor faz a operação manual de avaliação. A interface da IA na tela de correção atua como uma **Vitrine de Vendas** (Botão com Cadeado 🔒) que alerta o usuário e o redireciona para a página `/planos`.
* **Tier 2: Intermediário ("SaaS Assistido" / Ex: Patrícia):** Operação terceirizada. O professor atua apenas como Revisor Vip. O botão de "Confirmar Lançamento Oficial" não existe em sua tela. Ao clicar em "Aprovar Feedback", a atividade vai para a caixa "Falta Postar" do Super Admin, que finaliza o processo no site da faculdade.
* **Tier 3: Premium ("O Lobo Solitário Turbo"):** Automação completa integrada via IA (Gemini). O professor faz tudo sozinho, mas com velocidade extrema no fluxo de correção usando a API na própria tela.
    * **Configuração Privada:** O campo `promptPersonalizado` aparece na página de Configurações, permitindo treinar a personalidade e o rigor acadêmico da IA.

## 9. A Nova Estação de Correção (Fluxo "Ficha Médica" e IA)
A página de Revisar Atividade (`/revisar/id`) atua como o HUB de entrada e saída de dados, adaptando-se inteligentemente ao "crachá" do usuário (Interface Camaleão).
* **Barra de Progresso (UX E-commerce):** O topo da tela exibe os 3 passos vitais do "Digitador": `1. Trazer Resposta` ➔ `2. Revisar Feedback` ➔ `3. Lançar Oficial`. As cores da barra avançam dinamicamente acompanhando o status no banco de dados.
* **Interface Camaleão (Rodapé Inteligente):** * Para Tiers 1 e 3, libera opções de *"Salvar Rascunho"* (pausa o trabalho na caixa Aguardando Revisão) ou o fluxo The Flash *"Aprovar e Copiar"*, seguido do botão final *"Confirmar Lançamento"*.
    * Para Tier 2, exibe apenas um botão gigante *"✅ Aprovar Feedback"*, que encerra a participação do revisor na esteira.
* **Onboarding da IA:** Se um professor Tier 3 clicar em "Gerar IA" sem ter configurado instruções, o sistema barra a ação e o redireciona para a página de Configurações, protegendo a cota da API.
* **IA Gemini 3.1 Flash Lite:** Integra modelo avançado com *Search Grounding* ativo (pesquisa no Google em tempo real para validação de protocolos médicos).
* **Layout "Sticky":** No Desktop, a coluna da direita (Mesa de Avaliação) fica fixada, acompanhando o professor enquanto rola o texto longo da resposta à esquerda. No Mobile, as áreas empilham-se naturalmente.
* **Tratamento de Cota (429):** O sistema captura falhas de limite de cota do Google e exibe um alerta amigável instruindo o professor a aguardar 60 segundos.

## 10. Semáforo Acadêmico e Fluxo de Trabalho (Linha de Chegada)
O sistema orienta o professor através de Ícones Tricolores no buscador de alunos, refletindo exatamente o status nas Caixas do Kanban:
* 🔴 **Aguardando (Fora da Caixa de Revisão):** O aluno está matriculado, mas você ainda não trouxe a resposta dele do site da faculdade para a nossa plataforma.
* 🟡 **Em Revisão (Caixas 1 e 2):** A resposta já foi colada aqui, mas ainda não foi aprovado o feedback sugerido pela IA, ou a atividade já foi aprovada mas ainda não marcada como lançada no sistema oficial.
* ✅ **Lançado (Caixa 3 - Histórico):** Trabalho concluído! O feedback e/ou a nota já foi (foram) lançada(os) para o portal oficial da instituição. Status blindado e irretroativo no funil.

## 11. Gestão de Tarefas, Automação e Motor de Clonagem
O cadastro de itens ocorre na página de `/tarefas` com as categorias: `Tarefa do Aluno`, `Compromisso` ou `Post-it`.
* **UX Educativa (PLG):** A seleção de tipos ocorre via *Choice Cards* visuais no modal centralizado.
* **Inteligência de Horário:** Injeção automática de `00:00` no Início e `23:59` no Fim se omitidos.
* **Batch Write:** Ao criar uma "Tarefa do Aluno", o sistema distribui automaticamente o registro `pendente` para todos os alunos daquela turma.
* **Sincronizador Automático de Ciclos:** Motor em `/migracao` que atualiza tarefas ou cria currículos completos (ex: M09 ao M32) em lote, com proteção anti-duplicidade e indexação pelo campo `ano`.
* **O Motor de Clonagem (Turma Modelo):** Professores podem "Criar Turma a partir de Modelo". O sistema clona a "casca" estrutural de uma turma validada pelo Admin (`isModelo: true`), replicando 100% das tarefas (com nomes, prazos e **enunciados**) para o novo professor, mas **sem copiar os alunos**.

## 12. Módulo de Comunicação e Cobrança
Automatização de cobranças baseada no cruzamento de alunos x tarefas pendentes, dividida em duas "Mesas de Trabalho" (Colunas Visuais):

### Redação de Mentoria e Apoio (Regras de Data):
* **Grupo Geral da Turma (Coluna Esquerda):**
    * **Vencido (< 0 dias):** "Olá, pessoal! O prazo oficial de {tarefa} foi encerrado. Notei algumas pendências no sistema. Por favor, regularizem as entregas imediatamente..."
    * **Início (>= 20 dias):** "Olá, pessoal! 🌟 Passando para avisar que a etapa de {tarefa} já está em andamento. Faltam {dias} dias..."
    * **Meio (>= 8 dias):** "Olá, pessoal! Nosso lembrete de acompanhamento sobre {tarefa}. Entramos na fase intermediária e faltam {dias} dias..."
    * **Reta Final (< 8 dias):** "Olá, colegas! 🚨 Passando para alertar que entramos na reta final de {tarefa}. Faltam apenas {dias} dias..."
* **Templates Individuais:** Utilizam o primeiro nome do aluno e listam nominalmente as tarefas em atraso.

### Ações de Disparo:
* **Copiar para a Plataforma (Coluna Direita):** Textos gerados para colagem manual em sistemas oficiais (Ex: Gov.br).
* **Zap Direto (Coluna Esquerda):** Abre link direto do `wa.me` utilizando o telefone cadastrado no banco do aluno. Oculta devedores sem telefone válido.

## 13. Mapa de Entregas e Pendências
* **Mapa:** Tabela dinâmica (Check/X) com rolagem horizontal e coluna de nomes fixada. Suporta a "Chave Mestra" para Admins.
* **Relatório de Pendências:** Organiza a inadimplência utilizando a mesma taxonomia visual do Cronograma (Cores por status temporal). Ordenação prioritária: 1º Vencidas Mais Recentes, 2º Em Andamento, 3º Futuras, 4º Sem Prazo. Possui atalho de redirecionamento focado (`location.state.alunoAlvo`) para a página de Comunicação.

## 14. Gestão de Alunos e Matrículas Inteligentes
O cadastro exige vínculo com `Turma`.
* **Soft Delete:** A exclusão usa `status: 'lixeira'`. Admins podem gerir alunos em qualquer turma da instituição.
* **Matrícula Vapt-Vupt:** Modal de cadastro único que, ao salvar, limpa os campos, devolve o foco ao primeiro input e exibe o alerta de sucesso sem fechar a tela.
* **Importador Mágico (Lote):** Recurso para importar alunos do Excel/Word via "Copiar e Colar". Possui barra de progresso, filtro de linhas vazias, higienização de espaços e proteção contra duplicidade em tempo real.

## 15. Cronograma Dinâmico e Fichas Técnicas SaaS
A página `/cronograma` foi reestruturada com um layout de Abas Duplas para isolar a agenda de operação da ementa pedagógica:
* **Aba 1 (Agenda de Entregas):** Processa todas as tarefas do banco em tempo real, utilizando agrupamento visual por urgência com cores semânticas (Laranja = Atual, Azul = Futuro, Cinza = Passado) com dot-indicators na linha do tempo. Lembretes sem prazo ficam no Radar (Grid) no rodapé. **O botão de ação rápida na tarefa é inteligente, lendo o banco de dados e mudando de "Iniciar correções" para "Continuar correções" conforme o avanço do professor.**
* **Aba 2 (Ficha Técnica Oficial):** Exibe documentos curriculares estáticos (ex: Eixos, Módulos, CH e Créditos). Para garantir velocidade e custo zero de Firebase, os dados residem em arquivos locais no frontend (ex: `src/data/ementaMaisMedicos.js`).
* **Trava de Segurança (Strict Match):** A Aba 2 só é renderizada se houver um casamento EXATO entre a Instituição selecionada e a Turma ativa (Ex: "UFPI" + "Facilitador Mais Médico"). Professores de outros nichos acessam apenas a "Agenda", garantindo que a propriedade intelectual (O Pacote Premium) seja escalada com segurança.

## 16. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
1. **Estado Vazio Educativo (Empty States):** Bloqueia tabelas vazias e exibe "Call to Action" orientando a criação da entidade pai.
2. **Criação "Just-in-Time":** Permite criar turmas dentro do fluxo de cadastro de alunos para evitar interrupções.
3. **Navegação Profunda e Breadcrumbs:** Uso de trilha de navegação integrada ao título, exibindo a Instituição ativa.
4. **CRUD Dinâmico e Soft Delete:** Oculta dados da tela sem deletar do banco, preservando o histórico acadêmico. Para resgate, há o utilitário de `/lixeira`.
5. **Proteção de Rota Invisível:** Ocultação de elementos que exigem contexto caso nenhuma instituição esteja selecionada.
6. **Memória de Navegação (Auto-Foco):** Pré-seleção automática da última Turma ativa ou Tarefa mais recente nos Dropdowns.
7. **Espião de Rotas:** Rastreia `location.state` para forçar a atualização instantânea de dropdowns e modais (Ex: Clicar em Novo Registro no FAB abre o Modal automaticamente) ao trocar de página.
8. **Global Utility Menu (Menu Pessoal):** Alocado no canto superior direito para configurações privadas (`/configuracoes`), resgate de dados excluídos (`/lixeira`) e logout, desobstruindo o cabeçalho de gestão (Navbar).

## 17. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Botão "+" no canto inferior direito para acesso rápido à criação de Turmas, Tarefas (Registro Universal) e Alunos. Condicionado à seleção de uma Instituição.
* **O "Espião" Inteligente (Omnipresente):** O botão avalia a base de dados em busca da Tarefa Atual em andamento. Para economizar requisições do Firebase (Read Quota), a consulta (`getDocs`) é executada sob demanda e de forma enxuta, disparando uma única vez por troca de Instituição. Caso encontre a tarefa, ele injeta dinamicamente o sub-botão VIP **"Corrigir tarefa atual"** acima dos demais.
