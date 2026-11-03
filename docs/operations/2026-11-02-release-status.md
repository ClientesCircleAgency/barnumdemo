# Estado de publicação — 02/11/2026

## Correções publicadas

Produção `dev`: `6983eb4`, sobre `0cf36d4`. Migração aplicada: `20261027151407_samuel_followup_safety.sql`. O dry-run mostrou apenas esta migração. As três funções substituídas foram comparadas com o schema remoto antes da aplicação e correspondiam à versão anterior conhecida.

- Pedidos públicos limitados aos campos destinados ao formulário.
- Criar paciente já existente não substitui os contactos anteriores; confirmação de pedidos mostra diferenças de contacto.
- Limpar notas de conclusão guarda efetivamente o texto vazio.
- Sincronização de contactos preserva consultas históricas e não altera a versão quando só atualiza o contacto.
- Interface distingue notas para o paciente de informação clínica interna; autorização de avaliação já não aparece como confirmação de entrega.

Validação da versão exata: 71 testes / 18 ficheiros, TypeScript com `tsconfig.app.json` e build aprovados. Vercel reportou sucesso. `/admin/login` respondeu HTTP 200 e o bundle servido contém o backend de produção, não o Docker local, e o novo texto de autorização de avaliação. Não foram feitas consultas fictícias nem enviados WhatsApps na base real.

## Responsabilidade do Samuel

Automações permanecem com o Samuel, por indicação do utilizador. O documento `last 2 2026-10-27-tratamentos-respostas-n8n.md` foi recebido e analisado. Segundo esse contrato, A6 envia notas e avaliação em conjunto quando `send_review=true`, 2–3 horas após a primeira conclusão. Guardar notas não comprova envio; não foi implementado envio independente de notas nem mensagem autónoma de agradecimento.

As correções mantêm as assinaturas RPC e os campos consumidos pelo n8n. Os testes locais de eventos não substituem a verificação externa do Samuel. Prevenção/reenvio de mensagens e alterações ao n8n ficam com ele.

## Tratamentos

Ainda em desenvolvimento no Workbench, fora desta publicação. Existem tabelas/RPCs e testes locais; estão a ser concluídas a interface integrada, marcação e observações internas. A próxima validação usa exclusivamente Docker local sem webhooks externos. Não confundir o protótipo aprovado com a funcionalidade integral.
