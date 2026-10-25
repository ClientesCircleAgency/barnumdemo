# Consultas com v?rios profissionais ? valida??o local

Estado: implementado em `workbench/barnun`; sem merge no projeto de entrega e sem publica??o remota.

## Comportamento

Uma consulta conserva um profissional principal e uma lista de adicionais. Reserva todo o intervalo para todos, aparece em cada agenda e uma ?nica vez no hist?rico/contagens globais. As regras de especialidade, tipo, hor?rio, f?rias e conflitos s?o verificadas no servidor. M?dicos associados, secret?rias e administradores podem concluir e adicionar notas com autoria; apenas secret?rias/admins alteram a equipa, reagendam ou cancelam. Mantida a cria??o individual anterior pelos m?dicos.

As reservas s?o at?micas e bloqueiam os profissionais em ordem est?vel. Edi??es usam a vers?o capturada ao abrir o formul?rio. Alternativas guardam a equipa e a confirma??o recupera-a. Retirar um m?dico revoga o acesso ? consulta partilhada. Desligar um colaborador marca o profissional inativo sem apagar o hist?rico. Profissionais legados j? desligados antes desta migra??o n?o podem ser classificados automaticamente: requerem revis?o de atividade antes da publica??o.

Horas civis inexistentes ou amb?guas de Europe/Lisbon s?o recusadas, pois o modelo n?o guarda um offset que permita desambiguar.

## Contrato de integra??o

- Manter `appointments.professional_id` como principal; adicionais em `appointment_additional_professionals`.
- Cada op??o em `suggested_slots`/`accepted_slot` deve conservar `date`, `time`, `professional_id`, `additional_professional_ids`, `consultation_type_id` e dura??o.
- `convert_request_to_appointment_with_team` aceita a lista adicional; a RPC antiga continua dispon?vel. A convers?o usa `source_request_id` ?nico para idempot?ncia.
- Reservar/editar atrav?s de `save_appointment_team`; concluir atrav?s de `set_appointment_state`. N?o escrever diretamente na rela??o de participantes.
- O n8n deve processar eventos pela consulta, n?o por participante. Entrega e deduplica??o externa ainda n?o foram verificadas ponta a ponta.

## Evid?ncia

- Suite frontend: 61 testes em 12 ficheiros passaram; testes de modelos, disponibilidade, cria??o, pedido aceite com equipa, apresenta??o na agenda e vers?o preservada ap?s atualiza??o em tempo real.
- SQL: 38 verifica??es em cinco ficheiros, incluindo permiss?es, rollback, conflitos, vers?es, colaboradores desligados e transi??es de hora.
- Concorr?ncia real: duas transa??es, apenas uma reserva aceite quando partilham um m?dico.
- Duas sess?es autenticadas: leitura partilhada, nota com autoria, revoga??o, conclus?o e evento Realtime passaram.
- TypeScript e build executados; build mant?m avisos de tamanho de bundle/Browserslist. Lint sem erros e com 35 avisos.
- Arranque do Workbench existente verificado. Reconstru??o integral de uma inst?ncia vazia com o novo baseline ainda n?o executada.
- Revis?o independente identificou cinco problemas: isolamento HTTP, vers?o no reagendamento, adicionais da op??o aceite, inatividade persistente e mudan?a de hora. Todos receberam corre??es locais; n?o houve segunda revis?o independente.

## Incidente de isolamento durante os testes

O baseline exportado continha dois triggers HTTP para n8n externo. A primeira dete??o n?o reconhecia identificadores SQL entre aspas. Os triggers foram importados na base local e testes sint?ticos anteriores produziram quatro respostas HTTP 200, conforme `net._http_response`. N?o est? confirmado o efeito nos workflows nem o envio de mensagens. N?o foram copiadas linhas de pacientes de produ??o para o Workbench.

Os dois triggers foram removidos da inst?ncia local e do baseline. Confirmado zero triggers HTTP. O bootstrap e ambos os testes de integra??o recusam executar quando detetam webhooks externos. N?o foi alterada a base remota nem a configura??o do n8n. Antes de publicar: verificar as quatro execu??es no n8n e validar mensagens com Samuel, com dados de teste controlados.

## Utiliza??o e publica??o

Executar `powershell -ExecutionPolicy Bypass -File scripts/Initialize-Workbench.ps1`, depois `npm run dev`. O endpoint de desenvolvimento ? exclusivamente `http://127.0.0.1:46321`; `.env.development.local` fica ignorado no Git.

Executar `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, `npm run lint`, `supabase test db --local`, `node scripts/test-appointment-team-concurrency.mjs` e `node scripts/test-appointment-team-realtime.mjs`.

A publica??o deve coordenar as cinco migra??es 20261024, frontend, fun??o delete-collaborator e contrato n8n. N?o executar o baseline local em produ??o. A branch remota dev publica automaticamente: nenhum push foi feito nesta entrega.
