# Demo Staff Seed

Este script cria:

- `1` admin: `admin1@barnun.pt`
- `2` secretárias: `secretaria1@barnun.pt`, `secretaria2@barnun.pt`
- `5` médicos por especialidade existente na tabela `specialties`

Cada conta:

- fica criada diretamente no `auth.users`
- usa a mesma password
- fica com `email_confirm: true`
- recebe `user_roles`
- recebe `user_profiles.color`
- no caso dos médicos, cria também o respetivo `professional` com nome e cor

## Como correr

```powershell
$env:SUPABASE_URL="https://SEU-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="SUA_SERVICE_ROLE_KEY"
$env:DEMO_STAFF_PASSWORD="A_PASSWORD_QUE_QUERES"
$env:DEMO_EMAIL_DOMAIN="barnun.pt"
node scripts/seed-demo-staff.mjs
```

## Notas

- Os emails podem ser fake neste fluxo porque não há envio de convite.
- Para login funcionar, basta saber o email e a password comum.
- Os médicos ficam com nome `Medico 1`, `Medico 2`, etc. O email inclui a especialidade para evitar colisões.
