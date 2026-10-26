# Barnun Workbench

Desenvolvimento local em `Projects/workbench/barnun`, branch `workbench/barnun`.

## Preparação

Com Docker Desktop e Supabase CLI instalados, executar na pasta do projeto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Initialize-Workbench.ps1
npm run dev
```

O script utiliza exclusivamente o contentor `supabase_db_barnun-workbench` e a API `http://127.0.0.1:46321`. Escreve `.env.development.local` (ignorado pelo Git) para o frontend local. Não altera a configuração de produção nem importa pacientes ou utilizadores. É necessário criar utilizadores sintéticos no Auth local para testar sessões autenticadas.

Portas locais reservadas ao Workbench: 46320–46327. A configuração usa `barnun-workbench`, distinguindo-se das outras instâncias Supabase locais.

## Esquema inicial

O histórico de migrações anterior à funcionalidade não reconstrói uma base vazia: falta `request_status`, e o esquema antigo local também não tinha `accepted_slot`. Por isso, `supabase/local/baseline-20261024.sql` contém apenas o esquema público exportado em modo de leitura da Barnun em 24/10/2026, sem dados. Não executar este baseline no remoto.

As migrações e seeds automáticos estão desativados apenas nesta configuração Workbench. O script importa o baseline numa base vazia e depois aplica as migrações `20261024*.sql`. Numa base existente, não apaga dados nem repete migrações; alterações seguintes são aplicadas explicitamente. As migrations de entrega são apenas os ficheiros novos de participantes, operações atómicas, conversão e ciclo de vida, não o baseline.

## Testes

```powershell
npm test
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
supabase test db --local
node scripts/test-appointment-team-concurrency.mjs
```

Os testes SQL usam dados fictícios e rollback. O teste de concorrência usa duas sessões reais no contentor local fixo, remove apenas as suas fixtures e não aceita URL remota.

## Entrega

Validar localmente, integrar na pasta local de entrega preservando alterações existentes, e só depois publicar. Um push para a branch remota `dev` publica a Barnun em produção. Esta implementação exige entrega coordenada das migrações e frontend: as novas mutações usam RPCs e as escritas diretas de reservas por utilizadores autenticados deixam de ser permitidas.

As automações externas do Samuel ainda precisam de validação integrada antes da publicação. O wrapper antigo de conversão e o campo do médico principal foram preservados. Não enviar notificações reais nos testes.
