# Documentação de Arquitetura - Plataforma do Professor (SaaS V3)
**Status:** Produção ativa — Motor Gemini 3.1 + Aprendizado de Estilo Adaptativo + Suporte a Word

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

* **`usuarios`**: `uid`, `nome`, `email`, `whatsapp`, `role` (`'admin'` | `'professor'`), `plano`, `promptPersonalizado`, `promptAtivo`, `estiloAprendido`, `edicoesRecentes`, `edicoesPendentesAnalise`, `totalEdicoesIncorporadas`, `ultimaAtualizacaoEstilo`, `dataExpiracao`, `isVitalicio`, `historicoAssinatura`, `status` (`'ativo'` | `'bloqueado'`), `ultimoAcesso`, `emailVerificado`, `vistoPeloAdmin`.
* **`tarefas`:** Possuem **Atribuição Específica** (`atribuicaoEspecifica: boolean`, `alunosSelecionados: array`). Tarefas podem ser exclusivas para certos alunos, prevenindo cobranças indevidas. Sempre geram `dataInicio` na hora 00:00 e `dataFim` às 23:59.
* **`atividades` (Respostas e Notas):** `id`, `alunoId`, `turmaId`, `instituicaoId`, `tarefaId`, `resposta`, `status` (`'pendente'` | `'aprovado'`), `nota`, `feedbackSugerido`, `feedbackFinal`, `similaridadeIA` (0–100, calculado no momento da aprovação via Jaccard), `postado` (booleano), `dataAprovacao`, `dataPostagem`, `dataCriacao`, `arquivoUrl`, `nomeArquivo`.
* **Campos de Retrocompatibilidade V1/V3 (Estratégia Poliglota/Dupla Etiqueta):** Salva simultaneamente `nomeAluno` (V3) e `aluno` (V1), `nomeTarefa` (V3) e `tarefa`/`modulo` (V1), `revisadoPor` (nome do revisor).
* **Regra Crítica de Sincronia:** Em rascunhos (`status: 'pendente'`) ou ao devolver para revisão, o campo `dataAprovacao` deve ser fisicamente retirado do banco usando `deleteField()` do Firestore.
* **Regra de Validação de Entrega:** Uma atividade só é considerada "entregue/em revisão" se possuir texto no campo `resposta` **OU** um *link* de anexo no campo `arquivoUrl`.

## 6. Regras de Negócio e Gestão à Vista (Dashboard)
* **O Porteiro (Gatekeeper):** Se o professor não possuir uma instituição selecionada, o *Dashboard* exibe a interface de criação de Nível 1.
* **Atalho VIP de Ação Rápida:** A barra preta superior exibe tarefas **estritamente em andamento hoje**. Ícone de lápis para acesso direto à correção.
* **Gestão à Vista (Lista de Devedores):** Exibe nominalmente os alunos com pendências, cruzando tarefas ativas (hoje) e tarefas anteriores criadas a partir de um marco de corte temporal (`05/01/2026`).
* **A Esteira de Produção (Kanban Matemático Blindado):**
    * **Caixa 1: Aguardando Revisão (`/aguardandorevisao`):** Resposta colada ou arquivo anexado, mas *feedback* não aprovado.
    * **Caixa 2: Aguardando Postar (`/faltapostar`):** *Feedback* aprovado, mas `postado` é `false` (oculta para o Tier 2).
    * **Caixa 3: Histórico Finalizado (`/historico`):** `postado` é `true`. Ciclo encerrado.

### Painel de Inteligência Artificial (Dois Indicadores)
Visível para Tier Premium e Admin. Exibe dois cards lado a lado:

* **Termômetro de Autonomia da IA (card roxo):** Percentual de *feedbacks* gerados pela IA e aprovados **sem nenhuma edição** (`feedbackFinal.trim() === feedbackSugerido.trim()`). Avalia a partir do `timestampPrompt` do usuário — se o prompt for editado manualmente, a contagem é zerada. Mede o acerto absoluto da IA.

* **Aderência ao Estilo (card verde):** Média do campo `similaridadeIA` de todas as atividades aprovadas. Esse campo é calculado no momento da aprovação via **Similaridade de Jaccard** (comparação de palavras em comum entre `feedbackSugerido` e `feedbackFinal`), processada localmente no *frontend* com zero custo de token. Faixa de referência: 95–100% = idêntico; 75–94% = pequenos ajustes; 50–74% = reescrita parcial; abaixo de 50% = reescrita significativa. Este indicador cresce gradualmente à medida que o `promptAtivo` aprende com as edições da professora, permitindo visualizar a evolução do aprendizado mesmo quando o Termômetro de Autonomia ainda está em 0%.

