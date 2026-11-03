# Tratamentos publicados — validação final com Samuel

Data: 3 de novembro de 2026.

## Mensagem curta para Samuel

Os Tratamentos já estão em produção, incluindo a proteção contra sobreposição de consultas do mesmo paciente quando existe uma sessão de tratamento envolvida. Podes repetir os testes de horário ocupado e o caso do mesmo paciente com médicos diferentes. Na A8, acrescenta o motivo `patient_unavailable` ao alerta interno da clínica; a mensagem neutra ao paciente mantém-se. Confirma que uma recusa não cria consulta nem envia confirmação. A A6 fica como publicaste: notas para o paciente independentes do pedido de review.

## Publicação verificada

- Branch de produção: `dev`, commit `dcea2cfa24ceb46fe8a2f24e6a5b992e7ca77e93`.
- Vercel: publicação concluída com sucesso.
- `https://www.clinicabarnun.pt/admin/login`: HTTP 200, aplicação com Tratamentos e backend de produção; sem referência ao backend local de testes.
- Supabase: nove novas tabelas de tratamentos/registos internos; migrações remotas atualizadas, sem pendências no dry-run posterior.
- Migrações aplicadas:
  - `20261027042724_treatments_schema.sql`
  - `20261027042857_treatment_booking.sql`
  - `20261027043038_treatment_clinical_records.sql`
  - `20261102143030_treatment_booking_time_safety.sql`
  - `20261102200619_treatment_concurrency_guards.sql`

## Compatibilidade e alteração de comportamento

As definições de `save_appointment_team`, `availability_reason`, `is_appointment_participant` e `can_manage_appointments` foram comparadas antes e depois da publicação e mantêm-se iguais. Não alterámos os workflows n8n.

Cada sessão marcada cria uma consulta real, com a equipa, e segue as automações existentes de consultas. Os comentários e observações médicas internos ficam em tabelas separadas; não são as notas destinadas ao paciente.

A nova proteção `zz_guard_treatment_patient_slot` pode recusar uma marcação/reagendamento quando o paciente já está ocupado e pelo menos uma das consultas pertence a um tratamento. Isto também cobre gravações pelas funções existentes. A política entre duas consultas avulsas não foi alterada. A A8 precisa de reconhecer `patient_unavailable` para explicar corretamente o motivo à clínica; a recusa genérica existente continua a ser uma recusa, não uma confirmação.

## Testes pedidos ao agente do Samuel

Usar apenas dados de teste e o número autorizado do Samuel. Não executar testes sobre consultas de pacientes reais.

1. Mesmo paciente, horários sobrepostos e médicos diferentes livres, com consulta de tratamento envolvida: esperar `patient_unavailable` (SQLSTATE `23514`). O pedido deve permanecer sugerido, sem consulta criada e sem confirmação enviada.
2. Repetir conflitos do profissional principal e adicional, preservando os motivos e respostas existentes.
3. Controlo com paciente e equipa livres: criar uma única consulta com a equipa correta e enviar a respetiva confirmação.
4. Confirmar que N consultas de tratamento originam N confirmações e os lembretes correspondentes, sem mensagens adicionais por comentários internos.
5. Confirmar o alerta da clínica com motivo explícito de paciente ocupado; manter a mensagem neutra ao paciente.

Não é necessário refazer a A6: segundo o relatório recebido, já envia a mensagem base, inclui `final_notes` quando preenchidas e inclui review apenas quando `send_review=true`. Observações médicas internas nunca entram nessa mensagem.

## Evidência e limites

Antes da publicação passaram 81 testes da aplicação, 116 verificações SQL locais, testes de concorrência, TypeScript e build. Após publicação foram verificados deployment, site, esquema e ausência de migrações pendentes.

Os testes ponta a ponta de WhatsApp acima continuam pendentes do Samuel. Não foram criados pacientes ou consultas de teste em produção nesta publicação. Esta entrega não acrescenta garantias de envio exatamente uma vez nem recuperação de mensagens perdidas em períodos de indisponibilidade do n8n.
