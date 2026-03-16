# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em Desenvolvimento (Fase 2: Motor Gemini 3.1, Lógica Tricolor e Nova Estação de Correção Ficha Médica)

## 1. Visão Geral
Sistema SaaS (Software as a Service) de dashboard para professores avaliarem e gerenciarem o feedback de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda diversas faculdades de forma isolada, ágil e segura. 
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
2. **Nível 2 (Turmas):** O agrupador principal de alunos. Toda turma é vinculada a um `instituicaoId` e a Professor. Podem atuar como **"Master Templates"** (Modelos de Clonagem) se autorizadas por um Administrador.
3. **Nível 3 (Tarefas/Alunos):** Itens operacionais vinculados diretamente a uma Turma. A Tarefa é a "mãe" do processo de avaliação; sem ela, não há pendência, cobrança, mapa ou nota.

**Regras de Acesso e Memória (UX):**
* **Seleção Automática (VIP Onboarding):** Se o professor possuir apenas UMA instituição cadastrada no banco, o sistema a seleciona automaticamente após o login.
* **Persistência de Sessão (Último Uso):** O sistema salva a última instituição acessada no cache do navegador (`localStorage` sob a chave `@SaaS_EscolaSelecionada`).
* **Memória de Turma Ativa (Sincronização Global):** O sistema salva a última turma manipulada no cache (`localStorage` via chave `ultimaTurmaAtiva`). Isso garante que as abas de Tarefas, Cronograma e Pendências abram sempre sincronizadas na mesma turma.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role`, `plano`, `promptPersonalizado`, `dataExpiracao`, `isVitalicio`, `historicoAssinatura`.
* **`atividades` (Respostas e Notas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta`, `status` ('pendente'|'aprovado'), `nota`, `feedbackSugerido`, `feedbackFinal`, `postado` (Booleano), `dataAprovacao`, `dataPostagem`, `dataCriacao`, `arquivoUrl`, `nomeArquivo`. 
* **Campos de Retrocompatibilidade V1/V3 (Estratégia Poliglota/Dupla Etiqueta):** Salva simultaneamente `nomeAluno` (V3) e `aluno` (V1), `nomeTarefa` (V3) e `tarefa`/`modulo` (V1), `revisadoPor` (Nome do revisor). 
* **Regra Crítica de Sincronia (Prevenção de Falsos Positivos na V1):** Em rascunhos (`status: 'pendente'`) ou ao devolver para revisão, o campo `dataAprovacao` não pode ser salvo como `null`. Ele deve ser fisicamente arrancado do banco de dados utilizando a diretriz `deleteField()` do Firestore. Isso impede que a V1 (que valida a mera existência da chave para mudar de funil) jogue o aluno acidentalmente para a caixa de "Falta Postar".
* **Regra de Validação de Entrega (Texto ou Arquivo):** Para fins de contagem em dashboards, mapas e listas de pendências, uma atividade só é considerada "entregue/em revisão" se possuir texto no campo `resposta` **OU** se possuir um link de anexo no campo `arquivoUrl`. Ambas as condições devem ser verificadas simultaneamente para evitar a invisibilidade de alunos nas listagens.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada, o Dashboard exibe a interface de criação de Nível 1.
* **Atalho VIP de Ação Rápida (Card Multi-Tarefas):** O Dashboard avalia se existem tarefas em andamento cruzando a data atual. Se houver múltiplas tarefas ativas, o card central se adapta transformando-se em uma lista rolável (Cardápio Completo). O texto do botão de cada tarefa possui inteligência: se não houver progresso, exibe **"Iniciar correções"**; se pelo menos uma resposta já foi colada, atualiza para **"Continuar correções"**.
* **A Esteira de Produção (Kanban Matemático Blindado):** Os alunos só entram no funil a partir do momento em que o professor **cola a resposta deles** no sistema (ou anexa arquivo):
    * **Caixa 1: Aguardando Revisão (`/aguardandorevisao`):** Resposta colada ou arquivo anexado, mas feedback não aprovado. (Ordenado: Mais recente no topo).
    * **Caixa 2: Aguardando Postar (`/faltapostar`):** Feedback aprovado, mas `postado` é `false`. (Oculta para o Tier 2).
    * **Caixa 3: Histórico Finalizado (`/historico`):** `postado` é `true`. Ciclo encerrado.
* **Termômetro da IA:** Mede a eficiência do prompt. Regra: Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA. Visível para Tier Premium e Admin.

## 7. Perfis de Acesso (RBAC SaaS) e Painel Admin
* **Perfil Professor:** Só enxerga dados onde seu `uid` conste como criador.
* **Perfil Gestor (Admin):** Possui a **"Chave Mestra"**, ignorando a trava de `professorUid` para auditar a operação completa da Instituição.
* **Painel SaaS (`/admin`):** Tela gerencial exclusiva para o Super Admin gerenciar planos, expirações e Log de Auditoria financeira (`arrayUnion`).

## 8. Modelos de Operação (Tiers/Planos de Assinatura)
* **Tier 1: Básico ("O Organizador Pessoal"):** Focado na Gestão Visual e Cobrança. Faz a operação manual. A interface da IA atua como **Vitrine de Vendas** (Cadeado 🔒) redirecionando para a nova página de `/planos`.
* **Tier 2: Intermediário ("SaaS Assistido" / Patrícia):** Operação terceirizada. O professor atua apenas como Revisor. O botão de Lançar Oficialmente é removido de sua tela. **Blindagem física:** Este usuário é impedido de acessar a página `/faltapostar` (URL direta), garantindo que apenas o Administrador finalize o processo.
* **Tier 3: Premium ("O Lobo Solitário Turbo"):** Automação completa integrada via IA Gemini 3.1 Flash. 
    * **Configuração Privada:** O campo `promptPersonalizado` aparece na página de Configurações para treinar a personalidade da IA.