## 7. Perfis de Acesso (RBAC SaaS) e Painel Admin
* **Segurança Clean Code:** Nenhuma verificação de autorização utiliza *hardcode* de *e-mails*. Toda validação de acesso é baseada unicamente no campo `role === 'admin'` proveniente do `AuthContext`.
* **Perfil Professor:** Só enxerga dados onde seu `uid` conste como criador.
* **Perfil Gestor (Admin):** Possui a **"chave mestra"**, ignorando a trava do `professorUid` para auditar a operação completa da instituição.
* **Painel SaaS (`/admin`):** Tela gerencial restrita. Permite:
    * Gestão visual de assinaturas (vencido, vitalício, ativo).
    * Ações de faturamento (estender dias, conceder/revogar vitalício, edição manual de datas).
    * Suspensão instantânea de acesso.
    * **Gestão de Engajamento:** Rastreio em tempo real com os status "Não ativou a conta" (campo `emailVerificado === false` — pessoa nunca clicou no link de confirmação do e-mail), "Nunca logou" (`emailVerificado === true` mas `ultimoAcesso` é nulo — confirmou o e-mail mas nunca entrou) ou a exata data de "Último acesso". O campo `emailVerificado` é atualizado a cada login via `user.emailVerified` do Firebase Auth. Motor de ordenação e filtros dinâmicos processados 100% no *frontend*.
    * Botão de Emergência (*Hard Delete*): apaga todos os rastros de um usuário no banco via `writeBatch`.
    * **Relatório de Log da IA:** Painel focado na comparação entre *feedbacks* originais gerados pela IA e *feedbacks* finais aprovados. Exibe apenas avaliações que sofreram edições.

## 8. Modelos de Operação (Tiers/Planos de Assinatura)
* **Tier 1: Básico ("O Organizador Pessoal"):** Focado na gestão visual e cobrança. Opera manualmente. A interface da IA atua como vitrine de vendas (cadeado 🔒), redirecionando para `/planos`.
* **Tier 2: Intermediário ("SaaS Assistido"):** Professor atua apenas como revisor. O botão "Lançar Oficialmente" é removido de sua tela. Blindagem física: usuário é impedido de acessar `/faltapostar` diretamente.
* **Tier 3: Premium ("O Lobo Solitário Turbo"):** Automação completa com IA Gemini. Inclui `promptPersonalizado` nas configurações e acesso ao sistema de **Aprendizado de Estilo Adaptativo**.

## 9. A Estação de Correção — Fluxo, IA e Aprendizado Adaptativo
A página de Revisar Atividade (`/revisar/id`) é o *HUB* principal do sistema.

* **Barra de Progresso (UX):** Exibe os 3 passos: `1. Resposta do Aluno` ➔ `2. Área de Feedback` ➔ `3. Pronto p/ Postar`.
* **Semáforo de Alunos:** 🔴 Sem resposta / 🟡 Em revisão ou aprovado aguardando postagem / ✅ Lançado oficialmente.

### Upload e Leitura de Arquivos
O botão **"Anexar PDF/DOC"** aceita múltiplos formatos. A estratégia de leitura varia por tipo:

* **PDF:** Extraído via `pdfjs-dist` diretamente no *browser*. O texto é injetado no prompt da IA.
* **.docx (Word moderno):** Extraído via biblioteca `mammoth` no *browser* no momento do upload, sem necessidade de conversão pelo professor. O texto é guardado em `textoExtraidoDoc` e injetado no prompt da IA da mesma forma que o PDF. Um banner verde confirma "✅ Texto do Word extraído com sucesso".
* **.doc / .rtf (Word legado, formato binário):** Não são legíveis no *browser*. O sistema exibe um aviso laranja explicando o problema com instruções passo a passo e um botão direto para o **iLovePDF Word→PDF** (`https://www.ilovepdf.com/pt/word_para_pdf`).
* **Trava de Custo (5MB):** Validação no *frontend* bloqueia arquivos acima de 5MB.
* **Link iLovePDF Comprimir:** Atalho para redução de PDFs grandes.

