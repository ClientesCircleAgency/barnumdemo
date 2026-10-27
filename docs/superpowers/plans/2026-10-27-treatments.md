# Tratamentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implementar tratamentos com sessões planeadas, marcações reais, observações internas e comentários por consulta sem alterar o contrato n8n existente.

**Architecture:** Tabelas internas aditivas e RPCs transacionais; ligação da etapa ao appointment, nunca cópia paralela da consulta. Reutilizar disponibilidade e gravação de equipas. UI integrada na ficha do paciente com consulta/comentários lado a lado.

**Tech Stack:** React, TypeScript, TanStack Query, componentes existentes, Supabase/PostgreSQL, pgTAP, Vitest e Playwright. Sem novas dependências por defeito.

**Spec:** `docs/superpowers/specs/2026-10-27-treatments-design.md`.

## Global Constraints

- Desenvolvimento em `workbench/barnun`; backend Docker `barnun-workbench`, API 46321, PostgreSQL 46322. Nunca executar testes com fixtures num backend remoto.
- Antes de testes SQL, confirmar zero triggers HTTP externos. Fixtures em transações revertidas; integração com clientes deve limpar apenas IDs criados pelo teste.
- `dev` publica produção; este plano não autoriza publicação de Tratamentos. Push somente da branch de desenvolvimento.
- Cumprir `docs/operations/database-n8n-compatibility.md`; não afirmar compatibilidade n8n sem evidência.
- Uma consulta pertence a um único tratamento; preservar avulsas. Observações internas nunca entram em `appointments.final_notes` ou webhooks.
- Todos os médicos leem; só participantes da sessão, secretárias e admins escrevem. Autor edita texto próprio se ainda autorizado; admin edita qualquer texto mantendo auditoria.
- Encerramento do tratamento manual. Marcações verificam duração completa e disponibilidade de todos os profissionais em Europe/Lisbon.
- Nenhum backfill de pacientes/appointments ou migração destrutiva. Criar migrações com CLI; não editar migrações já publicadas.

## Review Focus

1. Alterar equipa fora do painel não pode deixar acesso de escrita ao médico removido — teste tarefa 1/3.
2. Duas marcações concorrentes da mesma etapa não podem duplicar consulta ou mensagem — teste tarefa 2.
3. Uma falha no último item do lote não pode deixar marcações parciais — teste tarefa 2/6.
4. Médico não participante deve conseguir chegar ao tratamento sem abrir dados pessoais desnecessários — teste tarefa 4.
5. Nova observação interna não pode sair no evento de conclusão enviado ao n8n — captura de payload tarefa 3/6.

## Ficheiros e contratos transversais

Criar `src/types/treatments.ts`: `TreatmentStatus = 'active'|'completed'|'cancelled'`, `SessionKind = 'consultation'|'surgery'`, tipos das linhas novas e `TreatmentBooking = { session_id: string; expected_version: number; date: string; time: string }`. Usar nomes snake_case alinhados com tipos gerados. `TreatmentSessionView` combina a etapa e appointment atual, incluindo equipa atual, observações internas e comentários; sem estado/data duplicados.

Criar hooks em `src/hooks/useTreatments.ts`, `useTreatmentSessions.ts`, `useTreatmentComments.ts`, `useClinicalObservations.ts`. Queries com chaves `['treatments', patientId]`, `['treatment', id]`, `['treatment-sessions', id]`, `['session-comments', sessionId]`, `['clinical-observations', appointmentId]`. Mutações invalidam apenas dependências afetadas; marcação invalida também appointments e disponibilidade. Leitura atualizada por polling de 15 s, seguindo padrão existente; não depender de configurar Realtime novo.

SQL: separar migrations de schema/acesso, marcação, comentários/observações. Criar com `supabase migration new <nome>`. IDs das migrations são gerados no momento; documentar nomes exatos no relatório quando criados.

## Tarefa 1 — Modelo, permissões e gestão do tratamento

**Files:** novas migrações `treatments_schema` e `treatments_access`; `supabase/tests/treatments_access.test.sql`; `src/types/treatments.ts`; atualizar `src/integrations/supabase/types.ts` a partir do backend local.

