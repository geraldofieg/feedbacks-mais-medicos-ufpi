# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Em desenvolvimento (Fase 2: Motor Gemini 3.1, Lógica Tricolor e Nova Estação de Correção Ficha Médica)

## 1. Visão Geral
Sistema SaaS (*Software as a Service*) de *dashboard* para professores avaliarem e gerenciarem o *feedback* de alunos. A plataforma possui arquitetura *Multitenant* (múltiplas instituições), permitindo que um mesmo sistema atenda a diversas faculdades de forma isolada, ágil e segura. 
**Regra de Ouro:** O sistema é **100% focado no educador**. Não existe "Portal do Aluno" para envio de tarefas. O professor (ou assistente) atua como o alimentador ágil dos dados (o "digitador"), usando o sistema não apenas como avaliador, mas como uma **Agenda Pessoal, Esteira de Produção e Histórico Acadêmico** unificado, que serve como ponte oficial para o sistema da instituição.

## 2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ("abas zumbis" consumindo a cota do Firebase via consultas ininterruptas), o sistema possui um *Kill Switch* ativo e obrigatório no `App.jsx`.
* **Mecanismo:** A cada 10 minutos, o *frontend* faz uma consulta em `/sistema/config`.
* **Gatilho:** Se a `versaoAtiva` no banco for estritamente maior (`>`) que a `VERSAO_LOCAL_APP`, dispara-se forçadamente `window.location.reload(true)`.
* **Diretriz:** É estritamente proibido adicionar novos *listeners* `onSnapshot` no código sem aprovação explícita e sem garantir a sua desmontagem (`unsubscribe`) no `useEffect`.

## 3. Idioma Padrão
Todas as mensagens de *commit*, descrições de *Pull Requests* e comentários no código devem ser escritos EXCLUSIVAMENTE em português do Brasil (PT-BR). O padrão visual foca em leitura acadêmica: títulos em negrito escuro e *inputs* com peso de fonte médio.

## 4. Arquitetura Multitenant (A Regra dos 3 Níveis e o "Crachá")
O sistema opera em uma hierarquia plana de três níveis protegida por *Tenant ID*:
1. **Nível 1 (Instituição/Programa):** O Espaço de Trabalho (ex.: UFPI, Mais Médicos). É a "chave mestra" do sistema. Nenhuma ação de gestão é permitida sem uma instituição selecionada.
2. **Nível 2 (Turmas):** O agrupador principal de alunos. Toda turma é vinculada a um `instituicaoId` e a um professor. Podem atuar como **"Master Templates"** (modelos de clonagem) se autorizadas por um administrador.
3. **Nível 3 (Tarefas/Alunos):** Itens operacionais vinculados diretamente a uma turma. A Tarefa é a "mãe" do processo de avaliação; sem ela, não há pendência, cobrança, mapa ou nota.

**Regras de Acesso e Memória (UX):**
* **Seleção Automática (Bússola Inteligente):** O sistema identifica automaticamente a instituição ativa correta do professor com base na sua turma mais recente, garantindo que o painel abra sempre no contexto de trabalho real.
* **Persistência de Sessão (Último Uso):** O sistema salva a última instituição acessada no cache do navegador (`localStorage` sob a chave `@SaaS_EscolaSelecionada`).
* **Memória de Turma Ativa (Sincronização Global):** O sistema salva a última turma manipulada no cache (`localStorage` via chave `ultimaTurmaAtiva`). Isso garante que as abas de Tarefas, Cronograma e Pendências abram sempre sincronizadas na mesma turma.