### Sistema de Aprendizado de Estilo Adaptativo (Tier Premium e Intermediário)
O sistema aprende com as edições da professora e evolui o prompt da IA automaticamente, eliminando contradições entre o que ela escreveu e o que ela realmente aprova na prática.

**Três campos no documento `/usuarios/{uid}`:**

| Campo | Papel |
|---|---|
| `promptPersonalizado` | O que a professora escreveu à mão nas Configurações — âncora permanente, nunca alterado automaticamente |
| `estiloAprendido` | Documento vivo de até 300 palavras com padrões detectados nas edições (tom, estrutura, expressões preferidas/evitadas, comprimento) |
| `promptAtivo` | O que a IA **realmente usa** — fusão coerente e sem contradições dos dois campos acima, gerada automaticamente a cada ciclo de aprendizado |

**Fluxo de aprendizado (custo controlado):**

1. Quando a professora aprova um *feedback* com edição real (texto diferente do sugerido pela IA), o sistema acumula silenciosamente o par `{feedbackSugerido, feedbackFinal}` no campo `edicoesRecentes`.
2. Ao acumular **3 edições**, dispara-se uma sequência de **2 chamadas à IA em background** (invisível para o usuário, ~1.500 tokens no total):
   * **Chamada 1:** Analisa os 3 pares e atualiza o `estiloAprendido` (máximo 300 palavras em *bullet points*).
   * **Chamada 2:** Funde o `promptPersonalizado` com o `estiloAprendido` num único `promptAtivo` coerente (máximo 400 palavras). Em caso de contradição entre os dois, o `estiloAprendido` tem prioridade — ele reflete o comportamento real da professora.
3. O campo `edicoesRecentes` é zerado e o ciclo recomeça.
4. **Se a professora aprovar sem editar** (caso "✨ 100% IA"), zero tokens extras são consumidos.
5. **Se a professora editar o prompt manualmente nas Configurações**, o `promptAtivo` é zerado automaticamente. Será regenerado na próxima destilação, incorporando as novas instruções manuais junto com o estilo já aprendido.

**Badge visual na Estação de Correção (abaixo do botão "Gerar Feedback IA"):**
* ⚫ Cinza: "IA usando instruções base · X edições p/ otimizar"
* 🟣 Roxo pulsando: "Atualizando instruções da IA..."
* 🟢 Verde: "Instruções otimizadas ativas · X edições incorporadas"

**Cálculo de Similaridade Jaccard (zero custo de token):**
No momento de cada aprovação, o sistema calcula localmente a similaridade entre o texto sugerido e o aprovado usando a fórmula `intersecção ÷ união` de palavras únicas tokenizadas. O resultado (0–100) é salvo no campo `similaridadeIA` da atividade e alimenta o card "Aderência ao Estilo" no Dashboard.

**O ciclo virtuoso:** `promptAtivo` melhora → IA gera textos mais alinhados → Aderência ao Estilo sobe no Dashboard → professora edita menos → Termômetro de Autonomia sobe → menos destilações necessárias.

## 10. Gestão de Tarefas e Cronograma
* **Ordenação Inteligente por Status:** As tarefas são exibidas sempre na ordem: **Em andamento** primeiro, depois **Em breve**, depois **Encerradas**. Dentro de cada grupo, ordenadas por data de fim crescente. Isso garante que tarefas futuras com prazo de encerramento anterior ao de uma tarefa ativa nunca apareçam indevidamente no topo da lista.
* **Enunciado Colapsável:** Enunciados com mais de 200 caracteres são exibidos com apenas 3 linhas visíveis e reticências automáticas (`line-clamp-3`). Um botão **"▼ Ver enunciado completo"** expande o texto individualmente por card, sem afetar os demais. Isso mantém a página de Tarefas como guia visual rápido, sem scroll excessivo.
* **Correção Antecipada (Tarefas Futuras):** O botão de correção agora aparece também para tarefas com status **"Em breve"**, com visual diferenciado (cinza) e texto **"Corrigir Antecipado"**. Isso permite ao professor lançar respostas que os alunos já enviaram antes da abertura oficial do período, sem impacto nas páginas de Pendências, Comunicação ou Gestão à Vista (que continuam filtrando apenas tarefas ativas).
* **Atribuição Específica e Guardrails Visuais:** O sistema permite tarefas restritas a um grupo seleto de alunos, com avisos educativos contextuais (azul para turma completa, âmbar para alunos específicos).
* **Motor de Clonagem:** Professores podem "Criar Turma a partir de Modelo", replicando 100% das tarefas e enunciados de uma turma *master*, sem copiar os alunos.

