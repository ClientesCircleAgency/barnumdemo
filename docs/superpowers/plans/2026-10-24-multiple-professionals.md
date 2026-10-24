# Consultas com vários profissionais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma consulta partilhada ocupa toda a duração nas agendas dos participantes, preserva todos os nomes no histórico e sincroniza alterações e conclusão.

**Architecture:** Manter o principal em `appointments.professional_id` e os adicionais numa relação própria. Centralizar gravação, conversão, autorização e disponibilidade em operações transacionais; consumir a mesma equipa nas leituras e na interface. Preservar os contratos escalares existentes das automações.

**Tech Stack:** React 18, TypeScript, TanStack Query, Supabase/PostgreSQL, Vitest e Testing Library existentes.

**Spec:** `docs/superpowers/specs/2026-10-24-multiple-professionals-design.md` (aprovada na conversa em 2026-10-24).

## Global Constraints

- «Existe uma única consulta, com um único estado, paciente, horário e duração.»
- «Todos os médicos participam desde o início até ao fim.»
- «Apenas secretárias e administradores podem reagendar, alterar os profissionais ou cancelar a consulta.»
- «O médico principal, os médicos adicionais, as secretárias e os administradores podem concluir a consulta.»
- «O paciente recebe uma mensagem por evento da consulta, independentemente do número de médicos.»
- Horário local da clínica: `Europe/Lisbon`; intervalos `[início, fim)`.
- Manter consultas antigas, sem adicionais; não apagar dados, utilizadores ou configuração.
- Executar em `Projects/workbench/barnun`, branch `workbench/barnun`. Nenhum push para `dev` nesta fase.
- O workbench ainda não tem backend isolado. Testes com escrita exigem instância local de teste e dados sintéticos. Não utilizar o projeto remoto ligado para executar fixtures ou resets.

## Review Focus

1. Aceitação externa de uma alternativa que perde campos adicionais: recuperar a equipa da proposta guardada e rejeitar correspondências ambíguas — tarefa 3.
2. Duas secretárias editam a mesma consulta: a segunda recebe conflito de versão, conservando a alteração da primeira — tarefa 2.
3. Médico removido enquanto tem a consulta aberta: deixar de poder agir, mesmo com estado antigo no navegador — tarefas 2 e 7.
4. Horário inválido, duração zero e transição de hora em Lisboa: recusar dados inválidos sem alterar o dia escolhido nem produzir reservas parciais — tarefas 2 e 4.
5. Consultas antigas e profissionais desativados: manter nomes e histórico, sem disponibilizar profissionais inativos para novas associações — tarefas 1 e 6.

## Contexto confirmado e limites

`useAppointments.ts` escreve diretamente na tabela. A conversão por RPC já bloqueia o principal por dia; o trigger `trg_create_appointment_on_convert` é um segundo caminho. A última definição da RPC está em `20261020030001_secure_staff_conversion_notifications.sql`, não apenas na migração de abril. A disponibilidade de pedidos e alternativas ainda não aplica uniformemente os horários. `ClinicContext` já subscreve alterações a consultas, pacientes e pedidos. Acrescentar participantes ao mecanismo existente.

O estado remoto atual e os workflows externos não foram inspecionados nesta etapa. Antes de publicar, confrontar as definições efetivas e o contrato do Samuel com as migrações locais; não presumir que uma implementação local valida integrações externas.

## Mapa de ficheiros e contratos

Novos módulos focados:

- `src/types/appointmentTeam.ts`: `AppointmentTeam { primaryProfessionalId: string; additionalProfessionalIds: string[] }`, `AppointmentWithTeamRow = AppointmentRow & { additional_professional_ids: string[]; version: number }`.
- `src/utils/appointmentTeam.ts`: `getAppointmentProfessionalIds(team: AppointmentTeam): string[]` e `hasAppointmentProfessional(team: AppointmentTeam, professionalId: string): boolean`.
- `src/hooks/useAppointmentTeamAvailability.ts`: consultar elegibilidade sem expor detalhes de outras consultas.
- `src/components/admin/AppointmentProfessionalsField.tsx`: seleção partilhada de principal/adicionais; sem gravações próprias.
- `supabase/migrations/20261024090000_appointment_teams.sql`: dados, autorização e operações de consulta.
- `supabase/migrations/20261024091000_request_appointment_teams.sql`: conversão e alternativas.
- `supabase/tests/appointment_teams.test.sql`, `supabase/tests/request_appointment_teams.test.sql`: fixtures e testes transacionais locais.
- `scripts/test-appointment-team-concurrency.mjs`: duas sessões reais contra backend exclusivamente local; recusar host não loopback.

