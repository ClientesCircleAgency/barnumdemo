# Samuel — alterações da base de dados Barnun

**Atualizado a 26 de outubro de 2026: publicado em produção.**

Commit `13b9b9c`, deploy Vercel concluído e seis migrações confirmadas no Supabase remoto. [Relatório da publicação](2026-10-26-production-release.md).

## Respostas às duas questões

**1. A Automação 8 pode continuar com PATCH?**

Sim. O PATCH em `appointment_requests` com `status=converted` e `accepted_slot` é processado pelo trigger `trg_create_appointment_on_convert`. Não é obrigatório mudar para a RPC. Lê `date`, `time`, `professional_id`, `additional_professional_ids`, `consultation_type_id` e **`duration` em minutos**.

`source_request_id` não vem de `accepted_slot`: é preenchido automaticamente com o ID do pedido atualizado. A relação única impede repetir a criação dos pedidos já convertidos pelo novo fluxo.

**2. Podemos ter os nomes da equipa na linha de appointments?**

Sim. Já existe `appointments.professional_names`, tipo `text[]`, representado como uma lista no JSON:

```json
{"professional_names": ["Dr. X", "Dra. Y", "Dra. Z"]}
```

O principal vem primeiro. `save_appointment_team` guarda esta lista na mesma inserção/atualização da consulta, antes de o webhook receber o evento. Alterar a equipa atualiza os nomes; concluir conserva-os.

Para consultas anteriores à migração, usar `professional_name` quando `professional_names` estiver nulo/vazio. Não foi feito backfill para evitar mensagens automáticas em massa. Os nomes são um snapshot da gravação.

## Esquema

| Objeto | Alteração |
|---|---|
| `appointment_additional_professionals` | Nova relação: `appointment_id`, `professional_id`, `professional_name`. Chave composta impede duplicados. |
| `appointment_notes` | Notas com `id`, `appointment_id`, `author_user_id`, `note`, `created_at`. |
| `appointments.version` | Versão incrementada nas atualizações; impede sobrescrever uma edição concorrente. |
| `appointments.source_request_id` | Ligação única ao pedido original. |
| `appointments.finalized_by` | Utilizador que concluiu a consulta. |
| `appointments.professional_names` | Lista completa dos nomes, principal primeiro. |
| `professionals.is_active` | Inatividade persistente após desligar o colaborador; conserva o histórico. |

`appointments.professional_id` e `professional_name` continuam a representar o principal. Existe uma só consulta, mesmo quando ocupa a agenda de vários médicos.

As relações com profissionais passaram a impedir apagar registos associados a consultas. A FK de autor das notas também restringe a eliminação física do utilizador: não apagar notas para contornar essa proteção. Profissionais já sem ligação a utilizador antes da migração mantiveram compatibilidade e devem ser revistos quanto à atividade.

## Funções e permissões

- `save_appointment_team(p_appointment_id, p_expected_version, p_appointment, p_additional_professional_ids)`: criar/editar de forma atómica. Para criar, ID e versão nulos; para editar, usar a versão original da edição e enviar a lista completa de adicionais. Lista vazia remove os adicionais. Não repetir automaticamente um conflito de versão com dados antigos.
- `convert_request_to_appointment_with_team`: conversão via RPC, se preferida. A RPC antiga continua disponível. Aqui, adicionais nulos/omitidos preservam ou recuperam a opção aceite; `[]` significa nenhum adicional.
- `set_appointment_state`: transição de estado/conclusão com versão, notas finais e preferência de avaliação. A autoria humana depende do utilizador autenticado.
- `get_appointment_team_availability`: valida atividade, especialidade, tipo, horários, ausências e conflitos de todos. A reserva definitiva volta a validar ao guardar.

Administradores/secretárias gerem equipa, reagendam e cancelam. Médicos associados podem ler, acrescentar notas próprias e concluir. A futura role com restrição de acesso a pacientes continua fora deste âmbito.

Clientes autenticados devem usar RPCs para inserir/atualizar consultas. A relação de adicionais não é para escrita direta, incluindo por service role. Realtime foi configurado para consultas, participantes, notas, pedidos, pacientes e notificações.

## n8n: conservar a opção completa

Guardar a equipa, tipo e duração em cada `suggested_slots` e conservar a opção escolhida em `accepted_slot`. Usar a chave **`duration`**, não depender de `duration_minutes`.

A conversão pode produzir INSERT e UPDATE da mesma consulta: o `source_request_id` é atribuído após criar a consulta. Os nomes já estão completos no primeiro evento, mas a ligação ao pedido ainda pode estar nula nesse primeiro INSERT. Filtrar atualizações técnicas e deduplicar comunicações por consulta/evento; não enviar uma mensagem por médico ou por qualquer UPDATE.

Exemplos completos de PATCH e composição da mensagem: [contrato final n8n](2026-10-26-n8n-team-handoff.md).

## Migrações aplicadas

1. `20261024090000_appointment_teams.sql`
2. `20261024090500_atomic_appointment_teams.sql`
3. `20261024091000_request_appointment_teams.sql`
4. `20261024091500_shared_appointment_lifecycle.sql`
5. `20261024100000_team_review_fixes.sql`
6. `20261026140000_appointment_team_names.sql`

Frontend e função `delete-collaborator` publicados. Não foi aplicada limpeza de dados nem o baseline local em produção.

## Testes e próximo passo

Passaram 64 testes frontend, TypeScript/build, 45 testes SQL e verificações locais de concorrência/Realtime. Em produção foram confirmados o esquema, o deploy e o bundle público; não foram criados dados de teste nem enviadas mensagens nesta publicação.

**Samuel pode agora testar ponta a ponta com dados de teste e o seu número**, incluindo equipa, PATCH, reagendamento, conclusão e mensagens. Não usar contactos de pacientes reais. Workbench mantém os webhooks externos desligados.

O incidente anterior de quatro respostas HTTP 200 de testes locais para n8n continua documentado no relatório de validação; a publicação não confirma retroativamente os efeitos dessas execuções.