## 11. Módulo de Comunicação e Cobrança
Automatização de cobranças baseada no cruzamento de alunos *versus* tarefas pendentes, protegida por **Filtro Temporal V3** e **Trava de Atribuição**.

### Inteligência de Urgência e Prazos
O algoritmo calcula qual tarefa pendente está mais perto de vencer e adapta o tom da mensagem:

| Dias restantes | Tom da mensagem |
|---|---|
| Prazo encerrado (< 0) | Cobrança direta de tarefa vencida |
| **Hoje (= 0)** | **"vence HOJE"** |
| **Amanhã (= 1)** | **"vence AMANHÃ"** |
| Reta final (2–7 dias) | Senso de urgência elevado |
| Fase intermediária (8–19 dias) | Lembrete regular |
| Prazo folgado (≥ 20 dias) | Tom informativo |

**Nota:** Os casos "0 dias" e "1 dia" recebem tratamento explícito para evitar a geração de textos sem sentido como "vence em 0 dias". As mensagens são geradas em 4 variantes (coletiva/individual × todas as tarefas/tarefa específica), todas cobertas pela correção.

### Ações de Disparo
* **Grupo Geral da Turma:** Mensagens contextuais dinâmicas prontas para copiar para o grupo.
* **Copiar para a Plataforma:** Textos individuais com primeiro nome do aluno para colagem em sistemas oficiais (ex.: Gov.br).
* **Zap Direto:** Abre *link* `wa.me` com filtro curinga de telefone (`whatsapp`, `telefone` ou `celular`).

## 12. Mapa de Entregas e Pendências
* **Mapa de Entregas:** Tabela dinâmica com ícones (✅ Entregue, ❌ Pendente, ⚪ Isento). Possui Cortina de Tempo V3 controlada via *toggle*.
* **Relatório de Pendências:** Organiza inadimplência cruzando devedores reais e tarefas ativas da V3. Possui atalho de redirecionamento focado (`alunoAlvo`) para a página de Comunicação.

## 13. Gestão de Alunos e Matrículas
* **Matrícula Vapt-Vupt:** Modal de cadastro único que, ao salvar, limpa os campos e devolve o foco ao primeiro *input*.
* **Importador Mágico (Lote):** Importação via "copiar e colar" com proteção contra duplicidade em tempo real.

## 14. Padrões de Usabilidade e Navegação
1. **Teletransporte Contextual:** *Links* que carregam a Estação de Correção enviando o `alunoId` via `location.state`.
2. **Estado Vazio Educativo:** Bloqueia tabelas vazias e orienta a criação da entidade pai.
3. **CRUD Dinâmico e Soft Delete:** Oculta dados via `status: 'lixeira'`. Resgate via `/lixeira`.
4. **Memória de Navegação:** Pré-seleção da última turma ativa nos *dropdowns*.
5. **Global Utility Menu:** Canto superior direito para configurações, lixeira e *logout*.
6. **Super Auto-Linker (Migração Silenciosa):** Normaliza nomes de tarefas e reconecta tarefas órfãs importadas da V1 de forma transparente.

## 15. Acelerador de Fluxo: Botão Global (FAB)
* **Atalho Flutuante:** Acesso rápido à criação de turmas, tarefas e alunos.
* **O "Espião" Inteligente:** Injeta dinamicamente o sub-botão VIP "Corrigir tarefa atual" se houver uma tarefa ativa hoje.

## 16. Dependências Externas (npm)
Além das dependências de base (React, Firebase, Tailwind, Vite), o sistema utiliza:

| Pacote | Versão | Uso |
|---|---|---|
| `pdfjs-dist` | ^4.4.168 | Extração de texto de PDFs no *browser* |
| `mammoth` | ^1.8.0 | Extração de texto de arquivos `.docx` no *browser* |
| `@google/genai` | latest | Integração com Gemini (geração de *feedback* e aprendizado de estilo) |
| `lucide-react` | ^0.428.0 | Ícones |
| `react-router-dom` | ^6.26.1 | Roteamento |
| `@emailjs/browser` | ^4.3.3 | Disparo de e-mail de alerta no cadastro de novos professores |
