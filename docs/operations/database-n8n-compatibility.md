# Contrato de auditoria: base de dados e n8n

Regra solicitada pelo utilizador em 27/10/2026. Aplicável a todas as futuras alterações da BD, RPCs, permissões, triggers e fluxos de gravação da Barnun.

## Antes de publicar

1. Inventariar a diferença real de schema e código entre a versão publicada e a candidata, incluindo migrações, defaults, constraints, RLS, assinaturas RPC e triggers. Não confundir protótipo com implementação.
2. Confrontar com o contrato n8n documentado e, quando necessário, obter de Samuel a versão atual dos workflows ou a confirmação dos filtros. Conhecer o contrato não significa conhecer o estado atual de todos os nodes.
3. Mapear cada ação da aplicação para INSERT/UPDATE/DELETE e os eventos resultantes. Incluir efeitos indiretos: sincronizações, cascatas, backfills e incremento de version. Transação atómica não significa mensagem única.
4. Validar localmente as regressões e os novos fluxos com dados fictícios. Antes das escritas, verificar que o backend é local e não tem triggers HTTP externos. Capturar eventos através de observadores locais; não enviar fixtures aos endpoints reais.
5. Demonstrar que comentários e observações internas não entram em payloads externos, final_notes, templates WhatsApp ou logs partilhados. Preferir tabelas internas separadas, sem webhooks externos; RLS só por si não filtra um webhook executado com privilégios.
6. Testar compatibilidade com consultas antigas/avulsas, equipas, conversão WhatsApp, repetição de pedidos, concorrência, reabertura/conclusão, contactos, falhas e rollback. Usar casos pertinentes à alteração.
7. Classificar cada impacto: sem impacto externo demonstrado; evento esperado compatível; alteração necessária no n8n; ou pendente de evidência. Não afirmar ausência de impacto por apenas adicionar colunas.
8. Preparar deploy/rollback que preserve dados novos e contratos existentes. Coordenar mudanças incompatíveis entre aplicação, BD e n8n antes da publicação.

## Entregáveis de cada alteração

- Resumo ao utilizador: o que muda, se afeta mensagens/automações, porquê e o que falta validar, em linguagem simples.
- Se houver intervenção ou verificação necessária do Samuel: documento técnico versionado com objetos alterados, contrato antes/depois, eventos e exemplos JSON fictícios, nodes/filtros a rever (apenas quando conhecidos), deduplicação, ordem de publicação, rollback e testes esperados.
- Distinguir testes locais, verificação do schema remoto e testes ponta a ponta do n8n. A conclusão de um não prova os restantes.
- Não enviar mensagens ao Samuel automaticamente: entregar o documento ao utilizador, salvo autorização explícita de envio.

## Fontes atuais

- `2026-10-26-n8n-team-handoff.md`: contrato das consultas com equipa.
- `2026-10-26-samuel-final-hardening.md`: correções B–E e validação n8n ainda pendente nesse registo.
- Relatório do Samuel fornecido pelo utilizador: 28 testes de equipas aprovados; não extrapolar esse resultado para alterações posteriores.