**Interfaces:**
- `save_treatment(p_id uuid, p_expected_version bigint, p_fields jsonb, p_professional_ids uuid[], p_primary_professional_id uuid) returns uuid`: admin/secretária; whitelist name/objective/patient_id/specialty_id. Paciente imutável após criação.
- `save_treatment_session(p_id uuid, p_expected_version bigint, p_treatment_id uuid, p_fields jsonb, p_additional_professional_ids uuid[]) returns uuid`: admin/secretária; whitelist name/kind/consultation_type_id/duration/ordinal/primary_professional_id. Sessão ligada não permite editar equipa/duração por esta via: usar gravação da consulta existente.
- `set_treatment_state(p_id uuid,p_expected_version bigint,p_status text) returns uuid`: admin/secretária/equipa do tratamento; concluir exige zero etapas pendentes não omitidas e zero consultas ativas. Reabrir preserva o histórico de mudanças.
- `omit_treatment_session(p_id uuid,p_expected_version bigint,p_reason text) returns uuid`: gestão, apenas sem appointment; motivo obrigatório, sem apagar comentários.
- Helpers privados de leitura e escrita, sem confiar em user_metadata; escrita clínica calcula participação a partir de appointment quando ligado.

- [ ] Escrever testes pgTAP com roles distintas: leitura permitida aos três papéis de staff, negada a anon/utilizador sem role; escrita de estrutura só gestão; participantes removidos perdem escrita; validações de equipa/tipo/paciente/duração; autoria não falsificável; versões obsoletas rejeitadas.
- [ ] Executar testes antes do schema: devem falhar por objetos ausentes.
- [ ] Criar tabelas/constraints/índices/RLS/GRANT mínimos descritos na spec; usar RESTRICT para dados clínicos relacionados e não permitir deletes diretos. Criar funções em search_path vazio, com autorização explícita e EXECUTE restrito.
- [ ] Implementar RPCs acima, atualização de version e registo append-only de mudanças de estado (`treatment_state_events`: estado anterior/novo, autor, data). Sem triggers externos.
- [ ] Executar pgTAP local e gerar tipos (`supabase gen types typescript --local`). Rever diff para não remover tipos existentes ou usar ref remoto.
- [ ] Commit apenas ficheiros desta tarefa.

## Tarefa 2 — Marcação simples/lote, vínculo e idempotência

**Files:** migration `treatment_booking`; `supabase/tests/treatment_booking.test.sql`; `scripts/test-treatment-booking-concurrency.mjs`; `src/hooks/useTreatmentSessions.ts`.

**Interfaces:**
- `book_treatment_sessions(p_treatment_id uuid, p_slots jsonb) returns jsonb`: array de TreatmentBooking; devolve array `{session_id,appointment_id}`. Sem novos parâmetros na RPC existente `save_appointment_team`.
- `link_treatment_appointment(p_session_id uuid,p_expected_version bigint,p_appointment_id uuid) returns uuid`: gestão; validar paciente e exclusividade, não atualizar appointments.
- Hook `useBookTreatmentSessions()` recebe `{treatmentId,slots:TreatmentBooking[]}`; `useLinkTreatmentAppointment()` recebe os argumentos da ligação.

- [ ] Escrever testes: um appointment por etapa, paciente/equipa/duração corretos, unique da ligação; consulta avulsa pode ser ligada; paciente errado rejeitado; replay igual devolve IDs; replay divergente rejeitado; lote com último slot indisponível reverte tudo.
- [ ] Verificar falha antes da implementação.
- [ ] Bloquear tratamento e etapas em ordem UUID; obter todos os locks de profissionais em ordem global compatível com os locks usados pelo booking atual antes de iniciar gravações. Revalidar version/estado/elegibilidade. Reutilizar `save_appointment_team` em cada etapa na mesma transação e guardar appointment_id na etapa. Não atualizar appointment só para vincular.
- [ ] Para retry comparar data/hora/duração/equipa/tipo com a consulta ligada; não aceitar retry como pedido de reagendamento. Reagendamento usa o fluxo existente e a versão do appointment.
- [ ] Criar teste Node com dois clientes/duas transações para mesma etapa e para equipas sobrepostas; exigir uma consulta por etapa, sem reservas parciais. Scripts validam endpoint local e zero hooks HTTP antes de escrever.
- [ ] Executar SQL e concorrência; commit.