Alterações nos tipos gerados, hooks, contexto e ecrãs estão discriminadas nas tarefas. Não alterar migrações antigas para introduzir a funcionalidade.

### Task 1: Modelo de participantes e leitura compatível

**Files:** criar tipos/utilitários acima e `src/utils/appointmentTeam.test.ts`; criar primeira migração e teste SQL; modificar `src/types/clinic.ts`, `src/types/database.ts`, `src/integrations/supabase/types.ts`.

**Interfaces:** produzir `AppointmentTeam`, `AppointmentWithTeamRow` e os dois helpers. Acrescentar `additionalProfessionalIds: string[]` e `version: number` ao modelo da aplicação. Relação SQL `appointment_additional_professionals(appointment_id uuid, professional_id uuid, professional_name text)` com chave composta; `appointments.version bigint not null default 1`. Nome do adicional é snapshot na associação; conservar o snapshot existente do principal.

- [ ] Criar testes: `expect(getAppointmentProfessionalIds({primaryProfessionalId: 'a', additionalProfessionalIds: ['b']})).toEqual(['a', 'b'])`; equipa antiga com `[]` devolve `['a']`; a validação de escrita rejeita principal repetido e adicionais duplicados.
- [ ] Executar `npm test -- src/utils/appointmentTeam.test.ts`; confirmar falha pela ausência do módulo.
- [ ] Implementar tipos/helpers; criar relação com FK da consulta em cascade e FK do profissional em restrict, índice por profissional e RLS. Não conceder escrita direta a `authenticated`; leitura segue acesso à consulta. Proteger identidade de principal/adicionais através da operação da tarefa 2 e validação de integridade também no servidor.
- [ ] Preparar base local sintética e executar os testes SQL: consulta antiga tem equipa só principal; FK impede apagar profissional que destruiria associação histórica; anon não lê participantes. Confirmar CLI e Docker disponíveis antes de iniciar a instância; descobrir comandos com `supabase --help` e `supabase test db --help`. Nunca usar `--linked` nos testes. Se as migrações históricas não forem reproduzíveis, corrigir a preparação local sem alterar o remoto e registar a limitação.
- [ ] Executar teste unitário e teste SQL local com sucesso, gerar tipos a partir da instância local e fazer commit `feat: model appointment teams`.

### Task 2: Gravação, permissões e disponibilidade transacionais

**Files:** completar `20261024090000_appointment_teams.sql`, `supabase/tests/appointment_teams.test.sql`; criar `scripts/test-appointment-team-concurrency.mjs`.

**Interfaces:** `save_appointment_team(p_appointment_id uuid, p_expected_version bigint, p_appointment jsonb, p_additional_professional_ids uuid[]) returns uuid`; novo registo usa id/version nulos. `set_appointment_state(p_appointment_id uuid, p_expected_version bigint, p_status appointment_status, p_final_notes text) returns uuid`. `get_appointment_team_availability(p_specialty_id uuid, p_consultation_type_id uuid, p_date date, p_time time, p_duration integer, p_exclude_appointment_id uuid) returns table(professional_id uuid, available boolean, reason text)`. Códigos de motivo: `inactive`, `specialty`, `consultation_type`, `working_hours`, `time_off`, `conflict`; erros de gravação incluem `stale_version` e `forbidden`.

