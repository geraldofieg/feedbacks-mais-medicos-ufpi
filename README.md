​🩺 Sistema de Gerenciamento de Feedbacks - Mais Médicos UFPI
​1. Visão Geral do Sistema
​Aplicativo web desenvolvido para otimizar o fluxo de recebimento, revisão e aprovação de feedbacks das atividades dos alunos (médicos residentes) do programa Mais Médicos pela UFPI. O sistema funciona como um funil de produção inteligente (Workflow em 3 Fases), separando as tarefas da professora avaliadora e do gestor que faz a postagem no sistema oficial do governo.
​2. Tecnologias Utilizadas (Stack)
​Front-end: React (com Vite)
​Roteamento: React Router Dom
​Estilização: Tailwind CSS
​Ícones: Lucide React
​Back-end & Banco de Dados: Google Firebase (Firestore)
​Armazenamento de Arquivos: Firebase Storage
​Autenticação: Firebase Auth (E-mail e Senha)
​Hospedagem: Vercel (CI/CD integrado com o GitHub)
​3. Configuração do Back-end (Firebase)
​A. Bancos de Dados (Firestore)
​O banco de dados é NoSQL e possui 4 coleções principais:
​alunos: Guarda os nomes dos médicos em formação. (Campos: nome)
​modulos: Guarda os módulos do curso. (Campos: nome)
​tarefas: Guarda as tarefas/atividades de cada módulo. (Campos: nome)
​atividades: O coração do sistema. Guarda as submissões.
​Campos: aluno, modulo, tarefa, enunciado (texto), urlEnunciado (link do arquivo), resposta (texto), urlResposta (link do arquivo), feedbackSugerido, feedbackFinal, status ('pendente' ou 'aprovado'), postado (Booleano: true/false), dataCriacao, dataAprovacao.
​B. Armazenamento de Arquivos (Storage)
​Configurado no plano Blaze (pago por uso, mas contendo os limites da camada gratuita).
​Automação (Ciclo de Vida): Configurada via Google Cloud. Os arquivos (PDFs/Imagens) são excluídos automaticamente após 40 dias da criação, garantindo que o armazenamento nunca ultrapasse a cota gratuita de 5GB.
​4. Estrutura de Arquivos e Código
​O sistema está organizado dentro da pasta src/, com a seguinte hierarquia:
​📁 src/pages/ (Telas do Sistema)
​Login.jsx: Tela de entrada com e-mail e senha.
​Dashboard.jsx: Painel inicial atuando como Funil de 3 Etapas (Aguardando Revisão, Aguardando Postar e Histórico Finalizado). Possui contadores em tempo real.
​NovaAtividade.jsx: Formulário de submissão. Permite envio de textos e upload de arquivos. Possui função de Autofill: se o módulo e tarefa já tiverem sido cadastrados para outro aluno, o sistema preenche o enunciado e o anexo automaticamente.
​ListaAtividades.jsx: Renderiza a lista de cards de atividades, filtrando dinamicamente a URL para mostrar qual caixa do funil o usuário acessou.
​RevisarAtividade.jsx: Tela de ação com comportamento dinâmico:
​Pendente: Permite avaliar, editar e aprovar.
​Aprovada (Falta Postar): Permite copiar o feedback e possui o botão "Marcar como Postado".
​Finalizada: Visualização de arquivo morto com selo de conclusão.
​(Permite baixar arquivos e excluir atividades em qualquer etapa).
​Pendencias.jsx: Relatório inteligente que cruza as tarefas cadastradas com a base de alunos e dedura imediatamente quem ainda não entregou a atividade.
​MapaEntregas.jsx: Matriz de acompanhamento individual por tarefa.
​Configuracoes.jsx e Alunos.jsx: Telas de gestão de cadastros básicos.
​5. Fluxo de Trabalho Diário (O Funil Perfeito)
​Alimentação (Gestor): O Gestor entra em Nova Atividade e insere a resposta do aluno junto com a proposta de feedback gerada por IA.
​Fase 1 - Revisão (Professora Patrícia): A professora clica na caixa amarela (Aguardando Revisão), lê a atividade, ajusta o feedback se necessário e clica em Aprovar. O card sai da caixa amarela e vai para a azul.
​Fase 2 - Postagem (Gestor Geraldo): O gestor clica na caixa azul (Aguardando Postar). Ele entra no aluno, clica em Copiar Feedback e cola o texto no site oficial do Mais Médicos.
​Fase 3 - Finalização: O gestor clica no botão Marcar como Postado no Site. O sistema encerra o ciclo, jogando o aluno para a caixa verde (Histórico Finalizado).
​Cobrança: O gestor acessa o botão Pendências para ver a lista vermelha de alunos que ainda precisam enviar suas tarefas, agrupada por módulo.
​6. Como restaurar o projeto do Zero (Backup Guide)
​Caso precise recriar este projeto do zero no futuro, siga esta ordem:
​Instale o React com Vite: npm create vite@latest feedbacks -- --template react
​Instale as dependências: npm install firebase react-router-dom lucide-react
​Configure o Tailwind CSS (siga a documentação oficial para Vite).
​Crie a mesma estrutura de pastas (/services, /contexts, /pages).
​Cole o conteúdo salvo de cada arquivo .jsx.
​Rode npm run dev para testar e faça o deploy (ex: Vercel).
