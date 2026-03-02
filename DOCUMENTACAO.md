# Documentação de Arquitetura - Feedback Mais Médicos
**Status:** Em Produção

1. Visão Geral
Sistema de dashboard para preceptores avaliarem e gerenciarem o feedback de alunos (focado no fluxo da UFPI/Mais Médicos).

2. O 'Botão de Pânico' (Regra Crítica de Negócio)
Devido a incidentes de custo ('abas zumbis' consumindo a cota do Firebase via onSnapshot), o sistema possui um Kill Switch ativo no App.jsx.

A cada 10 minutos, o frontend faz um getDoc no caminho /sistema/config.

Se o valor de versaoAtiva no banco for maior que a VERSAO_LOCAL_APP, o sistema dispara um window.location.reload(true).

É estritamente proibido adicionar novos onSnapshot no código sem aprovação explícita da arquitetura.

3. Idioma Padrão
Todas as mensagens de commit, descrições de Pull Requests e comentários no código devem ser escritos EXCLUSIVAMENTE em Português do Brasil (PT-BR).