- [ ] Escrever SQL tests para: admin/secretária gravam equipa; principal/adicional concluem; médico não associado não conclui; associados não reagendam/cancelam/alteram equipa; autoria de notas não pode ser falsificada. Assertivas SQL devem verificar exceção `42501` para acesso indevido e estado original preservado.
- [ ] Executar testes locais, confirmar falhas antes das funções/policies.
- [ ] Implementar validador interno reutilizado pelas três interfaces. Validar lista de campos permitidos no JSON, duração inteira positiva, data/hora válidas, profissional ativo, especialidade/tipo, horários e ausências. Sem horário configurado (`null`/`[]`) preservar compatibilidade; horário configurado sem dia ativo recusa. Excluir `cancelled` e `no_show` de conflitos, conforme a RPC atual; excluir a própria consulta na edição. Recusar intervalos que ultrapassam o dia local, em coerência com os turnos diários existentes.
- [ ] Bloquear a consulta existente, verificar `version`, bloquear a união de profissionais antigos/novos por UUID em ordem estável e só então verificar conflitos. Preferir bloqueios por profissional, sem segmentação por dia, para simplificar a proteção de reagendamentos. Atualizar versão em qualquer alteração, incluindo equipa e estado. Executar todas as alterações numa transação. Todos os caminhos de escrita devem obter os mesmos bloqueios; proibir DML de reservas que contorne este protocolo e encaminhar integrações pelas operações autorizadas.
- [ ] Implementar autorização com `has_role` e associação por `professionals.user_id`; não confiar em payload de papel/autor. Funções privilegiadas internas em schema não exposto, `search_path` fixo e permissões mínimas. Revogar EXECUTE público por defeito. Chamadas de serviço explicitamente autorizadas usam o mesmo validador. Atualizar policies de notas e notificações para reconhecer adicionais, sem alargar acesso global a pacientes. Preservar as transições existentes da sala de espera; cancelamento exige gestão, conclusão aceita os quatro intervenientes. Repetir conclusão já aplicada devolve o mesmo id sem nova escrita/evento.
- [ ] Acrescentar casos SQL: segunda 2026-10-26 às 13:00 com turno 16:00–19:00 recusa; 16:00/30 aceita; 18:45/30 recusa; 16:30 após 16:00/30 aceita; ausência recusa; versão antiga recusa; remoção de médico invalida autorização antiga; duração zero recusa; datas antes/depois da mudança de hora mantêm o dia civil. Alterar apenas estado/notas de consulta histórica não revalida disponibilidade passada.
- [ ] Criar teste concorrente com duas sessões independentes: mesmo médico como principal/adicional, mesmo intervalo, apenas uma gravação aceite; numa edição concorrente apenas uma versão aceite. Executar `node scripts/test-appointment-team-concurrency.mjs` contra localhost e exigir zero reservas parciais. Confirmar também que escrita direta não contorna permissões/invariantes.
- [ ] Executar suite SQL local com todos os casos a passar e fazer commit `feat: enforce atomic appointment team booking`.

### Task 3: Conversão de pedidos e alternativas sem duplicação

**Files:** criar segunda migração/teste SQL; modificar `src/hooks/useAppointmentRequests.ts`; criar `src/types/appointmentSlot.ts`; atualizar `docs/contracts/FRONTEND_DB_CONTRACT.md` e `docs/contracts/WHATSAPP_AUTOMATIONS_SPEC.md`.

**Interfaces:** `AppointmentSlot { date: string; time: string; professional_id?: string; additional_professional_ids?: string[]; consultation_type_id?: string; duration?: number }`. Nova RPC `convert_request_to_appointment_with_team` recebe os seis parâmetros existentes mais `p_additional_professional_ids uuid[]` e devolve UUID. Preservar a RPC de seis parâmetros como wrapper compatível. Acrescentar `appointments.source_request_id uuid` nullable com unicidade para idempotência por pedido.

- [ ] Testar: conversão com equipa cria uma consulta e uma relação adicional; nova tentativa do mesmo pedido não duplica; indisponibilidade mantém pedido não convertido e não cria paciente/consulta parcial; trigger e RPC obtêm o mesmo resultado.
- [ ] Executar SQL tests e confirmar falha antes da implementação.
- [ ] Extrair núcleo interno de conversão usado pela RPC e pelo trigger, utilizando gravação/validação da tarefa 2. Eliminar o ciclo de inserção duplicada entre RPC e trigger usando `source_request_id` e bloqueio do pedido. Não inferir identidade do pedido apenas por paciente/data/hora. Manter chamadas antigas com zero adicionais e acesso de gestão/serviço já autorizado.
- [ ] Persistir equipa por opção em `suggested_slots`; copiar a opção inteira para `accepted_slot` quando possível. Se consumidor externo enviar apenas data/hora, resolver contra uma única proposta guardada; rejeitar zero ou múltiplas correspondências ambíguas. Não aceitar IDs de equipa arbitrários de resposta pública. Opção antiga sem adicionais corresponde a `[]`. Revalidar disponibilidade na conversão, nunca reservar ao sugerir.
- [ ] Testar payload de accepted_slot objeto e string JSON já suportados, opção antiga, equipa omitida na resposta mas presente na proposta, ambiguidade entre duas equipas no mesmo horário e conflito surgido depois da proposta.
- [ ] Atualizar tipos e hook para a nova RPC; documentar campos aditivos e o identificador de evento por consulta/transição. Testar que conversão não emite notificações por participante. Alterações de workflows externos permanecem dependência de integração antes da publicação, não presumir que foram aplicadas.
- [ ] Executar testes SQL locais e fazer commit `feat: preserve teams through request conversion`.

