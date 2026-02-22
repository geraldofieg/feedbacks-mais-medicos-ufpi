​🩺 Sistema de Gerenciamento de Feedbacks - Mais Médicos UFPI
​1. Visão Geral do Sistema
​Aplicativo web desenvolvido para otimizar o fluxo de recebimento, revisão e aprovação de feedbacks das atividades dos alunos (médicos residentes) do programa Mais Médicos pela UFPI. O sistema permite o cadastro de atividades com anexos, aprovação com edição de texto e painel de controle gerencial.
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
​Campos: aluno, modulo, tarefa, enunciado (texto), urlEnunciado (link do arquivo), resposta (texto), urlResposta (link do arquivo), feedbackSugerido, feedbackFinal, status ('pendente' ou 'aprovado'), dataCriacao, dataAprovacao.
​B. Armazenamento de Arquivos (Storage)
​Configurado no plano Blaze (pago por uso, mas contendo os limites da camada gratuita).
​Regras de Segurança: Acesso de leitura e escrita liberado (autenticação controlada via front-end).
​Automação (Ciclo de Vida): Configurada via Google Cloud (console.cloud.google.com). Os arquivos são excluídos automaticamente após 40 dias da criação, garantindo que o armazenamento nunca ultrapasse a cota gratuita de 5GB.
​4. Estrutura de Arquivos e Código
​O sistema está organizado dentro da pasta src/, com a seguinte hierarquia:
​📁 src/services/
​firebase.js: Contém as chaves da API do Google e a inicialização dos serviços (Auth, Firestore e Storage). É a ponte entre o site e o banco.
​📁 src/contexts/
​AuthContext.jsx: Gerencia a "sessão" do usuário. Verifica se há alguém logado, protege as páginas para que não sejam acessadas por links diretos e gerencia a função de Logout.
​📁 src/pages/ (Telas do Sistema)
​Login.jsx: Tela de entrada com e-mail e senha.
​Dashboard.jsx: Painel inicial. Mostra a data da última sincronização, contadores em tempo real (Pendentes/Aprovados) e botões de navegação.
​Configuracoes.jsx: Tela para cadastrar, listar e excluir Módulos e Tarefas.
​Alunos.jsx: Tela para cadastrar, listar e excluir os Alunos.
​NovaAtividade.jsx: Formulário de submissão. Permite envio de textos e upload de arquivos (PDF/Imagens) diretamente para o Firebase Storage.
​ListaAtividades.jsx: Renderiza a lista de cards de atividades, filtrando dinamicamente por "Pendentes" ou "Aprovados" baseado na URL.
​RevisarAtividade.jsx: Tela de ação.
​Se pendente: Permite baixar arquivos anexos, editar o feedback sugerido e aprovar.
​Se aprovada: Mostra o texto finalizado, permite copiar para a área de transferência com 1 clique e permite exclusão do registro.
​MapaEntregas.jsx: Matriz de acompanhamento. O usuário seleciona Módulo + Tarefa e o sistema cruza com a lista de alunos, mostrando quem já entregou (Aprovado/Pendente) e quem está devendo (Não Entregue).
​📄 src/App.jsx
​O arquivo mestre de roteamento. Define todas as URLs do sistema (/, /login, /nova-atividade, etc.) e envelopa as rotas sensíveis com o componente <PrivateRoute>, garantindo total segurança.
​5. Fluxo de Trabalho (Workflow da Rotina)
​Configuração Inicial: O Administrador cadastra Módulos, Tarefas e Alunos nas configurações.
​Alimentação: O Administrador entra em Nova Atividade, seleciona os filtros, cola os textos ou anexa os arquivos vindos do site do Governo, digita um feedback base e salva.
​Revisão: A Professora (Patrícia) faz login, clica no card amarelo (Aguardando Revisão), lê os textos ou clica para ver os PDFs no celular.
​Aprovação: A Professora edita o feedback (se necessário) e clica em Aprovar.
​Finalização: O Administrador entra nos Aprovados, clica em Copiar Feedback e leva a nota definitiva para o sistema do Governo. O arquivo anexo se autodestrói 40 dias depois para poupar espaço do servidor.
​Auditoria: A qualquer momento, acessa-se o Mapa de Entregas para ver pendências da turma.
​6. Como restaurar o projeto do Zero (Backup Guide)
​Caso precise recriar este projeto do zero no futuro, siga esta ordem de comandos no terminal:
​Instale o React com Vite: npm create vite@latest feedbacks -- --template react
​Entre na pasta: cd feedbacks
​Instale as dependências essenciais: npm install firebase react-router-dom lucide-react
​Configure o Tailwind CSS (siga a documentação do Tailwind para Vite).
​Crie a mesma estrutura de pastas detalhada acima.
​Cole o conteúdo salvo de cada arquivo .jsx.
​Rode npm run dev para testar localmente.
​Envie para o GitHub e importe no painel da Vercel para colocar no ar.
​(Fim da cópia)