## 5. Estrutura do Banco de Dados (Firestore)
Todas as consultas devem conter a trava estrutural: `where('instituicaoId', '==', escolaSelecionada.id)` e ignorar documentos com `status: 'lixeira'`.
* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role` (`'admin'` | `'professor'`), `plano`, `promptPersonalizado`, `dataExpiracao`, `isVitalicio`, `historicoAssinatura`, `status` (`'ativo'` | `'bloqueado'`), `ultimoAcesso`, `emailVerificado`, `vistoPeloAdmin`.
* **`tarefas`:** Agora possuem **Atribuição Específica** (`atribuicaoEspecifica: boolean`, `alunosSelecionados: array`). Tarefas podem ser exclusivas para certos alunos, prevenindo cobranças indevidas (falsos positivos). Sempre geram `dataInicio` na hora 00:00 e `dataFim` às 23:59.
* **`atividades` (Respostas e Notas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta`, `status` (`'pendente'` | `'aprovado'`), `nota`, `feedbackSugerido`, `feedbackFinal`, `postado` (booleano), `dataAprovacao`, `dataPostagem`, `dataCriacao`, `arquivoUrl`, `nomeArquivo`. 
* **Campos de Retrocompatibilidade V1/V3 (Estratégia Poliglota/Dupla Etiqueta):** Salva simultaneamente `nomeAluno` (V3) e `aluno` (V1), `nomeTarefa` (V3) e `tarefa`/`modulo` (V1), `revisadoPor` (nome do revisor). 
* **Regra Crítica de Sincronia (Prevenção de Falsos Positivos na V1):** Em rascunhos (`status: 'pendente'`) ou ao devolver para revisão, o campo `dataAprovacao` não pode ser salvo como `null`. Ele deve ser fisicamente retirado do banco de dados utilizando a diretriz `deleteField()` do Firestore. Isso impede que a V1 (que valida a mera existência da chave para mudar de funil) jogue o aluno acidentalmente para a caixa de "Falta Postar".
* **Regra de Validação de Entrega (Texto ou Arquivo):** Para fins de contagem em *dashboards*, mapas e listas de pendências, uma atividade só é considerada "entregue/em revisão" se possuir texto no campo `resposta` **OU** se possuir um *link* de anexo no campo `arquivoUrl`. Ambas as condições devem ser verificadas simultaneamente para evitar a invisibilidade de alunos nas listagens.

## 6. Regras de Negócio e Gestão à Vista (Dashboard/Porteiro)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada, o *Dashboard* exibe a interface de criação de Nível 1.
* **Atalho VIP de Ação Rápida (Card Multitarefas):** A barra preta superior exibe tarefas **estritamente em andamento hoje** (não futuras, não passadas). Otimizada para *mobile* com ícone de lápis para acesso direto à correção, liberando espaço para o título.
* **Gestão à Vista (Lista de Devedores):** Exibe nominalmente os alunos com pendências, cruzando tarefas ativas (hoje) e **tarefas anteriores** criadas a partir de um marco de corte temporal (`05/01/2026`).
* **A Esteira de Produção (Kanban Matemático Blindado):** Os alunos só entram no funil a partir do momento em que o professor **cola a resposta deles** no sistema (ou anexa um arquivo).
    * **Desfragmentador Anticlones (Deduplicação Client-Side):** As listagens ignoram versões antigas ou fantasmas na memória, agrupando pela chave `Tarefa + Aluno` e processando sempre apenas o documento mais recente.
    * **Caixa 1: Aguardando Revisão (`/aguardandorevisao`):** Resposta colada ou arquivo anexado, mas *feedback* não aprovado (ordenação: mais recente no topo).
    * **Caixa 2: Aguardando Postar (`/faltapostar`):** *feedback* aprovado, mas `postado` é `false` (oculta para o Tier 2).
    * **Caixa 3: Histórico Finalizado (`/historico`):** `postado` é `true`. Ciclo encerrado.
* **Termômetro da IA:** Mede a eficiência do *prompt*. Regra: A avaliação entra na conta verificando a exata `dataAprovacao` contra o `timestampPrompt` do usuário (para zerar estatísticas se o *prompt* mudar). Se `feedbackFinal.trim() === feedbackSugerido.trim()`, a atividade é 100% original da IA. Visível para Tier Premium e Admin.