## Tarefa 3 — Comentários, revisões e conclusão clínica interna

**Files:** migration `treatment_clinical_records`; `supabase/tests/treatment_clinical_records.test.sql`; `src/hooks/useTreatmentComments.ts`; `src/hooks/useClinicalObservations.ts`.

**Interfaces:**
- `save_treatment_comment(p_id uuid,p_expected_version bigint,p_session_id uuid,p_body text) returns uuid`.
- `save_clinical_observation(p_id uuid,p_expected_version bigint,p_appointment_id uuid,p_body text) returns uuid`.
- `finalize_appointment_with_observation(p_appointment_id uuid,p_expected_version bigint,p_final_notes text,p_send_review boolean,p_internal_observation text) returns uuid`.
- `get_treatment_comment_revisions(p_comment_id uuid) returns setof treatment_comment_revisions` e equivalente para observações, com autorização de leitura.

- [ ] Testar matriz de autor/admin/secretária/participante/não participante/removido, texto vazio rejeitado para comentário, versão obsoleta, autor original preservado e histórico append-only inacessível para escrita direta.
- [ ] Rever consumidores de `appointment_notes` e manter esse contrato intacto: primeira versão usa tabelas próprias para a nova observação editável/auditável, sem migração de notas anteriores.
- [ ] Implementar gravação e revisão na mesma transação; autor definido por auth.uid, não pelo payload. Revogar INSERT/UPDATE/DELETE diretos que contornem autoria/revisões. Aplicar limite de 20 000 caracteres por texto e devolvê-lo também na UI.
- [ ] Implementar finalização wrapper: se texto interno não vazio, inserir observação; chamar `set_appointment_state` existente. Repetição de conclusão já aplicada não insere observação duplicada. Falha reverte estado e texto. Manter assinatura e comportamento da RPC original para n8n.
- [ ] Capturar eventos locais: comentar e editar não gera UPDATE appointments; conclusão gera evento habitual sem conteúdo interno, mesmo com texto que contenha HTML/caracteres especiais. Renderização como texto, nunca HTML do utilizador.
- [ ] Executar testes e commit.

## Tarefa 4 — Ficha do paciente, lista e painel de tratamento

**Files:** modificar `src/pages/admin/PatientDetailPage.tsx`; criar `src/components/admin/treatments/{TreatmentsTab,TreatmentEditor,TreatmentDetail,TreatmentSessionRow,TreatmentComments,CommentHistoryDialog}.tsx`; hooks `useTreatments.ts`; testes homónimos para componentes com lógica.

**Interfaces:** `TreatmentsTab({patientId:string})`; `TreatmentDetail({treatmentId:string,onBack:()=>void})`; `TreatmentSessionRow({session:TreatmentSessionView})`; `TreatmentComments({sessionId:string})`. O editor recebe ID opcional e usa save_treatment.

- [ ] Testar criação/edição do tratamento por gestão, render dos estados/contadores, consulta à esquerda/comentários correspondentes à direita, ausência de chat geral, notas internas separadas, revisão sem mudar autor e preservação de rascunho após falha/polling.
- [ ] Implementar abas sem eliminar dados pessoais e histórico atual; lista de tratamentos com criar/abrir; estados vazios, loading e erros explícitos.
- [ ] Resolver acesso de médicos sem ampliar SELECT de todas as colunas de pacientes: endpoint staff-only `list_treatment_patient_directory(p_query text)` devolve apenas `{patient_id,patient_name}` com limite de 50 e busca pelo nome; entrada na área de pacientes para abrir tratamentos. O detalhe de tratamentos usa essa identificação mínima e não depende de obter a ficha pessoal completa. Testar que leitor não obtém NIF/telefone/email por esse endpoint.
- [ ] Implementar autorização visual pela mesma matriz da BD, mantendo RPC como barreira efetiva. Participação de consulta marcada vem de equipa atual, nunca de snapshot de planeamento.
- [ ] Testar com Vitest e verificar mobile em 390 px e desktop em 1440 px. Commit.

