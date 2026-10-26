# Publicação Barnun — 26 de outubro de 2026

## Resultado

Versão integrada no projeto principal `Projects/barnumdemo-main` e publicada na branch remota `dev`.

- Commit publicado: `13b9b9cfca6f25f44b4c8d4a4f31130676caaa13`.
- Vercel: estado `success`, deployment `AwjfTJek5D8rVSjy2N3ffSHs1VW7`.
- Domínio verificado: `https://www.clinicabarnun.pt/admin/login`, HTTP 200.
- Bundle servido: `/assets/index-BXj0C7n7.js`; inclui a interface de equipa e `save_appointment_team`, aponta para o Supabase de produção e não contém o endpoint local `127.0.0.1:46321`.
- Aplicadas as cinco migrações `20261024*` e `20261026140000_appointment_team_names.sql`. Histórico remoto confirmado após aplicação.
- Função `delete-collaborator` publicada no projeto `oziejxqmghwmtjufstfp`.
- Campos/tabelas confirmados no esquema remoto: `professional_names`, `appointment_additional_professionals`, `source_request_id`, `finalized_by`, `is_active`.

## Validação e limites

64 testes frontend, TypeScript e build passaram no projeto principal integrado. No Workbench passaram 45 testes SQL e os testes de concorrência e sessões autenticadas/Realtime. O primeiro teste Realtime após iniciar Docker expirou durante a inicialização da replicação; repetido após verificar o serviço, passou.

Não foram criados pacientes, consultas ou contas de demonstração em produção. Não foram enviadas mensagens por esta execução. A verificação de produção foi de deploy, esquema e recursos públicos; não substitui a validação autenticada dos fluxos nem os testes ponta a ponta n8n que Samuel fará com o seu número.

Não foi feito backfill de `professional_names` em consultas antigas, para não disparar webhooks em massa. Até serem editadas pela RPC, o n8n deve usar `professional_name` quando a lista estiver nula/vazia.

O `supabase/config.toml` do projeto principal conserva o identificador de produção. A configuração local permanece na worktree Barnun; o baseline local não foi aplicado remotamente. Os documentos locais preexistentes e alterações de ficheiros temporários não foram incluídos no merge publicado.

## Resposta para Samuel

O PATCH `status=converted + accepted_slot` funciona pelo trigger, incluindo equipa, tipo e `duration`. `source_request_id` vem automaticamente do ID do pedido. `professional_names` já está disponível em produção como lista de nomes, principal primeiro, preenchida na mesma gravação da consulta, antes do webhook.

Contrato e exemplos: [handoff n8n](2026-10-26-n8n-team-handoff.md).
