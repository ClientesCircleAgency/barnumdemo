# Correções após o relatório do Samuel

27/10/2026. Implementação no Workbench, sem publicação nem migrações remotas.

## Fontes e limites

Recebidos do utilizador: `2026-10-26-falta-tiago-para-fechar.md` e `2026-10-27-relatorio-final-n8n.md`. O segundo declara B–E e automações entregues, com riscos de segurança abertos. Aceitamos essa validação como relatório do Samuel, não como testes externos executados por nós. Os testes descritos abaixo cobrem alterações posteriores e são locais.

O ficheiro `2026-10-27-tratamentos-respostas-n8n.md`, referido pelo relatório final, ainda não foi disponibilizado. Estas correções não certificam a implementação completa dos Tratamentos.

## Correções implementadas

Migração: `supabase/migrations/20261027151407_samuel_followup_safety.sql`. Não depende das tabelas de Tratamentos; depende das funções de equipa e do hardening B–E existentes. Sem backfill, novas colunas ou alterações de assinatura.

| Ponto | Antes | Agora |
|---|---|---|
| Notas na reconclusão | Vazio preservava as notas antigas | `NULL` preserva; texto vazio/espaços apaga; texto preenchido substitui. Sala de Espera transmite o vazio sem o converter em NULL. |
| Novo paciente | `upsert` podia substituir a ficha por NIF | `insert`; conflito 23505 devolve mensagem de NIF já registado e atualiza a lista. Sem alteração da ficha existente. |
| Conversão de pedido | Diferenças só eram detetadas depois | Comparação por NIF mostra nome/telefone da ficha e do pedido antes de confirmar. Falha na consulta da ficha impede confirmação e permite repetir. |
| Sincronização de contactos | Alterava toda a história com avaliação ativa e incrementava version | Mantém consultas abertas; concluídas só com avaliação ativa e finalized_at nas últimas 4h. Só contactos + updated_at não incrementam version; mudanças de estado/agenda/notas continuam a incrementá-la. |
| Pedido público anónimo | Podia definir campos técnicos | INSERT restrito a name, email, phone, nif, specialty_id, reason, preferred_date, preferred_time. RLS existente mantém-se; gestão e service_role mantêm os contratos. |

A janela de 4h aplica-se apenas à sincronização de contactos para avaliações; não implementa recuperação de mensagens em atraso. O histórico antigo fica intacto. Uma consulta antiga reaberta volta a ser considerada aberta.

## Contrato para o agente do Samuel

1. `set_appointment_state` mantém a assinatura de cinco parâmetros. Para manter notas existentes, omitir `p_final_notes` ou enviar `null`. Enviar `""` significa apagar intencionalmente. A data original de conclusão e a opção de review não são repostas automaticamente.
2. Corrigir nome/telefone continua a gerar UPDATE em cada appointment elegível; estes eventos podem ter `old_record.version == record.version`. Não representam reagendamento nem nova conclusão. Confirmar que A1 continua a ignorá-los e que A6 consulta os contactos atuais quando envia.
3. Alterações normais de estado/data/equipa continuam com incremento de versão. Não usar a ausência de incremento num evento de contactos como sinal de erro.
4. Criação de paciente e aviso de divergência não enviam mensagens por si. Conversão continua a preservar a ficha verificada; o comportamento externo existente de contacto diferente mantém-se.
5. A whitelist de INSERT afeta anon, o papel do formulário público. As credenciais privilegiadas do n8n não usam esse papel.

Exemplos dos argumentos, sem dados reais:

```json
{"p_final_notes": null}
```

Preserva o texto ao concluir. Para o apagar:

```json
{"p_final_notes": ""}
```

## Recuperação de lembretes/avaliações: coordenação pendente

Não foram adicionados `review_sent_at` nem `reminder_sent_at`. Apenas acrescentar as colunas não recupera mensagens nem impede duplicados. Antes de implementar, acordar com Samuel:

- Registar sucesso só depois da confirmação do fornecedor; definir o tratamento de timeout com resultado incerto.
- Definir a identidade de cada envio, incluindo a data/hora agendada para lembretes. Um reagendamento depois de um lembrete enviado não deve ficar permanentemente bloqueado por um timestamp antigo.
- Garantir exclusão entre execuções concorrentes e retries; definir se o fornecedor suporta uma chave de idempotência.
- Fixar a janela de recuperação e a regra quando review é ativado tardiamente; não enviar automaticamente mensagens de consultas históricas.
- Coordenar a transição: estado de mensagens antigas desconhecido não equivale a “nunca enviado”. Preparar ativação com corte temporal, testes e possibilidade de desligar o novo fluxo.

## Segurança: estado real

- GitHub connector confirmou `ClientesCircleAgency/barnumdemo` público em 27/10. Não alterámos a visibilidade.
- `.claude/settings.local.json` estava versionado. Removido do índice desta cópia e incluído no `.gitignore`, preservando o ficheiro local. Não imprimir nem incluir o seu conteúdo/diff em relatórios. Esta alteração local não apaga o histórico remoto e não revoga a chave.
- Rotação das chaves, atualização coordenada do n8n/site/functions, revisão da conta demo e autenticação dos dois webhooks continuam pendentes em produção. Não testámos credenciais expostas nem enviámos mensagens.
- Antes de alterar os webhooks precisamos do segredo por canal seguro e da coordenação de ativação no n8n. Antes de revogar credenciais precisamos da janela de troca com Samuel e do inventário dos consumidores. Não guardar novos segredos no código ou neste documento.

## Validação e publicação

Os testes foram primeiro alterados para reproduzir as falhas. Após a migração local, as oito suites SQL passaram. A aplicação passou 72 testes em 19 ficheiros, TypeScript e build. O build mantém avisos de tamanho do bundle e Browserslist desatualizado. A revisão independente não identificou problemas críticos/importantes; recomendou uma regressão adicional para contacto combinado com outra alteração, incluída no teste request_hardening. Privilégios herdados do ambiente remoto ainda exigem verificação antes de publicar.

Publicar futuramente a migração antes do frontend; confirmar o contrato de vazio/NULL e os filtros dos eventos de contactos com Samuel. Estas correções podem ser entregues separadamente dos Tratamentos, selecionando apenas os ficheiros pertinentes. Não publicar a branch completa sem concluir a integração de Tratamentos.

Rollback: reverter o frontend se necessário; preservar pacientes e pedidos. Para reverter as funções, criar migração corretiva a partir das versões anteriores, sem apagar dados. Evitar restaurar o upsert destrutivo ou ampliar novamente os privilégios do formulário público.
