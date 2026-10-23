# Especialidade no formulário e remoção de rejeição manual

## Âmbito pedido

- Tornar explícito que os cartões do formulário público selecionam uma especialidade.
- Retirar Rejeitar após estudar os efeitos da sua ausência.
- Contactos e nomes de profissionais nas notificações ficam a cargo do Samuel.
- Consultas com vários médicos e nova role de acesso ficam para o próximo plano.

## Análise de Rejeitar

`RequestsPage.handleReject` chamava `useUpdateAppointmentRequestStatus` para gravar
`status = rejected` e `rejection_reason`. O contrato n8n documenta a transição
`pending -> rejected` como origem da notificação de rejeição (AUT-4).
Confirmar usa a conversão por RPC; sugerir alternativas usa uma mutation própria.
Nenhuma das duas ações depende do botão ou do diálogo de rejeição.

Foram removidos o botão, diálogo, estado local e handler de rejeição da página.
Deixa de ser possível encerrar um pedido por rejeição manual nesta interface e,
por esta via, deixa de ser originada a notificação de rejeição. Não foi introduzido
um arquivamento substituto. A definição do estado na BD, motivos históricos,
webhooks e automações externas foram preservados. O estado real dos workflows
n8n não foi auditado nem alterado nesta tarefa.

## Formulário público

O campo chama-se Especialidade e inclui uma instrução de seleção. Cada cartão
mostra Selecionar ou Selecionada, com confirmação visual, foco de teclado e
`aria-pressed`. Os identificadores enviados à base de dados mantêm-se.

## Verificação

50 testes passaram, incluindo seleção por rato/teclado, confirmação de pedido,
envio de alternativas sem rejeição e leitura do motivo de rejeições históricas.