## 7. Perfis de Acesso (RBAC SaaS) e Painel Admin
* **Segurança Clean Code:** Nenhuma verificação de autorização utiliza *hardcode* de *e-mails*. Toda validação de acesso é baseada unicamente no campo `role === 'admin'` proveniente do `AuthContext`.
* **Perfil Professor:** Só enxerga dados onde seu `uid` conste como criador.
* **Perfil Gestor (Admin):** Possui a **"chave mestra"**, ignorando a trava do `professorUid` para auditar a operação completa da instituição.
* **Painel SaaS (`/admin`):** Tela gerencial restrita. Permite: 
    * Gestão visual de assinaturas (vencido, vitalício, ativo).
    * Ações de faturamento (estender dias, conceder/revogar vitalício, edição manual de datas).
    * Suspensão instantânea de acesso (bloqueio de usuário).
    * **Gestão de Engajamento e Filtros (Custo Zero):** Rastreio em tempo real do engajamento do usuário na plataforma exibindo os status "Não ativou a conta", "Nunca logou" ou a exata data de "Último acesso". A tabela gerencial possui um motor de ordenação e filtros dinâmicos processados 100% no *frontend* (via estado do React), garantindo a reordenação instantânea dos dados com zero custo de novas requisições (leituras) ao banco de dados.
    * Botão de Emergência (*Hard Delete*): apaga todos os rastros de um usuário no banco via `writeBatch`.
    * **Relatório de Log da IA:** Painel/relatório focado na comparação entre os *feedbacks* originais gerados pela IA e os *feedbacks* finais aprovados. O sistema registra e exibe **apenas as avaliações que sofreram edições/mudanças**, permitindo auditar os ajustes feitos pelo professor sobre o conteúdo gerado.

## 8. Modelos de Operação (Tiers/Planos de Assinatura)
* **Tier 1: Básico ("O Organizador Pessoal"):** Focado na gestão visual e cobrança. Faz a operação manual. A interface da IA atua como **vitrine de vendas** (cadeado 🔒), redirecionando para a nova página de `/planos`.
* **Tier 2: Intermediário ("SaaS Assistido"):** Operação terceirizada. O professor atua apenas como revisor. O botão de "Lançar Oficialmente" é removido de sua tela. **Blindagem física:** Este usuário é impedido de acessar a página `/faltapostar` (URL direta), garantindo que apenas o administrador finalize o processo.
* **Tier 3: Premium ("O Lobo Solitário Turbo"):** Automação completa integrada via IA Gemini 3.1 Flash. 
    * **Configuração Privada:** O campo `promptPersonalizado` aparece na página de configurações para treinar a personalidade da IA.

## 9. A Nova Estação de Correção (Fluxo "Ficha Médica" e IA)
A página de Revisar Atividade (`/revisar/id`) é o *HUB* principal do sistema.
* **Barra de Progresso (UX E-commerce):** Exibe os 3 passos: `1. Trazer Resposta` ➔ `2. Revisar Feedback` ➔ `3. Lançar Oficial`.
* **Prevenção de Tap-Through (Anticlique Fantasma):** Todos os modais de sucesso (`alert`) nativos foram substituídos por microinterações visuais *inline* (ex.: botões mudando para '✅ Salvo!').
* **UX Educativa (Textos Inteligentes):** A interface "conversa" com o professor novato. Se o aluno não tem resposta colada, exibe instruções claras de colagem; se já tem resposta, os textos mudam orientando a geração ou revisão da IA.
* **Upload de Arquivos Inteligente e IA:** O sistema aceita o envio de arquivos (PDF, DOC, etc.) para análise de inteligência com proteções ativas:
    * **Trava de Custo (5MB):** Validação processada estritamente no *frontend* para bloquear o envio de arquivos imensos (acima de 5MB), blindando o custo de *Storage* e tempo da IA.
    * **UX de Resolução (iLovePDF):** O sistema fornece atalhos educativos de resolução para o cliente, exibindo um link direto para a ferramenta de compressão caso precise reduzir o arquivo.
    * **Leitura Server-Side Inteligente:** Em vez de travar o navegador do cliente decodificando PDFs localmente, a plataforma envia a URL pública do *Firebase Storage* diretamente para o prompt do Gemini 3.1, permitindo que a IA lide com a extração bruta remotamente.