### Task 4: Leituras e hooks comuns de equipa

**Files:** modificar `src/hooks/useAppointments.ts`, `src/context/ClinicContext.tsx`, `src/utils/availability.ts`; criar `src/hooks/useAppointmentTeamAvailability.ts`, `src/hooks/useAppointments.test.tsx`, `src/utils/availability.test.ts`.

**Interfaces:** hooks de listagem devolvem `AppointmentWithTeamRow[]`, incluindo equipa em todas as variantes (geral/data/paciente). `useAppointmentTeamAvailability(params)` devolve o resultado tipado da RPC da tarefa 2 através de TanStack Query; chave inclui especialidade, tipo, data, hora, duração e id excluído. Mutações recebem equipa completa e versão, e usam exclusivamente as operações das tarefas 2/3.

- [ ] Escrever testes de mapeamento legado `[]`, equipa adicional nas três listagens, payload de mutação com versão e invalidação por prefixo `appointments`. Assertiva central: `expect(mapped.additionalProfessionalIds).toEqual(['doctor-b'])`.
- [ ] Executar `npm test -- src/hooks/useAppointments.test.tsx src/utils/availability.test.ts`; confirmar falhas.
- [ ] Implementar seleção relacional, normalização única e mapeamento no contexto; não fazer uma chamada por consulta. Substituir filtros de conflitos locais que só verificam o principal; disponibilidade oferecida ao utilizador vem da RPC comum, sem precisar de ler outras consultas privadas. Preservar helper de horários nos testes e apresentação local quando útil.
- [ ] Testar loading/erro: não interpretar erro como lista livre; alteração de duração troca a chave; resposta antiga não autoriza guardar nova seleção; erro `stale_version` pede recarregamento e conserva formulário.
- [ ] Executar testes com sucesso e fazer commit `refactor: share appointment team reads and mutations`.

### Task 5: Seletores nos formulários

**Files:** criar `AppointmentProfessionalsField.tsx` e respetivo `.test.tsx` em `src/components/admin/`; modificar `AppointmentWizard.tsx`, `SuggestAlternativesModal.tsx`, `AppointmentDetailDrawer.tsx`, `src/pages/admin/RequestsPage.tsx` e testes correspondentes.

**Interfaces:** componente recebe `value: AppointmentTeam`, `onChange(team): void`, opções da tarefa 4, `disabled: boolean` e erros por profissional. Não grava dados. Texto exato: «Adicionar profissional», «Remover», «Médico principal».

- [ ] Criar testes Testing Library: clicar «Adicionar profissional» abre seletor; principal não aparece como adicional; remover preserva principal; alteração de horário mantém seleção inválida visível e bloqueia guardar. `expect(saveButton.disabled).toBe(true)` durante loading/erro/conflito.
- [ ] Executar testes dos quatro fluxos e confirmar falhas para o novo comportamento.
- [ ] Integrar componente abaixo do principal na confirmação de pedido, criação e edição; alternativas guardam equipa completa em cada opção. Mudanças de tipo/duração/data revalidam todos. Evitar perder adicionais ao mudar principal; exigir resolver repetição explicitamente. Ocultar ações de gestão a médicos em consultas partilhadas; manter controlo no servidor.
- [ ] Atualizar testes existentes de pedidos para incluir `additional_professional_ids: []` no caso legado. Cobrir pedido com dois médicos, manual, reagendamento e erro tardio de disponibilidade sem fechar o formulário nem limpar seleção.
- [ ] Executar `npm test -- src/components/admin src/pages/admin/RequestsPage.test.tsx`; exigir sucesso e fazer commit `feat: add appointment professional selectors`.

### Task 6: Agendas, histórico e contagens

**Files:** modificar `src/components/admin/WeekView.tsx`, `src/pages/admin/AgendaPage.tsx`, `PatientDetailPage.tsx`, `DashboardPage.tsx`, `StatisticsPage.tsx`, `WaitingRoomPage.tsx`, `src/components/admin/AppointmentDetailDrawer.tsx`; criar `src/components/admin/AppointmentTeamNames.tsx` e testes de `AgendaPage`, `PatientDetailPage`, `StatisticsPage` nas mesmas pastas.

**Interfaces:** `AppointmentTeamNames` recebe equipa e nomes/snapshots e apresenta principal identificado, seguido dos adicionais. Filtros usam `hasAppointmentProfessional` da tarefa 1.

