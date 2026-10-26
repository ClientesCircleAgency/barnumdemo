# Desenvolvimento Barnun

- Branch de desenvolvimento: `workbench/barnun`, publicada em `origin/workbench/barnun`.
- Branch de produção: `dev`. Um push para `dev` publica o site.
- Desenvolvimento local: esta pasta Workbench e Supabase no Docker `barnun-workbench`. As variáveis `.env.*` locais não são enviadas ao GitHub.
- A branch de desenvolvimento não cria um backend remoto nem partilha o Docker com outros computadores.
- `vercel.json` desativa apenas os deploys automáticos de `workbench/barnun`, usando `git.deploymentEnabled`. A regra não desativa `dev`.
- Protótipo de tratamentos: `prototypes/treatments/index.html`, apenas dados fictícios em memória. Não representa a funcionalidade implementada na aplicação.
- `.superpowers/` contém evidências locais e possíveis exports de schema; está excluída do Git.

## Fluxo

Desenvolver e testar no Workbench, fazer commit e push para `workbench/barnun`. Integrar alterações revistas em `dev` apenas no momento de uma publicação autorizada, preservando a configuração Supabase de produção. Não copiar a configuração local do Docker sobre a configuração de produção.

Antes de ativar um preview remoto, configurar explicitamente um backend de testes acessível por esse preview. Não assumir que as variáveis de preview da Vercel são isoladas da produção.

Referência: https://vercel.com/docs/project-configuration/git-configuration