## Tarefa 5 — Agenda disponível e conclusão integradas

**Files:** criar `src/components/admin/treatments/{TreatmentSessionEditor,TreatmentBookingDialog,TreatmentBookingReview}.tsx`; modificar `FinalizationModal.tsx`, `WaitingRoomPage.tsx`, `AppointmentDetailDrawer.tsx`, `PatientDetailPage.tsx`; usar `AppointmentTeamList.tsx` e `AppointmentProfessionalsField.tsx` existentes; testes de integração dos novos fluxos.

**Interfaces:** `TreatmentBookingDialog({treatmentId:string,sessionIds:string[],open:boolean,onOpenChange:(open:boolean)=>void})`. Slots apenas via disponibilidade existente; submissão por useBookTreatmentSessions. Wrapper de finalização integrado no hook apropriado, mantendo uso atual da RPC original para mutações sem observações.

- [ ] Testar seleção de equipa/duração limpa hora, apenas horários comuns apresentados, dia sem vagas, conflito ao submeter preserva escolhas e indica a etapa, retry sem duplicação. Plano por marcar nunca mostra botão Concluir consulta.
- [ ] Implementar seleção individual e assistente de várias etapas com revisão final; manter datas escolhidas sem impor regras clínicas automáticas. Confirmar lote somente quando todos os slots válidos.
- [ ] Separar três campos na conclusão: observações internas, observações para o paciente e opção de avaliação. Restaurar valores atuais e preservar rascunhos; texto interno nunca passa para p_final_notes. Exibir tratamento e observações no histórico/drawer via relação, sem gravar duplicados.
- [ ] Testar consulta avulsa e ligada, sem nota interna, reabertura, falha da BD e permissões. Executar Vitest, TypeScript e build; commit.

## Tarefa 6 — Auditoria, integração local e entrega para validação

**Files:** criar `supabase/tests/treatment_webhook_contract.test.sql`, `scripts/test-treatments-local.mjs`, `docs/operations/2026-10-27-treatments-validation.md`; atualizar `docs/operations/2026-10-27-treatments-n8n-impact.md` e contexto do projeto.

- [ ] Registar schema/diff de migrations e contratos RPC antes/depois. Observadores locais capturam tipo de evento, IDs e campos, sem disparar HTTP. Testar que criação de tratamento, comentários, revisões, omissão, encerramento e ligação de consulta antiga geram zero eventos nas tabelas com webhook.
- [ ] Testar marcação de uma etapa e lote, alteração de equipa, reagendamento, cancelamento e conclusão: comparar com o contrato existente. Assert de ausência de texto clínico interno nos records/old_records. Testar conversão por PATCH/RPC existente e consultas antigas.
- [ ] Executar suite SQL completa, scripts de concorrência locais, `npm test`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Sem ampliar testes repetidamente quando os checks passam e não houve mudanças.
- [ ] Revisão independente da branch; corrigir problemas importantes e repetir os checks afetados.
- [ ] Atualizar documento Samuel com objetos/assinaturas finais, eventos medidos e ações externas necessárias. Destacar que mensagens por lote são múltiplas salvo nova coordenação. Não dizer que ponta a ponta n8n passou sem validação dele.
- [ ] Disponibilizar aplicação real local com dados fictícios para o utilizador testar. Só então preparar publicação coordenada; não usar este plano como autorização de push para dev ou migração remota.

## Verificação do próprio plano

Cobertura: modelação/gestão/permissões (1); vínculo/agenda/idempotência/lote (2); comentários/observações/auditoria (3); navegação e layout aprovado (4); marcação e conclusão na aplicação (5); isolamento/regressão/n8n/entrega (6). Os cinco riscos de Review Focus têm testes atribuídos. As RPCs novas não substituem assinaturas usadas pelo Samuel.

Método recomendado: execução nativa nesta sessão com revisão independente final, pois as tarefas dependem dos mesmos contratos de BD. Este documento é o plano para revisão, não um relatório de implementação ou de testes executados.
