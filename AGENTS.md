# Barnun — compatibilidade com produção e n8n

Antes de alterar BD, RPCs, triggers, permissões ou fluxos de gravação, ler e cumprir [o contrato de auditoria](docs/operations/database-n8n-compatibility.md), solicitado pelo utilizador.

Cada entrega deve explicar resumidamente ao utilizador se afeta o funcionamento atual/n8n e porquê, distinguindo evidência de hipótese. Quando precisar de intervenção ou validação do Samuel, preparar um documento técnico para o agente dele. Não presumir que o contrato documentado representa o estado atual de todos os workflows n8n.

Desenvolver/testar no Workbench com backend Docker isolado e sem webhooks externos. Produção é a branch `dev`; desenvolvimento remoto é `workbench/barnun`. Nunca confundir protótipo com funcionalidade implementada ou testes locais com validação externa.
