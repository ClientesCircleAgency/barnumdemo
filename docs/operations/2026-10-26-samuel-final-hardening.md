# Correções da revisão final do Samuel — B a E

**Publicado em produção em 26/10/2026.** Commit `05d2218`, migração `20261026181414` confirmada no histórico remoto e [deploy Vercel concluído](https://vercel.com/tiagocarvalhos-projects/barnumdemo/EgvWARXR5ZdCupGyijcEArsirVxE). Compilação e revisão independente aprovadas. Validação n8n ponta a ponta continua pendente do Samuel.

## Contrato

- **B:** política de INSERT público exige `pending`; aceita `suggested_slots` vazio/NULL, mas não opções, aceite, rejeição, profissional atribuído, expiração ou motivo de cancelamento. A política separada de admins/secretárias mantém a gestão. Não corrige retroativamente pedidos existentes.
- **C:** concluir novamente conserva `finalized_at` e o primeiro `finalized_by`. Notas NULL, vazias ou só espaços conservam as anteriores. O modal abre com notas e opção de avaliação atuais; uma tentativa falhada conserva o rascunho. A opção explícita de avaliação continua editável. A deduplicação das mensagens continua responsabilidade do n8n; não afirmar que foi testada ponta a ponta nesta alteração.
- **D:** converter um pedido com NIF já existente reutiliza o paciente sem substituir nome, telefone ou email. Um NIF novo continua a criar paciente. O pedido conserva os dados submetidos para conferência pela equipa.
- **E:** alterar nome/telefone do paciente sincroniza os snapshots das consultas abertas e das concluídas com `send_review=true`. A base não tem um campo independente de entrega da avaliação; esta condição também pode abranger avaliações já enviadas se o n8n deixar a opção ativa. Não altera estado, notas, equipa, opção de avaliação nem `finalized_at`. Os UPDATE técnicos continuam a chegar aos webhooks normais, pelo que o filtro/deduplicação do n8n deve ser confirmado por Samuel. Não há backfill nem mensagens de teste em produção.

Migração: `20261026181414_harden_requests_and_patient_contacts.sql`. Aplicar apenas esta nova migração após as anteriores; não repetir baseline nem editar migrações já publicadas.

## Verificação

- Teste local antes da correção: 17/19 casos falharam, reproduzindo os problemas.
- Após correção e expansão: 23/23 casos da nova suite SQL passaram, incluindo anon, authenticated sem gestão e secretária.
- Restantes 35 casos SQL passaram (58 no total).
- 67 testes de aplicação passaram; TypeScript passou.
- Nenhum teste escreveu pacientes reais; testes SQL com rollback e ambiente sem triggers HTTP.

## Validação a pedir ao Samuel

Com dados sintéticos e só o número autorizado: converter NIF existente com contactos diferentes; reabrir/concluir uma consulta com notas e avaliação desativada; corrigir telefone antes de lembrete/avaliação; confirmar que atualização técnica de contactos não envia confirmação/reagendamento nem duplica avaliações.

## Pendente, fora desta publicação

- **A:** segredo nos Database Webhooks + Header Auth no n8n, numa janela coordenada.
- Rotação de chaves coordenada: funções invite/update/list/delete-collaborator usam `SUPABASE_SERVICE_ROLE_KEY`. Confirmar configurações efetivas da Vercel e outros consumidores com Samuel; não inferir uso apenas do código. Workbench usa backend local.
- Tratamentos e mini chat permanecem pausados.
- Incidente da secretária: utilizador confirmou que já consegue mover. Causa não confirmada.
