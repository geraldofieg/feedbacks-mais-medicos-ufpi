🩺 Sistema de Gestão de Feedbacks - Mais Médicos UFPI
1. Visão Geral do Sistema
Aplicação web desenvolvida para otimizar o fluxo de receção, revisão e aprovação de feedbacks das atividades dos alunos (médicos residentes) do programa Mais Médicos pela UFPI. O sistema funciona como um funil de produção inteligente (Workflow em 3 Fases), com separação de perfis de acesso, métricas de eficiência de Inteligência Artificial e sistema de segurança contra falhas humanas.

2. Tecnologias Utilizadas (Stack)
Front-end: React (com Vite)

Roteamento: React Router Dom

Estilização: Tailwind CSS

Ícones: Lucide React

Back-end & Base de Dados: Google Firebase (Firestore)

Armazenamento de Ficheiros: Firebase Storage

Autenticação: Firebase Auth (E-mail e Senha)

Alojamento (Deploy): Vercel (CI/CD integrado com o GitHub)

3. Estrutura de Perfis (RBAC - Role-Based Access Control)
O sistema possui ecrãs blindados que se adaptam de acordo com o e-mail de quem faz o login, garantindo segurança e foco:

👩‍⚕️ Perfil Professora (Avaliadora): Interface minimalista. Tem acesso apenas à caixa de "Aguardando Revisão" e ao "Histórico Finalizado". Não vê botões operacionais perigosos, configurações ou gestão de alunos, focando 100% na leitura e aprovação de textos.

👨‍💼 Perfil Gestor (Administrador): Visão total do sistema. Tem acesso exclusivo à fila intermediária de "Aguardando Postar", botões de envio para o site oficial, gestão de alunos, configurações e ferramentas de reversão (desfazer ações).

4. O Funil de Trabalho (Workflow)
O processo de trabalho diário flui através de 3 caixas principais:

🟡 Aguardando Revisão (Fase 1): O Gestor submete o trabalho do aluno com uma sugestão de feedback gerada por IA. A Professora lê, edita (se necessário) e aprova.

🔵 Aguardando Postar (Fase 2 - Exclusivo Gestor): O feedback aprovado cai nesta fila. O Gestor copia o texto, cola no site oficial do Governo/UFPI e clica em "Marcar como Postado".

🟢 Histórico Finalizado (Fase 3): Arquivo morto com as atividades concluídas e duplamente carimbadas.

5. Funcionalidades de Destaque
🤖 Termómetro da IA: Um painel analítico que calcula, em tempo real, a percentagem de feedbacks gerados pela Inteligência Artificial que foram aprovados pela professora sem nenhuma alteração. Inclui selos visuais em cada atividade indicando se o texto foi "✨ 100% IA" ou "✏️ Editado".

⏱️ Duplo Carimbo de Tempo: A base de dados regista automaticamente o momento exato em que a professora aprovou (dataAprovacao) e o momento exato em que o gestor publicou a nota no site oficial (dataPostagem).

⏪ Sistema de Reversão (Marcha-Atrás): Painel de segurança que permite ao Gestor desfazer cliques acidentais, devolvendo uma atividade já publicada para a fila de "Falta Postar", ou devolvendo um texto aprovado para a caixa de "Revisão" da professora.

🪄 Autofill Inteligente: Ao submeter uma nova atividade, o sistema memoriza enunciados e anexos baseados no módulo e na tarefa, preenchendo o formulário automaticamente para os próximos alunos.

🚨 Relatório de Pendências: Cruza a lista de alunos com as atividades entregues e dedura automaticamente quem está em falta.

6. Configuração do Back-end (Firebase)
A. Base de Dados (Firestore)
Coleções principais:

alunos: Nomes dos médicos em formação.

modulos: Nomes dos módulos do curso.

tarefas: Nome das tarefas de cada módulo.

atividades: O motor do sistema. Guarda as submissões, URLs de PDFs/Imagens, textos, e os status (pendente, aprovado, postado, dataAprovacao, dataPostagem).

B. Armazenamento (Storage)
Configurado no plano Blaze.

Automação (Ciclo de Vida): Os anexos (PDFs/Imagens) são eliminados automaticamente após 40 dias pelo Google Cloud, garantindo a gestão de espaço.

CORS: O balde (bucket) .firebasestorage.app está configurado para aceitar uploads diretamente dos domínios da Vercel.

7. Estrutura de Ecrãs (src/pages/)
Login.jsx: Entrada segura.

Dashboard.jsx: Painel inicial inteligente que se adapta ao perfil logado e exibe o Termómetro da IA.

NovaAtividade.jsx: Formulário com sistema de Autofill.

ListaAtividades.jsx: Lista os alunos com base na fase do funil, exibindo carimbos de tempo dinâmicos.

RevisarAtividade.jsx: Ecrã de ação com bloqueios de segurança (esconde botões de postagem/reversão se não for o Administrador).

Pendencias.jsx: Relatório de alunos em dívida.

MapaEntregas.jsx: Matriz de acompanhamento por tarefa.

Configuracoes.jsx e Alunos.jsx: Gestão da base de dados.

8. Guia de Restauro (Backup)
Caso precise de recriar este projeto do zero:

Instale o React com Vite: npm create vite@latest feedbacks -- --template react

Instale dependências: npm install firebase react-router-dom lucide-react

Configure o Tailwind CSS.

Crie a estrutura de pastas (/services, /contexts, /pages).

Cole o conteúdo guardado de cada ficheiro .jsx.

Configure as regras de CORS no Google Cloud Shell.

Faça o deploy (ex: Vercel).
