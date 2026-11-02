# Tratamentos — contrato e validações para o agente do Samuel

Data: 02/11/2026. Tratamentos implementados e testados **apenas no Workbench/Docker**. Automações n8n ficam sob responsabilidade do Samuel, por indicação do utilizador. Este documento não é uma instrução para alterar workflows sem rever o estado atual.

## Estado separado das entregas

As cinco correções de segurança/consistência já foram publicadas na aplicação e BD (`dev` 6983eb4; migração `20261027151407_samuel_followup_safety`). Tratamentos, descritos abaixo, **ainda não**.

O documento `last 2 2026-10-27-tratamentos-respostas-n8n.md` foi recebido. É a fonte do contrato A1/A2/A6/A47/A8 usado nesta análise, não uma inspeção em tempo real dos workflows.

## Migrações de Tratamentos

1. `20261027042724_treatments_schema.sql`: planos, equipas, etapas, estados e RLS.
2. `20261027042857_treatment_booking.sql`: marcação atómica em lote; ligação a consulta existente; proteção paciente/especialidade.
3. `20261027043038_treatment_clinical_records.sql`: comentários por etapa, observações internas e revisões; conclusão transacional.
4. `20261102143030_treatment_booking_time_safety.sql`: rejeita novas reservas no passado em Europe/Lisbon; serializa pelo paciente e verifica colisões.
5. `20261102200619_treatment_concurrency_guards.sql`: participação verificada após locks; proteção partilhada de reservas de tratamento contra inserção/reagendamento avulso concorrente.

Sem backfill de appointments, sem colunas clínicas novas em appointments/appointment_requests, sem mudança das assinaturas de `save_appointment_team` ou `set_appointment_state`, sem novos webhooks externos.

## Contratos utilizados pela aplicação

- `book_treatment_sessions(p_treatment_id uuid, p_slots jsonb)`: slots `{session_id,expected_version,date,time}`. Um appointment `confirmed` por etapa, equipa/tipo/duração completos via `save_appointment_team`. Resultado `[{session_id,appointment_id}]`. Repetição idêntica não duplica; divergente rejeita. Falha em qualquer etapa reverte todo o lote.
- `link_treatment_appointment(p_session_id uuid,p_expected_version bigint,p_appointment_id uuid)`: vincula uma consulta ao tratamento sem modificar appointments. Um appointment só pertence a uma etapa.
- `finalize_appointment_with_observation(p_appointment_id uuid,p_expected_version bigint,p_final_notes text,p_send_review boolean,p_internal_observation text)`: guarda texto interno em `appointment_clinical_observations` e chama a função de estados existente na mesma transação. A repetição de conclusão já aplicada não duplica observação/evento.
- `save_treatment_comment` / `save_clinical_observation`: apenas tabelas internas, com autor e revisões. Nunca copiam texto para notes/reason/final_notes.

O n8n atual não precisa de chamar estas novas RPCs para continuar a converter pedidos. PATCH `status=converted` + `accepted_slot` mantém o contrato existente. Não existe menu WhatsApp de tratamentos nesta versão.

## Eventos e impacto

| Ação | Evento externo esperado |
|---|---|
| Criar/editar plano ou etapa, comentar, rever texto, omitir, encerrar/reabrir | Nenhum evento appointments/requests |
| Ligar consulta existente | Nenhum UPDATE appointments |
| Reservar N etapas | N INSERT appointments; N confirmações são o comportamento esperado de A1 |
| Concluir consulta | UPDATE habitual; final_notes público, send_review e finalized_at preservados segundo contrato |
| Reagendar/equipa | UPDATE habitual; A1 pode classificar alteração de equipa como reagendamento |

Medição local capturou as linhas inteiras de appointments: nenhum marcador de comentário/observação interna apareceu. A conclusão produz um UPDATE; retry não acrescenta evento. Isto não prova o comportamento de logs/nodes externos que consultem outras tabelas.

### Novas rejeições que podem ser observadas pelo n8n

- `patient_unavailable` (SQLSTATE 23514): criar/reagendar consulta avulsa que colida com uma consulta ativa ligada a tratamento. Também protege concorrência. A política entre duas consultas avulsas mantém-se. A1 não recebe evento de uma escrita rejeitada.
- `patient_or_specialty_mismatch`: alteração de paciente/especialidade incompatível com um tratamento já ligado.
- `session_in_past` e `session_unavailable`: marcação de etapas pela aplicação; não são novos caminhos da conversão WhatsApp.

**Validar no A8:** se o PATCH de conversão encontrar uma reserva de tratamento incompatível, a transação falha. O workflow deve tratar a resposta como conflito e não enviar confirmação de sucesso. Não insistir em retries cegos nem desligar o guard. Nenhum node foi alterado deste lado.

## Notas ao paciente e avaliação

Segundo o contrato recebido, A6 seleciona completed + send_review=true, 2–3 horas após finalized_at, e envia notas e link em conjunto. Com send_review=false, as notas ficam guardadas e presentes no payload, mas essa automação não as envia. Não foi identificado no documento um agradecimento autónomo de conclusão.

A interface foi corrigida para não dizer “enviado” sem prova. Envio independente de notas, mensagens de agradecimento, deduplicação persistente e recuperação de mensagens continuam do lado do Samuel. Não introduzimos agendadores/outbox nem alterámos defaults de review por tratamento.

## Verificações externas antes de publicar Tratamentos

Usar apenas dados fictícios e o número de teste autorizado pelo utilizador:

1. A1: confirmação de uma etapa e lote; equipa completa, tipo e duração corretos; retries não provocam nova criação na BD.
2. A2: lembrete por consulta, sem ler comentários internos.
3. A6: review ativo/inativo e notas públicas; internal observation nunca nas mensagens/logs de payload público.
4. A8: conversão normal continua válida; conflito `patient_unavailable` não gera mensagem de sucesso.
5. Atualizações que apenas registam comentários/revisões/encerramento não geram mensagens.
6. Se for necessária garantia sobre HTTP não emitido em rollback de lote, validar especificamente o enfileiramento transacional de pg_net num ambiente isolado. Essa prova HTTP não foi executada localmente; apenas SQL/eventos.

## Publicação e recuperação

Rever schema remoto e lista exata das cinco migrações; aplicar BD antes do frontend. Como as três primeiras têm timestamps anteriores à migração de correções já remota, não usar `db push` indiscriminadamente: rever dry-run com inclusão das pendentes anteriores. Não aplicar fixtures nem scripts de teste em produção.

Se o frontend tiver problemas, voltar à versão anterior mantendo os dados novos. Não fazer DROP das tabelas clínicas. Correção de guards faz-se por migração nova preservando contratos e registos.

Evidência local completa: [validação](2026-11-02-treatments-validation.md). Não foi executada qualquer alteração ao n8n nem enviado aviso ao Samuel automaticamente.