- [ ] Testar consulta A+B: filtro A mostra uma, filtro B mostra uma, agenda geral mostra uma, histórico mostra uma com dois nomes. Estatística global conta uma; estatística por médico atribui uma participação a cada médico, sem somar participações como total de consultas.
- [ ] Executar testes e confirmar falhas nos filtros atuais só por principal.
- [ ] Atualizar vistas/filtros/nomes; manter chaves por consulta na vista geral e por consulta+profissional se existirem colunas separadas. Usar snapshots quando profissional não esteja na lista ativa. Verificar todos os usos restantes de `professionalId`/`professional_id` e documentar os que devem continuar a significar apenas principal.
- [ ] Testar profissional desativado com nome histórico preservado, caso legado e ecrã de médico adicional. Executar testes e fazer commit `feat: show shared appointments across calendars and history`.

### Task 7: Estado, notas e sincronização entre sessões

**Files:** modificar `src/pages/admin/WaitingRoomPage.tsx`, `src/components/admin/AppointmentDetailDrawer.tsx`, `src/context/ClinicContext.tsx`, `src/hooks/useNotifications.ts`; criar `src/context/ClinicContext.test.tsx`, `src/pages/admin/WaitingRoomPage.test.tsx`; completar primeira migração para publicação Realtime e policies.

**Interfaces:** usar `set_appointment_state` para conclusão/estados; `save_appointment_team` para gestão. A conclusão inclui notas finais na mesma transação. Alterar equipa incrementa versão do registo principal, garantindo evento observável mesmo para participante removido.

- [ ] Testar finalização pelos quatro papéis, notas com autor correto, duas conclusões sem duplicar eventos e médico removido a receber recusa na chamada seguinte.
- [ ] Executar testes, confirmar falhas no fluxo antigo.
- [ ] Integrar mutações na sala de espera e drawer, preservando as transições existentes. Acrescentar subscrição de participantes ao canal atual e garantir invalidation/refetch ao reconectar. Revalidar dados e acesso após erro de permissão; não manter consulta removida como editável em cache.
- [ ] Testar evento de equipa, evento de estado e reconexão invalidam dados; verificar em duas sessões locais autenticadas que cancelamento, reagendamento e conclusão aparecem sem refresh manual. Realtime respeita RLS: receber atualização nunca pode expor outra consulta.
- [ ] Executar testes unitários/SQL e fazer commit `feat: synchronize shared appointment lifecycle`.

### Task 8: Verificação integrada e entrega local

**Files:** criar `docs/operations/2026-10-24-appointment-teams-validation.md`; atualizar `docs/operations/QA_CHECKLIST.md` e contrato de automações com resultados efetivamente observados.

- [ ] Executar `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`; exigir exit code 0 ou documentar separadamente qualquer problema preexistente comprovado, sem atribuir sucesso ao comando que falhou.
- [ ] Executar suite SQL e teste de concorrência local. Verificar os 12 critérios da especificação, associando cada um à evidência concreta.
- [ ] Rever contratos externos: conversão por webhook, aceitação de alternativas, contagem de mensagens e nomes de participantes; manter publicação pendente se não for possível provar compatibilidade. Não enviar mensagens reais durante QA.
- [ ] Rever diff completo, permissões, migração aditiva e ausência de segredos/fixtures reais. Preparar implantação da migração e frontend compatíveis, com janela coordenada se a revogação de escrita direta afetar clientes antigos; não publicar uma metade isoladamente. Em recuperação, desativar novas marcações partilhadas e manter esquema/dados; não apagar participantes para reverter interface.
- [ ] Fazer commit `docs: record shared appointment validation` e entregar resumo do que foi testado, limitações e estado local. Integração na pasta original e push remoto são passos de entrega posteriores, respeitando o fluxo Workbench.

## Revisão do plano

Cobertura: dados/compatibilidade (1), disponibilidade e permissões (2), pedidos/alternativas/notificações (3), leitura/gravação (4), interação (5), agendas/histórico/contagens (6), ciclo de vida/notas/sincronização (7), validação integrada (8). Os cinco riscos de Review Focus estão associados a testes nas tarefas indicadas. Nenhuma tarefa requer limpar dados de produção; nenhuma automação externa é declarada validada sem execução controlada.

Estado: plano preparado e revisto; aguarda revisão escrita e escolha de método de execução. Nenhuma alteração funcional foi aplicada nesta etapa.