* **Fluxo de Rascunho e Avisos Dinâmicos:** Ao salvar em rascunho, o sistema emite um alerta visual claro informando que a atividade continua "Em Revisão" (sinal amarelo) e não foi finalizada.
* **Mensagens Pós-Aprovação Guiadas:** Ao clicar em "Aprovar Feedback", em vez de exibir bruscamente os botões finais, o sistema injeta um texto de sucesso orientativo explicando os próximos passos lógicos (ir para a página de cópia ou copiar ali mesmo).
* **Assinatura e Log:** Toda atividade aprovada exibe a hora exata e o nome de quem revisou (*log* de auditoria visível na tela).
* **IA Gemini 3.1 Flash Lite:** Integra modelo avançado com *Search Grounding* ativo.
* **Layout "Sticky":** No *desktop*, a mesa de avaliação (coluna direita) fica fixada durante a rolagem.

## 10. Semáforo Acadêmico e Fluxo de Trabalho (Linha de Chegada)
O sistema orienta o professor através de ícones tricolores no buscador de alunos:
* 🔴 **Aguardando:** O aluno está na turma, mas a resposta ainda não foi trazida para a plataforma.
* 🟡 **Em Revisão:** A resposta (texto ou arquivo) já está aqui, mas o *feedback* não foi aprovado ou a atividade não foi marcada como lançada no portal oficial.
* ✅ **Lançado:** Trabalho concluído! O *feedback* e a nota já foram lançados para o portal oficial da instituição. *Status* blindado no histórico.

## 11. Gestão de Tarefas, Automação e Motor de Clonagem
* **Batch Write:** Ao criar uma "Tarefa do Aluno", o sistema distribui automaticamente o registro.
* **Atribuição Específica e Guardrails Visuais:** O sistema permite a criação de tarefas restritas a um grupo seleto de alunos. Para evitar erros de professores iniciantes, a interface exibe **alertas educativos contextuais**:
    * *Aviso Azul (Turma Completa):* Informa explicitamente que a tarefa gerará demanda/pendência para 100% dos alunos matriculados.
    * *Aviso Âmbar (Alunos Específicos):* Informa que a tarefa ficará completamente invisível no sistema para os alunos que não forem marcados no *checklist* (isolando a inadimplência).
* **O Motor de Clonagem (Turma Modelo):** Professores podem "Criar Turma a partir de Modelo", replicando 100% das tarefas e enunciados de uma turma *master*, sem copiar os alunos.

## 12. Módulo de Comunicação e Cobrança
Automatização de cobranças baseada no cruzamento de alunos *versus* tarefas pendentes, protegida por um **Filtro Temporal V3** (oculta o passado) e **Trava de Atribuição** (isenta não participantes). 

### Inteligência de Urgência, Resumo Geral e Prazos:
* **O "Resumo Geral" (Padrão):** O sistema carrega por padrão focado no botão "Resumo Geral". Ele varre, compila e consolida todas as tarefas ativas atrasadas de cada aluno em uma única mensagem, exibindo-as em formato de lista.
* **Algoritmo de Maior Urgência e Prazos:** Ao consolidar várias pendências de um aluno, o sistema calcula nos bastidores qual delas está mais perto de vencer (menor número de dias restantes). A mensagem gerada adapta o seu "senso de urgência" baseando-se estritamente nesta tarefa mais crítica, incluindo o detalhamento do prazo:
    * **Reta Final:** Avisos para tarefas que encerram em poucos dias.
    * **Fase Intermediária:** Prazos regulares em andamento.
    * **Prazo Encerrado:** Cobrança direta de tarefas vencidas.
* **Foco Específico:** O professor ainda pode clicar no botão de uma única textos no topo da tela para isolar a cobrança e os textos exclusivamente para aquele módulo.