## 9. A Nova Estação de Correção (Fluxo "Ficha Médica" e IA)
A página de Revisar Atividade (`/revisar/id`) é o HUB principal do sistema.
* **Barra de Progresso (UX E-commerce):** Exibe os 3 passos: `1. Trazer Resposta` ➔ `2. Revisar Feedback` ➔ `3. Lançar Oficial`.
* **Assinatura e Log:** Toda atividade aprovada exibe a hora exata e o nome de quem revisou (Log de Auditoria visível na tela).
* **Gerenciamento Gestor (Opções de Emergência):** Botões para **Devolver p/ Revisão** (volta para Amarelo limpando a data) ou **Excluir Atividade** (apaga a resposta e volta o aluno para Vermelho).
* **IA Gemini 3.1 Flash Lite:** Integra modelo avançado com *Search Grounding* ativo.
* **Layout "Sticky":** No Desktop, a Mesa de Avaliação (coluna direita) fica fixada durante a rolagem.

## 10. Semáforo Acadêmico e Fluxo de Trabalho (Linha de Chegada)
O sistema orienta o professor através de Ícones Tricolores no buscador de alunos:
* 🔴 **Aguardando:** O aluno está na turma, mas a resposta ainda não foi trazida para a plataforma.
* 🟡 **Em Revisão:** A resposta (texto ou arquivo) já está aqui, mas o feedback não foi aprovado ou a atividade não foi marcada como lançada no portal oficial.
* ✅ **Lançado:** Trabalho concluído! O feedback e a nota já foram lançados para o portal oficial da instituição. Status blindado no histórico.

## 11. Gestão de Tarefas, Automação e Motor de Clonagem
* **Batch Write:** Ao criar uma "Tarefa do Aluno", o sistema distribui automaticamente o registro para todos os alunos.
* **O Motor de Clonagem (Turma Modelo):** Professores podem "Criar Turma a partir de Modelo", replicando 100% das tarefas e enunciados de uma turma master, sem copiar os alunos.

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
* **Zap Direto (Coluna Esquerda):** Abre link direto do `wa.me` utilizando o telefone cadastrado. Oculta devedores sem telefone válido.

## 13. Mapa de Entregas e Pendências
* **Mapa:** Tabela dinâmica (Check/X) com rolagem horizontal e coluna de nomes fixada.
* **Relatório de Pendências:** Organiza a inadimplência utilizando a mesma taxonomia visual do Cronograma. Possui atalho de redirecionamento focado (`alunoAlvo`) para a página de Comunicação.

## 14. Gestão de Alunos e Matrículas Inteligentes
* **Matrícula Vapt-Vupt:** Modal de cadastro único que, ao salvar, limpa os campos e devolve o foco ao primeiro input.
* **Importador Mágico (Lote):** Recurso para importar alunos do Excel/Word via "Copiar e Colar" com proteção contra duplicidade em tempo real.

## 15. Cronograma Dinâmico e Fichas Técnicas SaaS
* **Aba 1 (Agenda de Entregas):** Processa tarefas em tempo real com agrupamento visual por urgência (Laranja, Azul, Cinza). **O botão de ação rápida na tarefa é inteligente e muda de "Iniciar" para "Continuar correções" conforme o avanço.**
* **Aba 2 (Ficha Técnica Oficial):** Exibe documentos curriculares estáticos locais (`src/data/`). Acesso restrito via Trava de Segurança (Strict Match) entre Instituição e Turma.

## 16. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
1. **Teletransporte Contextual:** Links que carregam a Estação de Correção enviando o `alunoId` via `location.state`, garantindo que o aluno clicado já apareça selecionado e carregado automaticamente.
2. **Estado Vazio Educativo (Empty States):** Bloqueia tabelas vazias e orienta a criação da entidade pai.
3. **Criação "Just-in-Time":** Permite criar turmas dentro do fluxo de cadastro de alunos.
4. **CRUD Dinâmico e Soft Delete:** Oculta dados via `status: 'lixeira'`. Resgate via `/lixeira`.
5. **Memória de Navegação (Auto-Foco):** Pré-seleção da última Turma ativa ou Tarefa mais recente nos Dropdowns.
6. **Global Utility Menu:** Alocado no canto superior direito para configurações privadas, resgate de lixeira e logout.
7. **Super Auto-Linker (Migração Silenciosa):** Nas listas de pendências da V3, o sistema normaliza agressivamente os nomes das tarefas (removendo espaços e maiúsculas). Se detectar uma tarefa órfã importada via cronograma da V1, ele a recria dinamicamente no banco e amarra o `tarefaId` correto sob o capô, prevenindo links quebrados (chutes para a Home) de forma 100% transparente ao usuário.

## 17. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Acesso rápido à criação de Turmas, Tarefas e Alunos.
* **O "Espião" Inteligente (Omnipresente):** Avalia a base de dados e injeta dinamicamente o sub-botão VIP **"Corrigir tarefa atual"** se houver uma tarefa ativa hoje. 
