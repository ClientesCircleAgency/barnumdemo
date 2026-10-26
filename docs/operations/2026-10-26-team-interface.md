# Equipa da consulta — revisão de interface

Implementado no Workbench em 26 de outubro de 2026, após aprovação do desenho em conversa. Sem publicação remota e sem novas migrações.

- `AppointmentTeamList` apresenta cada profissional numa linha, precedido pela sua cor, com indicação do principal. Reutilizado nos detalhes, formulários, agenda, histórico, dashboard, estatísticas e sala de espera.
- Sugestões e reagendamento começam pela composição da equipa. O principal e os adicionais são preservados a partir do formulário de origem. Alterar a equipa limpa as opções selecionadas.
- O calendário serve para escolher a data; foram removidas as contagens mensais estimadas por médico. Os horários do dia são obtidos da validação do servidor e só aparecem quando todos estão disponíveis durante o intervalo completo. Falhas ou carregamento não expõem horários selecionáveis.
- Cada opção selecionada apresenta uma data/hora e a equipa completa. Antes de enviar, todas as opções são novamente validadas.
- O botão de conteúdo do cartão da sala de espera abre os detalhes. A pega de arrastar é separada e não abre o painel.
- Corrigida a codificação dos dados sintéticos existentes apenas na base local, após verificar ausência de triggers HTTP.

Validação: 64 testes frontend passaram; TypeScript passou. Testes novos cobrem cores e linhas, disponibilidade conjunta, envio da equipa, limpeza das seleções e separação entre clique e arrastar. Inspeção no navegador local confirmou abertura do painel e apresentação do reagendamento. Build concluído com os avisos habituais de tamanho de bundle/Browserslist. Lint sem erros; permanecem avisos do projeto.