### Ações de Disparo e Templates (Detalhamento de Mensagens):
* **Grupo Geral da Turma (Coluna Esquerda):** Mensagens contextuais dinâmicas prontas para copiar para o grupo. Utiliza o algoritmo de maior urgência para avisar a turma e detalha os prazos específicos (ex.: "A entrega mais próxima encerra em X dias", informando com exatidão a linha do tempo das atividades).
* **Copiar para a Plataforma (Coluna Direita):** Textos gerados individualmente utilizando o primeiro nome do aluno e os detalhes da tarefa para colagem manual em sistemas oficiais (ex.: Gov.br).
* **Zap Direto (Coluna Esquerda):** Abre *link* direto do `wa.me`. Possui um **filtro curinga de telefone** que busca pelas chaves `whatsapp`, `telefone` ou `celular`, garantindo que alunos importados via cópia em lote da V1 não fiquem ocultos na cobrança.

## 13. Mapa de Entregas e Pendências
* **Mapa de Entregas:** Tabela dinâmica indicando o *status* através de ícones (✅ Entregue, ❌ Pendente, ⚪ Isento/Traço). Possui uma **Cortina de Tempo V3** controlada via *toggle*, permitindo ao professor esconder o legado antigo (tarefas anteriores a jan/2026). No *mobile*, o contador X/Y não penaliza alunos isentos de atividades específicas.
* **Relatório de Pendências:** Organiza a inadimplência utilizando a mesma taxonomia visual do cronograma, cruzando estritamente devedores reais e tarefas ativas da V3. Possui atalho de redirecionamento focado (`alunoAlvo`) para a página de Comunicação.

## 14. Gestão de Alunos e Matrículas Inteligentes
* **Matrícula Vapt-Vupt:** Modal de cadastro único que, ao salvar, limpa os campos e devolve o foco ao primeiro *input*.
* **Importador Mágico (Lote):** Recurso para importar alunos do Excel/Word via "copiar e colar" com proteção contra duplicidade em tempo real.

## 15. Cronograma Dinâmico e Fichas Técnicas SaaS
* **Aba 1 (Agenda de Entregas):** Processa tarefas em tempo real com agrupamento visual por urgência (laranja, azul, cinza). **O botão de ação rápida na tarefa é inteligente e muda de "Lápis (Corrigir)" para "Consultar Histórico" dependendo da vigência da tarefa.**
* **Aba 2 (Ficha Técnica Oficial):** Exibe documentos curriculares estáticos locais (`src/data/`). Acesso restrito via Trava de Segurança (*Strict Match*) entre instituição e turma.

## 16. Padrões de Usabilidade e Navegação (Camadas de Defesa UX)
1. **Teletransporte Contextual:** *Links* que carregam a Estação de Correção enviando o `alunoId` via `location.state`, garantindo que o aluno clicado já apareça selecionado e carregado automaticamente.
2. **Estado Vazio Educativo (Empty States):** Bloqueia tabelas vazias e orienta a criação da entidade pai.
3. **Criação "Just-in-Time":** Permite criar turmas dentro do fluxo de cadastro de alunos.
4. **CRUD Dinâmico e Soft Delete:** Oculta dados via `status: 'lixeira'`. Resgate via `/lixeira`.
5. **Memória de Navegação (Auto-Foco):** Pré-seleção da última turma ativa ou tarefa mais recente nos *dropdowns*.
6. **Global Utility Menu:** Alocado no canto superior direito para configurações privadas, resgate de lixeira e *logout*.
7. **Super Auto-Linker (Migração Silenciosa):** Nas listas de pendências da V3, o sistema normaliza agressivamente os nomes das tarefas (removendo espaços e maiúsculas). Se detectar uma tarefa órfã importada via cronograma da V1, ele a recria dinamicamente no banco e amarra o `tarefaId` correto sob o capô, prevenindo *links* quebrados (chutes para a *Home*) de forma 100% transparente ao usuário.

## 17. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Acesso rápido à criação de turmas, tarefas e alunos.
* **O "Espião" Inteligente (Onipresente):** Avalia a base de dados e injeta dinamicamente o sub-botão VIP **"Corrigir tarefa atual"** se houver uma tarefa ativa hoje.
